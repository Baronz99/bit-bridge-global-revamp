# frozen_string_literal: true

module Api
  module V1
    class ReceiptsController < ApplicationController
      before_action :authenticate_user!

      # GET /api/v1/receipts/:id
      # Accepts:
      # - fbg-123 / bbg-123 (TransactionRecord.reference)
      # - wallet-tx-<uuid>
      # - bill-<uuid>
      # - card-evt-<uuid>
      # - txn-<uuid> (Transaction id alias)
      # - raw provider references (transfer refs, etc)
      def show
        reference =
          params[:reference].presence ||
          params[:id].presence

        reference = reference.to_s.strip
        return render json: { message: 'Receipt reference is required.' }, status: :bad_request if reference.blank?

        receipt = resolve_receipt(reference)
        return render json: { message: 'Receipt not found.' }, status: :not_found if receipt.nil?

        render json: { message: 'ok', data: receipt }, status: :ok
      end

      private

      # ----------------------------
      # Main resolver
      # ----------------------------
      def resolve_receipt(reference)
        ref = reference.to_s.strip

        # 1) normalize timeline ids -> canonical reference or underlying model
        if ref.start_with?('wallet-tx-')
          tx_id = ref.delete_prefix('wallet-tx-')
          tx = owned_wallet_transactions.find_by(id: tx_id)
          return nil unless tx

          # Prefer canonical transaction_record reference if present
          tr = tx.transaction_record
          return receipt_from_transaction_record(tr) if tr&.reference.present?

          return receipt_from_transaction(tx)
        end

        if ref.start_with?('bill-')
          order_id = ref.delete_prefix('bill-')
          order = current_user.bill_orders.find_by(id: order_id)
          return nil unless order

          tr = order.transaction_record
          return receipt_from_transaction_record(tr) if tr&.reference.present?

          return receipt_from_bill_order(order)
        end

        if ref.start_with?('card-evt-')
          evt_id = ref.delete_prefix('card-evt-')
          evt = resolve_card_event_by_id(evt_id)
          return nil unless evt
          return receipt_from_card_event(evt)
        end

        if ref.start_with?('circle-tx-')
          # circles don't necessarily have a canonical receipt, so return a safe "circle receipt"
          tx_id = ref.delete_prefix('circle-tx-')
          ctx = resolve_circle_tx_by_id(tx_id)
          return nil unless ctx
          return receipt_from_circle_transaction(ctx)
        end

        # 2) canonical TransactionRecord reference (fbg-/bbg-)
        if transaction_record_reference?(ref)
          record = TransactionRecord.find_by(reference: ref)
          return nil unless record

          # enforce ownership (via associated user or wallet)
          if record.respond_to?(:user_id)
            return nil unless record.user_id == current_user.id
          elsif record.respond_to?(:wallet_id)
            return nil unless record.wallet&.user_id == current_user.id
          end

          return receipt_from_transaction_record(record)
        end

        # 3) txn-<uuid> alias to transaction id
        if ref.start_with?('txn-')
          tx = owned_wallet_transactions.find_by(id: normalize_reference_id(ref))
          return tx ? receipt_from_transaction(tx) : nil
        end

        # 4) wallet transaction by transfer id / metadata transfer_reference
        tx = resolve_transaction(ref)
        return receipt_from_transaction(tx) if tx

        # 5) card event by provider reference etc
        evt = resolve_card_event(ref)
        return receipt_from_card_event(evt) if evt

        # 6) bill order by id or mapped transaction_record
        order = resolve_bill_order(ref)
        return receipt_from_bill_order(order) if order

        nil
      end

      # ----------------------------
      # Owned scopes (security)
      # ----------------------------
      def owned_wallet_transactions
        Transaction
          .joins(:wallet)
          .includes(:wallet, :transaction_record)
          .where(wallets: { user_id: current_user.id })
      end

      # ----------------------------
      # Resolvers
      # ----------------------------
      def resolve_transaction(reference)
        owned_wallet_transactions.find_by(transfer_id: reference) ||
          owned_wallet_transactions.where("metadata ->> 'transfer_reference' = ?", reference).first
      end

      def resolve_card_event_by_id(id)
        card_ids = current_user.cards.pluck(:card_id)
        return nil if card_ids.empty?

        CardEvent.where(card_id: card_ids).find_by(id: id)
      end

      def resolve_card_event(reference)
        card_ids = current_user.cards.pluck(:card_id)
        return nil if card_ids.empty?

        if reference.start_with?('evt-')
          return CardEvent.where(card_id: card_ids).find_by(id: normalize_reference_id(reference))
        end

        CardEvent.where(card_id: card_ids).find_by(provider_transaction_reference: reference) ||
          CardEvent.where(card_id: card_ids).find_by(id: reference)
      end

      def resolve_bill_order(reference)
        # direct id
        bill_order = current_user.bill_orders.find_by(id: reference)
        return bill_order if bill_order

        # bill-<uuid>
        if reference.start_with?('bill-')
          return current_user.bill_orders.find_by(id: normalize_reference_id(reference))
        end

        # map via transaction record
        if transaction_record_reference?(reference)
          record = TransactionRecord.find_by(reference: reference)
          return nil unless record&.bill_order
          return nil unless record.bill_order.user_id == current_user.id

          return record.bill_order
        end

        nil
      end

      def resolve_circle_tx_by_id(id)
        # only allow circle tx inside user's circles
        CircleTransaction
          .includes(:circle, :user)
          .where(circle_id: current_user.circles.select(:id))
          .find_by(id: id)
      end

      # ----------------------------
      # Receipt builders
      # ----------------------------
      def receipt_from_transaction(txn)
        metadata = txn.metadata.is_a?(Hash) ? txn.metadata : {}

        {
          reference: "wallet-tx-#{txn.id}",
          type: 'wallet',
          source: metadata['subtype'] || txn.transaction_type,
          status: txn.status,
          amount: txn.amount,
          currency: txn.currency || txn.wallet&.currency,
          description: metadata['description'] || txn.address,
          created_at: txn.created_at,
          transfer_reference: metadata['transfer_reference'],
          provider: metadata['provider'],
          breakdown: metadata['fee_breakdown'],
          meta: {
            transaction_record_reference: txn.transaction_record&.reference,
            unique_transaction_id: txn.unique_transaction_id,
            bridge_card_id: txn.bridge_card_id
          }.compact
        }.compact
      end

      def receipt_from_card_event(event)
        metadata = event.metadata.is_a?(Hash) ? event.metadata : {}
        event_time = event.transaction_at || event.created_at

        fx_payload =
          if event.merchant_currency.present? || metadata['fx_discovery_present']
            {
              merchant_amount: event.merchant_amount,
              merchant_currency: event.merchant_currency,
              billing_amount: event.billing_amount,
              billing_currency: event.billing_currency,
              fx_implied_rate: event.fx_implied_rate,
              fx_reference_rate: event.fx_reference_rate,
              fx_margin_usd: event.fx_margin_usd
            }.compact
          end

        payload = {
          reference: event.provider_transaction_reference || event.id,
          type: 'card',
          source: event.event || event.event_name,
          status: event.status,
          amount: event.amount,
          currency: event.currency,
          description: metadata['description'] || event.event.to_s.tr('._', ' ').strip,
          created_at: event_time,
          breakdown: {
            principal_usd: metadata['principal_usd'],
            provider_fee_usd: metadata['provider_fee_usd'],
            bitbridge_fee_usd: metadata['bitbridge_fee_usd'],
            fx_markup_usd: metadata['fx_markup_usd'],
            total_debit_usd: metadata['total_debit_usd'],
            funding_fee_usd: metadata['funding_fee_usd'],
            withdrawal_fee_usd: metadata['withdrawal_fee_usd'],
            total_credit_usd: metadata['total_credit_usd']
          }.compact,
          decline_reason: metadata['decline_reason']
        }.compact

        payload[:fx] = fx_payload if fx_payload.present?
        payload
      end

      def receipt_from_bill_order(order)
        record = order.transaction_record
        currency =
          if order.respond_to?(:currency)
            order.currency.presence
          elsif order.respond_to?(:has_attribute?) && order.has_attribute?(:currency)
            order[:currency].presence
          end
        currency ||= 'NGN'

        {
          reference: "bill-#{order.id}",
          type: 'bill',
          source: order.service_type,
          status: order.status,
          amount: order.total_amount || order.amount,
          currency: currency,
          description: order.biller.presence || order.service_type,
          created_at: order.created_at,
          transaction_reference: record&.reference,
          recipient: order.meter_number || (order.respond_to?(:card_number) ? order.card_number : nil) || (order.respond_to?(:phone_number) ? order.phone_number : nil)
        }.compact
      end

      def receipt_from_transaction_record(record)
        bill_order = record.bill_order

        {
          reference: record.reference,
          type: bill_order ? 'bill' : 'checkout',
          source: bill_order&.service_type || record.event_type || 'checkout',
          status: record.status.presence || 'pending',
          amount: record.amount || bill_order&.total_amount || bill_order&.amount,
          currency: 'NGN',
          description: record.description || bill_order&.biller || bill_order&.service_type,
          created_at: record.created_at,
          transaction_reference: record.reference,
          recipient: bill_order&.meter_number ||
            (bill_order&.respond_to?(:card_number) ? bill_order.card_number : nil) ||
            (bill_order&.respond_to?(:phone_number) ? bill_order.phone_number : nil)
        }.compact
      end

      def receipt_from_circle_transaction(tx)
        {
          reference: "circle-tx-#{tx.id}",
          type: 'circle',
          source: tx.kind,
          status: 'ok',
          amount: (tx.amount_cents.to_i / 100.0),
          currency: 'NGN',
          description: tx.description.presence || 'Circle activity',
          created_at: tx.occurred_at,
          meta: {
            circle_id: tx.circle_id,
            circle_name: tx.circle&.name
          }.compact
        }.compact
      end

      # ----------------------------
      # Utils
      # ----------------------------
      def normalize_reference_id(reference)
        reference.to_s.split('-', 2).last
      end

      def transaction_record_reference?(reference)
        reference.match?(/\A(fbg|bbg)-\d+\z/i)
      end
    end
  end
end
