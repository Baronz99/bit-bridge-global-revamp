# frozen_string_literal: true

module Api
  module V1
    class TransactionsController < ApplicationController
      before_action :set_transaction, only: %i[show update destroy]

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

        scope = current_user.transactions.with_attached_proof.order(created_at: :desc)
        scope = scope.where(transaction_type: transaction_type) if transaction_type.present?
        scope = scope.where(status: status) if status.present?

        if wallet_type.present?
          wallet_type = 'usd' if wallet_type == 'usdt'
          if Wallet.wallet_types.key?(wallet_type)
            scope = scope.joins(:wallet).where(wallets: { wallet_type: Wallet.wallet_types[wallet_type] })
          end
        end

        render json: { data: ActiveModelSerializers::SerializableResource.new(scope) }
      end

      def show
        render json: { data: TransactionSerializer.new(@transaction) }, status: :ok
      end

      # POST /api/v1/transactions/initialize_transaction
      def initialize_transaction
        initialize_payment = PaymentService.new
        response = initialize_payment.init_transaction(transaction_params)

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
              reference: response[:response]['responseBody']['paymentReference']
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
          render json: { message: response[:message] }, status: :bad_request
        end
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
    end
  end
end
