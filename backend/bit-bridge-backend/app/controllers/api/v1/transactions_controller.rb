# frozen_string_literal: true

module Api
  module V1
    class TransactionsController < ApplicationController
      skip_before_action :authenticate_user!, only: :verify
      before_action :set_transaction, only: %i[show update destroy]
      before_action :set_receipt_transaction, only: %i[receipt]

      def index
        @transactions =
          if current_user&.admin || current_user&.role == 'super_admin'
            Transaction.with_attached_proof.order(created_at: :desc)
          else
            current_user.transactions.with_attached_proof.order(created_at: :desc)
          end
        render json: {
          data: ActiveModelSerializers::SerializableResource.new(@transactions)
        }
      end

      # GET /api/v1/transactions/user
      # Optional:
      # ?transaction_type=deposit|withdrawal
      # ?status=pending|approved|declined|initialized|failed
      # ?wallet_type=ngn|usd   (production)
      def user
        transaction_type = params[:transaction_type]
        status = params[:status]
        wallet_type = params[:wallet_type].to_s.downcase
        limit = [params[:limit].to_i.positive? ? params[:limit].to_i : 40, 100].min
        cursor = parse_transactions_cursor(params[:cursor])

        scope = current_user
          .transactions
          .with_attached_proof
          .includes(:wallet, :transaction_record)
          .order(created_at: :desc, id: :desc)
        scope = scope.where(transaction_type: transaction_type) if transaction_type.present?
        scope = scope.where(status: status) if status.present?
        scope = scope.where('transactions.created_at < ?', cursor) if cursor

        if wallet_type.present?
          wallet_type = 'usd' if wallet_type == 'usdt'
          if Wallet.wallet_types.key?(wallet_type)
            scope = scope.joins(:wallet).where(wallets: { wallet_type: Wallet.wallet_types[wallet_type] })
          end
        end

        items = scope.limit(limit).to_a
        next_cursor = items.last&.created_at&.iso8601

        render json: {
          data: ActiveModelSerializers::SerializableResource.new(items),
          next_cursor: next_cursor
        }
      end

      def show
        render json: { data: TransactionSerializer.new(@transaction) }, status: :ok
      end

      # GET /api/v1/transactions/:id/receipt
      def receipt
        return render json: { message: 'Transaction not found' }, status: :not_found unless @receipt_transaction

        render json: { data: build_receipt(@receipt_transaction) }, status: :ok
      end

      # POST /api/v1/transactions/initialize_transaction
      def initialize_transaction
        response =
          begin
            initialize_payment = PaymentService.new
            initialize_payment.init_transaction(transaction_params)
          rescue RuntimeError => e
            { message: e.message.to_s }
          end

        if response[:status] == :ok
          wallet = resolve_wallet_from_params(transaction_params)

          transaction = wallet.transactions.create(
            status: 'initialized',
            coin_type: 'mobile_bank',
            transaction_type: transaction_params[:transaction_type],
            amount: transaction_params[:amount]
          )

          if transaction.persisted?
            transaction_record = TransactionRecord.new(
              exchange_id: transaction.id,
              reference: response[:response]['responseBody']['paymentReference'],
              status: 'pending',
              event_type: 'checkout.init'
            )

            if transaction_record.save
              render json: response[:response], status: :ok
            else
              render json: { message: transaction_record.errors.full_messages.to_sentence }, status: :unprocessable_entity
            end
          else
            render json: { message: transaction.errors.full_messages.to_sentence }, status: :unprocessable_entity
          end
        else
          render json: { message: response[:message] }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/transactions/verify?payment_reference=...
      def verify
        reference =
          params[:payment_reference].presence ||
          params[:reference].presence

        if reference.blank?
          return render json: { message: 'payment_reference is required' }, status: :bad_request
        end

        unless reference.match?(/\A(fbg|bbg)-\d+\z/)
          return render json: { message: 'payment_reference is invalid' }, status: :bad_request
        end

        transaction_record = TransactionRecord.find_by(reference: reference)
        unless transaction_record
          return render json: { message: 'Transaction not found' }, status: :not_found
        end

        exchange = transaction_record.exchange

        currency =
          exchange&.wallet&.currency.presence ||
          transaction_record&.exchange&.wallet&.currency.presence ||
          'NGN'

        status_value = transaction_record.status.to_s.strip.downcase
        status_value = 'pending' if status_value.blank?

        # ✅ Critical: ensure amount is not nil (some flows don’t persist amount on TransactionRecord)
        amount_value =
          transaction_record&.amount.presence ||
          exchange&.amount.presence

        exchange_status = exchange&.status.to_s.strip.downcase.presence

        payload = {
          reference: transaction_record.reference,
          status: status_value,
          amount: amount_value,
          currency: currency,
          created_at: transaction_record.created_at,
          updated_at: transaction_record.updated_at
        }

        # ✅ Keep existing shape, but also add top-level keys for any legacy frontend polling logic
        render json: {
          data: payload,
          reference: payload[:reference],
          status: payload[:status],
          amount: payload[:amount],
          currency: payload[:currency]
        }, status: :ok
      end

      # POST /api/v1/transactions
      def create
        current_user.initialize_wallets if current_user.wallet.nil? && current_user.wallets.blank?

        wallet = resolve_wallet_from_params(transaction_params)
        @transaction = wallet.transactions.new(transaction_params.except(:wallet_type))

        if @transaction.save
          render json: { data: TransactionSerializer.new(@transaction), message: 'Transaction created successfully' }, status: :created
        else
          render json: { message: @transaction.errors.full_messages.to_sentence }, status: :unprocessable_entity
        end
      end

      def create_user
        @transaction = Transaction.new(transaction_params.except(:wallet_type))

        unless current_user.role == 'admin' || current_user.role == 'super_admin'
          return render json: { message: 'Not authorized ' }, status: :unauthorized
        end

        if @transaction.save
          render json: { data: TransactionSerializer.new(@transaction), message: 'Transaction created successfully' }, status: :created
        else
          render json: { message: @transaction.errors.full_messages.to_sentence }, status: :unprocessable_entity
        end
      end

      def update
        if @transaction.update(transaction_params.except(:wallet_type))
          render json: { data: @transaction, message: 'updated successfully' }
        else
          render json: { message: @transaction.errors.full_messages.to_sentence }, status: :unprocessable_entity
        end
      end

      def destroy
        @transaction.destroy!
      end

      private

      def set_transaction
        @transaction = Transaction.find(params[:id])
      end

      def set_receipt_transaction
        scope = Transaction.includes(:wallet, :transaction_record)

        @receipt_transaction =
          if current_user&.admin?
            scope.find_by(id: params[:id])
          else
            current_user.transactions.includes(:wallet, :transaction_record).find_by(id: params[:id])
          end
      end

      def build_receipt(txn)
        metadata = txn.metadata.is_a?(Hash) ? txn.metadata : {}
        record = txn.transaction_record
        anchor_details = extract_anchor_receipt_details(metadata, record)
        circle_tx = resolve_circle_transaction(txn, metadata)
        fx_quote = resolve_fx_quote(txn, metadata)
        provider_reference = anchor_details[:payment_reference] || resolve_provider_reference(record, metadata, txn)
        provider_name = resolve_provider_name(record, metadata)
        provider_status = record&.status || resolve_anchor_status(provider_reference) || metadata['provider_status']
        amount = txn.amount.presence || record&.amount
        currency = resolve_currency(txn)
        fee_amount = resolve_fee_amount(metadata, fx_quote)
        total_amount = resolve_total_amount(amount, fee_amount)

        {
          id: txn.id,
          reference: record&.reference || txn.id,
          status: txn.status,
          transaction_type: txn.transaction_type,
          kind: circle_tx&.kind || metadata['kind'],
          direction: resolve_direction(txn.transaction_type),
          amount: amount,
          fee: fee_amount,
          total: total_amount,
          currency: currency,
          created_at: txn.created_at,
          updated_at: txn.updated_at,
          provider: {
            name: provider_name,
            reference: provider_reference,
            status: provider_status,
            payment_id: anchor_details[:payment_id],
            settlement_account_id: anchor_details[:settlement_account_id]
          }.compact,
          parties: {
            sender_name: anchor_details[:sender_name],
            sender_account_number: anchor_details[:sender_account_number],
            sender_bank_name: anchor_details[:sender_bank_name],
            beneficiary_account_number: anchor_details[:beneficiary_account_number],
            beneficiary_account_name: anchor_details[:beneficiary_account_name]
          }.compact,
          idempotency_key: metadata['idempotency_key'] || circle_tx&.idempotency_key,
          linked: {
            bill_order_id: record&.bill_order_id,
            circle_id: circle_tx&.circle_id,
            circle_transaction_id: circle_tx&.id,
            fx_quote_token: fx_quote&.token
          }.compact,
          fx: serialize_fx_quote(fx_quote),
          customer: serialize_customer(record),
          meta: {
            anchor: anchor_details
          }.compact,
          timeline: build_timeline(txn, record, provider_reference, circle_tx, fx_quote)
        }.compact
      end

      def resolve_currency(txn)
        value =
          if txn.respond_to?(:has_attribute?) && txn.has_attribute?(:currency)
            txn[:currency]
          end
        value = value.presence || txn.wallet&.currency
        return value if value.present?
        return 'USD' if txn.wallet&.usd?
        return 'NGN' if txn.wallet&.ngn?

        nil
      end

      def resolve_direction(transaction_type)
        return nil if transaction_type.blank?

        transaction_type.to_s == 'deposit' ? 'credit' : 'debit'
      end

      def resolve_provider_reference(record, metadata, txn)
        record&.reference ||
          metadata['transfer_reference'] ||
          metadata['transaction_reference'] ||
          txn.transfer_id
      end

      def resolve_provider_name(record, metadata)
        event_type = record&.event_type.to_s
        return 'monnify' if event_type.start_with?('monnify.')
        return 'anchor' if event_type.start_with?('anchor.')
        return metadata['provider'] if metadata['provider'].present?

        nil
      end

      def extract_anchor_receipt_details(metadata, record)
        data = metadata.is_a?(Hash) ? metadata : {}
        sender = data['anchor_sender'].is_a?(Hash) ? data['anchor_sender'] : {}
        virtual_account = data['anchor_virtual_account'].is_a?(Hash) ? data['anchor_virtual_account'] : {}

        {
          payment_id: data['anchor_payment_id'],
          payment_reference: data['anchor_payment_reference'] || record&.reference,
          payment_type: data['anchor_payment_type'],
          narration: data['anchor_narration'] || record&.description,
          paid_at: data['anchor_paid_at'],
          provider_created_at: data['anchor_created_at'],
          fee: data['anchor_fee'],
          settlement_account_id: data['anchor_settlement_account_id'],
          sender_name: sender['account_name'] || record&.customer_name,
          sender_account_number: sender['account_number'],
          sender_bank_name: sender['bank_name'] || record&.bank,
          beneficiary_account_number: virtual_account['account_number'] || record&.account_number,
          beneficiary_account_name: virtual_account['account_name']
        }.compact
      end

      def resolve_anchor_status(reference)
        return nil if reference.blank?

        AnchorWebhookEvent.where(reference: reference).order(received_at: :desc).limit(1).pick(:status)
      end

      def resolve_fee_amount(metadata, fx_quote)
        fee =
          metadata['fee'] ||
          metadata['fee_amount'] ||
          metadata['fee_total'] ||
          metadata['service_charge']
        fee = fx_quote&.fee_amount if fee.nil?

        return nil if fee.nil?

        MoneyScale.normalize(fee)
      end

      def resolve_total_amount(amount, fee_amount)
        return nil if amount.nil?
        return nil if fee_amount.nil?

        MoneyScale.normalize(amount.to_d + fee_amount.to_d)
      end

      def resolve_circle_transaction(txn, metadata)
        circle_tx_id = metadata['circle_transaction_id']
        return CircleTransaction.find_by(id: circle_tx_id) if circle_tx_id.present?

        CircleTransaction.find_by(wallet_transaction_id: txn.id)
      end

      def resolve_fx_quote(txn, metadata)
        token = metadata['fx_quote_token']
        return nil if token.blank?

        fx_quote = FxQuote.find_by(token: token)
        return nil if fx_quote.nil?
        return fx_quote if current_user&.admin?

        fx_quote.user_id == txn.wallet&.user_id ? fx_quote : nil
      end

      def serialize_fx_quote(fx_quote)
        return nil unless fx_quote

        {
          quote_token: fx_quote.token,
          direction: fx_quote.direction,
          base_rate: fx_quote.base_rate,
          execution_rate: fx_quote.execution_rate,
          markup: fx_quote.markup,
          fee_amount: fx_quote.fee_amount,
          fee_currency: fx_quote.fee_currency,
          amount_in: fx_quote.amount_in,
          amount_after_fee: fx_quote.amount_after_fee,
          amount_out: fx_quote.amount_out,
          executed_at: fx_quote.executed_at,
          expires_at: fx_quote.expires_at
        }
      end

      def serialize_customer(record)
        return nil unless record

        name = record.customer_name
        email = record.email
        phone = record.phone_number
        return nil if name.blank? && email.blank? && phone.blank?

        if current_user&.admin?
          return {
            name: name,
            email: email,
            phone_number: phone
          }.compact
        end

        {
          name: mask_name(name, email),
          email: mask_email(email),
          phone_number: mask_phone(phone)
        }.compact
      end

      def build_timeline(txn, record, provider_reference, circle_tx, fx_quote)
        events = []
        events << {
          event_type: 'wallet.transaction.created',
          status: txn.status,
          reference: txn.id,
          occurred_at: txn.created_at,
          source: 'wallet'
        }

        if record
          events << {
            event_type: record.event_type.presence || 'transaction_record',
            status: record.status,
            reference: record.reference,
            amount: record.amount,
            occurred_at: record.created_at,
            source: 'transaction_record'
          }.compact
        end

        if provider_reference.present?
          AnchorWebhookEvent.where(reference: provider_reference).order(received_at: :desc).each do |event|
            events << {
              event_type: event.event_type,
              status: event.status,
              reference: event.reference,
              occurred_at: event.processed_at || event.received_at || event.created_at,
              source: 'anchor_webhook'
            }
          end
        end

        if circle_tx
          events << {
            event_type: 'circle.transaction.created',
            status: circle_tx.direction,
            reference: circle_tx.reference,
            occurred_at: circle_tx.occurred_at,
            source: 'circle'
          }

          dispute = circle_tx.dispute
          if dispute
            events << {
              event_type: 'circle.dispute.opened',
              status: dispute.status,
              reference: dispute.id,
              occurred_at: dispute.created_at,
              source: 'dispute'
            }
          end
        end

        if fx_quote&.executed_at.present?
          events << {
            event_type: 'fx.quote.executed',
            status: 'executed',
            reference: fx_quote.token,
            occurred_at: fx_quote.executed_at,
            source: 'fx'
          }
        end

        events
          .sort_by { |event| event[:occurred_at] || Time.at(0) }
          .reverse
      end

      def mask_email(email)
        return nil if email.blank?

        local, domain = email.split('@', 2)
        return email if domain.blank?
        local_mask = local.length <= 1 ? '*' : "#{local[0]}***"
        domain_name, tld = domain.split('.', 2)
        domain_mask = domain_name.present? ? "#{domain_name[0]}***" : '***'
        tld_part = tld.present? ? ".#{tld}" : ''
        "#{local_mask}@#{domain_mask}#{tld_part}"
      end

      def mask_phone(phone)
        return nil if phone.blank?

        digits = phone.to_s.gsub(/\D/, '')
        return '*' * phone.length if digits.length <= 4

        digits.gsub(/\d(?=\d{4})/, '*')
      end

      def mask_name(name, fallback_email)
        return mask_email(fallback_email) if name.blank?

        parts = name.to_s.strip.split(/\s+/)
        return "#{parts[0][0]}." if parts.any?

        mask_email(fallback_email)
      end

      def transaction_params
        params.require(:transaction).permit(
          :status,
          :amount,
          :address,
          :proof,
          :transaction_type,
          :currency,
          :wallet_type, # optional selector
          :coin_type,
          :bank,
          :wallet_id,
          :coupon_code,
          :customer_name,
          :email,
          :description,
          :payment_purpose,
          :redirect_url
        )
      end

      # Decide which wallet to use:
      # - default: NGN wallet (Bridge)
      # - if wallet_type/currency present => use that (usd supported)
      def resolve_wallet_from_params(permitted)
        wt = permitted[:wallet_type].presence || permitted[:currency].presence
        wt = wt.to_s.downcase

        wt = 'usd' if wt == 'usdt'
        if wt.present? && Wallet.wallet_types.key?(wt)
          current_user.ensure_wallet!(wt)
        else
          current_user.ngn_wallet
        end
      end

      def parse_transactions_cursor(raw)
        return nil if raw.blank?
        Time.iso8601(raw.to_s)
      rescue ArgumentError
        nil
      end
    end
  end
end
