# frozen_string_literal: true

module Api
  module V1
    class WalletsController < ApplicationController
      before_action :set_wallet, only: %i[show update destroy]

      def index
        wallets =
          if current_user&.admin || current_user&.role == 'super_admin'
            Wallet.all
          else
            current_user.wallets
          end
        render json: wallets
      end

      def show
        render json: @wallet
      end

      # ✅ Wallet summary for frontend (Bridge + Tunnel)
      # GET /api/v1/wallets/user
      #
      # Returns:
      # {
      #   data: {
      #     bridge: <wallet>,
      #     tunnel: <wallet|null>,
      #     wallets: [<wallet>, <wallet>]
      #   }
      # }
      def user
        bridge = current_user.ngn_wallet

        # do not auto-create USD unless already present (optional)
        tunnel = current_user.wallets.find_by(wallet_type: :usd)

        wallets = [bridge, tunnel].compact

        render json: {
          data: {
            bridge: WalletSerializer.new(bridge).as_json,
            tunnel: tunnel ? WalletSerializer.new(tunnel).as_json : nil,
            wallets: wallets.map { |w| WalletSerializer.new(w).as_json }
          }
        }, status: :ok
      end

      # ✅ Creates/returns USD wallet for Tunnel
      # POST /api/v1/wallets/tunnel/activate
      def activate_tunnel
        usd_wallet = current_user.usd_wallet

        render json: {
          message: 'Tunnel wallet activated',
          data: WalletSerializer.new(usd_wallet).as_json
        }, status: :ok
      end

      # ✅ Convert NGN -> USD (atomic) using CurrencyService
      # POST /api/v1/wallets/tunnel/convert
      #
      # Accepts body in either form:
      # { amount_ngn: 15000, transaction_pin: "1234" }
      # OR
      # { wallet: { amount_ngn: 15000, transaction_pin: "1234" } }
      def convert_ngn_to_usd
        amount_ngn = extract_amount_ngn
        raw_pin = extract_transaction_pin

        return render json: { message: 'amount_ngn must be greater than 0' }, status: :unprocessable_entity if amount_ngn <= 0

        # 🔐 PIN gate
        return unless require_transaction_pin!(raw_pin)

        ngn_wallet = current_user.ngn_wallet
        usd_wallet = current_user.usd_wallet

        # Ensure balance check uses legacy computed NGN balance (no regression)
        if amount_ngn > ngn_wallet.balance.to_d
          return render json: { message: 'insufficient balance' }, status: :unprocessable_entity
        end

        # CurrencyService returns: { from_curr: ..., to_curr: ..., rate: calculated_rate }
        response = CurrencyService.new('ngn', 'usd').get_calculated_rate(amount_ngn, 'ngn', 'usd')

        if response.is_a?(Hash) && response[:status] == 'error'
          return render json: { message: response[:message] }, status: :unprocessable_entity
        end

        usd_amount = BigDecimal(response[:calc].to_s) rescue 0.to_d
        return render json: { message: 'conversion failed' }, status: :unprocessable_entity if usd_amount <= 0

        usd_cents = usd_wallet.money_to_cents(usd_amount)
        return render json: { message: 'conversion failed' }, status: :unprocessable_entity if usd_cents <= 0

        ActiveRecord::Base.transaction do
          # Record NGN withdrawal transaction (legacy structure)
          ngn_wallet.transactions.create!(
            transaction_type: 'withdrawal',
            status: 'approved',
            amount: amount_ngn,
            coin_type: 'bank',
            address: 'Tunnel Conversion (NGN → USD)'
          )

          # Credit USD stored balance
          usd_wallet.credit_cents!(usd_cents)

          # Record USD deposit transaction
          usd_wallet.transactions.create!(
            transaction_type: 'deposit',
            status: 'approved',
            amount: usd_amount,
            coin_type: 'bank',
            address: 'Tunnel Conversion (NGN → USD)'
          )
        end

        # Re-fetch to ensure updated balances/transactions reflected
        ngn_wallet.reload
        usd_wallet.reload

        render json: {
          message: 'Conversion successful',
          data: {
            ngn_wallet: WalletSerializer.new(ngn_wallet).as_json,
            usd_wallet: WalletSerializer.new(usd_wallet).as_json,
            conversion: {
              from: 'NGN',
              to: 'USD',
              amount_ngn: amount_ngn.to_f,
              amount_usd: usd_amount.to_f,
              rate: response[:rate].to_s,
              fee: 0,
              fee_currency: 'NGN'
            }
          }
        }, status: :ok
      end

      # ✅ Quote NGN -> USD conversion (no PIN, no transfer)
      # POST /api/v1/wallets/tunnel/quote
      # Body: { amount_ngn }
      def quote_ngn_to_usd
        amount_ngn = extract_amount_ngn
        return render json: { message: 'amount_ngn must be greater than 0' }, status: :unprocessable_entity if amount_ngn <= 0

        response = CurrencyService.new('ngn', 'usd').get_calculated_rate(amount_ngn, 'ngn', 'usd')

        if response.is_a?(Hash) && response[:status] == 'error'
          return render json: { message: response[:message] }, status: :unprocessable_entity
        end

        usd_amount = BigDecimal(response[:calc].to_s) rescue 0.to_d
        return render json: { message: 'quote failed' }, status: :unprocessable_entity if usd_amount <= 0

        render json: {
          data: {
            from: 'NGN',
            to: 'USD',
            amount_ngn: amount_ngn.to_f,
            amount_usd: usd_amount.to_f,
            rate: response[:rate].to_s,
            fee: 0,
            fee_currency: 'NGN'
          }
        }, status: :ok
      end

      # ✅ Convert USD -> NGN (atomic) using CurrencyService
      # POST /api/v1/wallets/tunnel/convert-back
      #
      # Accepts body in either form:
      # { amount_usd: 25, transaction_pin: "1234" }
      # OR
      # { wallet: { amount_usd: 25, transaction_pin: "1234" } }
      def convert_usd_to_ngn
        amount_usd = extract_amount_usd
        raw_pin = extract_transaction_pin

        return render json: { message: 'amount_usd must be greater than 0' }, status: :unprocessable_entity if amount_usd <= 0

        # ✅ PIN gate
        return unless require_transaction_pin!(raw_pin)

        ngn_wallet = current_user.ngn_wallet
        usd_wallet = current_user.usd_wallet

        response = CurrencyService.new('usd', 'ngn').get_calculated_rate(amount_usd, 'usd', 'ngn')

        if response.is_a?(Hash) && response[:status] == 'error'
          return render json: { message: response[:message] }, status: :unprocessable_entity
        end

        ngn_amount = BigDecimal(response[:calc].to_s) rescue 0.to_d
        return render json: { message: 'conversion failed' }, status: :unprocessable_entity if ngn_amount <= 0

        usd_cents = usd_wallet.money_to_cents(amount_usd)
        return render json: { message: 'conversion failed' }, status: :unprocessable_entity if usd_cents <= 0

        ActiveRecord::Base.transaction do
          # Record USD withdrawal transaction
          usd_wallet.transactions.create!(
            transaction_type: 'withdrawal',
            status: 'approved',
            amount: amount_usd,
            coin_type: 'bank',
            address: 'Tunnel Conversion (USD → NGN)'
          )

          # Debit USD stored balance
          usd_wallet.debit_cents!(usd_cents)

          # Record NGN deposit transaction (legacy structure)
          ngn_wallet.transactions.create!(
            transaction_type: 'deposit',
            status: 'approved',
            amount: ngn_amount,
            coin_type: 'bank',
            address: 'Tunnel Conversion (USD → NGN)'
          )
        end

        ngn_wallet.reload
        usd_wallet.reload

        render json: {
          message: 'Conversion successful',
          data: {
            ngn_wallet: WalletSerializer.new(ngn_wallet).as_json,
            usd_wallet: WalletSerializer.new(usd_wallet).as_json,
            conversion: {
              from: 'USD',
              to: 'NGN',
              amount_usd: amount_usd.to_f,
              amount_ngn: ngn_amount.to_f,
              rate: response[:rate].to_s,
              fee: 0,
              fee_currency: 'USD'
            }
          }
        }, status: :ok
      end

      # ✅ Quote USD -> NGN conversion (no PIN, no transfer)
      # POST /api/v1/wallets/tunnel/quote-back
      # Body: { amount_usd }
      def quote_usd_to_ngn
        amount_usd = extract_amount_usd
        return render json: { message: 'amount_usd must be greater than 0' }, status: :unprocessable_entity if amount_usd <= 0

        response = CurrencyService.new('usd', 'ngn').get_calculated_rate(amount_usd, 'usd', 'ngn')

        if response.is_a?(Hash) && response[:status] == 'error'
          return render json: { message: response[:message] }, status: :unprocessable_entity
        end

        ngn_amount = BigDecimal(response[:calc].to_s) rescue 0.to_d
        return render json: { message: 'quote failed' }, status: :unprocessable_entity if ngn_amount <= 0

        render json: {
          data: {
            from: 'USD',
            to: 'NGN',
            amount_usd: amount_usd.to_f,
            amount_ngn: ngn_amount.to_f,
            rate: response[:rate].to_s,
            fee: 0,
            fee_currency: 'USD'
          }
        }, status: :ok
      end

      def create
        wallet = Wallet.new(wallet_params)
        if wallet.save
          render json: wallet, status: :created, location: wallet
        else
          render json: wallet.errors, status: :unprocessable_entity
        end
      end

      def update
        if @wallet.update(wallet_params)
          render json: @wallet
        else
          render json: @wallet.errors, status: :unprocessable_entity
        end
      end

      def destroy
        @wallet.destroy!
        head :no_content
      end

      private

      def set_wallet
        @wallet = Wallet.find(params[:id])
      end

      def wallet_params
        params.require(:wallet).permit(:user_id, :wallet_type, :currency)
      end

      # Support both payload styles:
      # root params OR nested in wallet
      def extract_amount_ngn
        raw =
          params[:amount_ngn].presence ||
          params.dig(:wallet, :amount_ngn).presence

        raw.to_d
      rescue StandardError
        0.to_d
      end

      def extract_amount_usd
        raw =
          params[:amount_usd].presence ||
          params.dig(:wallet, :amount_usd).presence

        raw.to_d
      rescue StandardError
        0.to_d
      end

      def extract_transaction_pin
        params[:transaction_pin].presence ||
          params.dig(:wallet, :transaction_pin).presence ||
          ''
      end
    end
  end
end
