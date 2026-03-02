# frozen_string_literal: true

module Api
  module V1
    class WalletsController < ApplicationController
      before_action :set_wallet, only: %i[show update destroy]
      before_action :disable_client_cache, only: %i[user]
      after_action :strip_cache_validators, only: %i[user]
      before_action :ensure_tier2!,
                    only: %i[
                      activate_tunnel
                      convert_ngn_to_usd
                      quote_ngn_to_usd
                      convert_usd_to_ngn
                      quote_usd_to_ngn
                    ],
                    message: 'Complete Tier 2 verification to use the Tunnel wallet.'

      def index
        wallets =
          if current_user&.admin || current_user&.role == 'super_admin'
            Wallet.for_api
          else
            current_user.wallets.for_api
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
        bridge = current_user.wallets.for_api.find(bridge.id) if bridge

        # do not auto-create USD unless already present (optional)
        tunnel = current_user.wallets.for_api.find_by(wallet_type: :usd)

        wallets = [bridge, tunnel].compact

        render json: {
          data: {
            bridge: wallet_summary(bridge),
            tunnel: tunnel ? wallet_summary(tunnel) : nil,
            wallets: wallets.map { |w| wallet_summary(w) }
          }
        }, status: :ok
      end

      # ✅ Creates/returns USD wallet for Tunnel
      # POST /api/v1/wallets/tunnel/activate
      def activate_tunnel
        usd_wallet = current_user.usd_wallet
        usd_wallet = current_user.wallets.for_api.find(usd_wallet.id)

        render json: {
          message: 'Tunnel wallet activated',
          data: WalletSerializer.new(usd_wallet).as_json
        }, status: :ok
      end

      # ✅ Convert NGN -> USD (atomic) using FxDesk pricing
      # POST /api/v1/wallets/tunnel/convert
      #
      # Accepts body in either form:
      # { amount_ngn: 15000, transaction_pin: "1234" }
      # OR
      # { wallet: { amount_ngn: 15000, transaction_pin: "1234" } }
      def convert_ngn_to_usd
        amount_ngn = extract_amount_ngn
        raw_pin = extract_transaction_pin
        amount_in_expected = FxDesk::Money.ngn(amount_ngn)
        fx_quote = nil
        quote_data = nil
        token_present = extract_quote_token.present?
        if token_present
          ActiveRecord::Base.transaction do
            fx_quote = fetch_fx_quote('ngn_to_usd', expected_amount: amount_in_expected, tolerance: 1, lock: true)
            return if fx_quote == :invalid
            quote_data = quote_from_record(fx_quote)
            if fx_quote.executed_at.present?
              render_conversion_replay(current_user.ngn_wallet, current_user.usd_wallet, quote_data, fx_quote)
              return
            end
          end
          return if performed?
        else
          quote_data = FxDesk::Pricing.new.quote_ngn_to_usd(amount_ngn)
        end

        amount_in = quote_data[:amount_in].to_d
        amount_out = quote_data[:amount_out].to_d

        return render json: { message: 'amount_ngn must be greater than 0' }, status: :unprocessable_entity if amount_in <= 0

        # dY"? PIN gate
        return unless require_transaction_pin!(raw_pin)

        ngn_wallet = current_user.ngn_wallet
        usd_wallet = current_user.usd_wallet

        # Ensure balance check uses legacy computed NGN balance (no regression)
        if amount_in > ngn_wallet.balance.to_d
          return render json: { message: 'insufficient balance' }, status: :unprocessable_entity
        end

        usd_cents = usd_wallet.money_to_cents(amount_out)
        return render json: { message: 'conversion failed' }, status: :unprocessable_entity if usd_cents <= 0

        execution_reference = fx_quote.present? ? SecureRandom.uuid : nil

        ActiveRecord::Base.transaction do
          if fx_quote
            fx_quote = FxQuote.lock('FOR UPDATE').find(fx_quote.id)
            if fx_quote.executed_at.present?
              render_conversion_replay(ngn_wallet, usd_wallet, quote_data, fx_quote)
              raise ActiveRecord::Rollback
            end
          end

          # Record NGN withdrawal transaction (legacy structure)
          ngn_wallet.transactions.create!(
            transaction_type: 'withdrawal',
            status: 'approved',
            amount: amount_in,
            coin_type: 'bank',
            address: 'Tunnel Conversion (NGN to USD)',
            metadata: fx_quote.present? ? { fx_quote_token: fx_quote.token, fx_execution_reference: execution_reference } : {}
          )

          # Credit USD stored balance
          usd_wallet.credit_cents!(usd_cents)

          # Record USD deposit transaction
          usd_wallet.transactions.create!(
            transaction_type: 'deposit',
            status: 'approved',
            amount: amount_out,
            coin_type: 'bank',
            address: 'Tunnel Conversion (NGN to USD)',
            metadata: fx_quote.present? ? { fx_quote_token: fx_quote.token, fx_execution_reference: execution_reference } : {}
          )

          fx_quote&.update!(
            executed_at: Time.current,
            execution_reference: execution_reference
          )
        end
        return if performed?

        # Re-fetch to ensure updated balances/transactions reflected
        ngn_wallet = current_user.wallets.for_api.find(ngn_wallet.id)
        usd_wallet = current_user.wallets.for_api.find(usd_wallet.id)

        render json: {
          message: 'Conversion successful',
          data: {
            ngn_wallet: WalletSerializer.new(ngn_wallet).as_json,
            usd_wallet: WalletSerializer.new(usd_wallet).as_json,
            quote: serialize_quote(quote_data).merge(quote_token: fx_quote&.token)
          }
        }, status: :ok
      end

      # ✅ Quote NGN -> USD conversion (no PIN, no transfer)
      # POST /api/v1/wallets/tunnel/quote
      # Body: { amount_ngn }
      def quote_ngn_to_usd
        amount_ngn = extract_amount_ngn
        return render json: { message: 'amount_ngn must be greater than 0' }, status: :unprocessable_entity if amount_ngn <= 0

        quote_data = FxDesk::Pricing.new.quote_ngn_to_usd(amount_ngn)
        fx_quote = persist_fx_quote(quote_data, 'ngn_to_usd')

        render json: serialize_quote(quote_data).merge(quote_token: fx_quote.token), status: :ok
      end

      # ✅ Convert USD -> NGN (atomic) using FxDesk pricing
      # POST /api/v1/wallets/tunnel/convert-back
      #
      # Accepts body in either form:
      # { amount_usd: 25, transaction_pin: "1234" }
      # OR
      # { wallet: { amount_usd: 25, transaction_pin: "1234" } }
      def convert_usd_to_ngn
        amount_usd = extract_amount_usd
        raw_pin = extract_transaction_pin
        amount_in_expected = FxDesk::Money.usd(amount_usd)
        fx_quote = nil
        quote_data = nil
        token_present = extract_quote_token.present?
        if token_present
          ActiveRecord::Base.transaction do
            fx_quote = fetch_fx_quote('usd_to_ngn', expected_amount: amount_in_expected, tolerance: 0.01, lock: true)
            return if fx_quote == :invalid
            quote_data = quote_from_record(fx_quote)
            if fx_quote.executed_at.present?
              render_conversion_replay(current_user.ngn_wallet, current_user.usd_wallet, quote_data, fx_quote)
              return
            end
          end
          return if performed?
        else
          quote_data = FxDesk::Pricing.new.quote_usd_to_ngn(amount_usd)
        end

        amount_in = quote_data[:amount_in].to_d
        amount_out = quote_data[:amount_out].to_d

        return render json: { message: 'amount_usd must be greater than 0' }, status: :unprocessable_entity if amount_in <= 0

        # PIN gate
        return unless require_transaction_pin!(raw_pin)

        ngn_wallet = current_user.ngn_wallet
        usd_wallet = current_user.usd_wallet

        usd_cents = usd_wallet.money_to_cents(amount_in)
        return render json: { message: 'conversion failed' }, status: :unprocessable_entity if usd_cents <= 0

        execution_reference = fx_quote.present? ? SecureRandom.uuid : nil

        ActiveRecord::Base.transaction do
          if fx_quote
            fx_quote = FxQuote.lock('FOR UPDATE').find(fx_quote.id)
            if fx_quote.executed_at.present?
              render_conversion_replay(ngn_wallet, usd_wallet, quote_data, fx_quote)
              raise ActiveRecord::Rollback
            end
          end

          # Record USD withdrawal transaction
          usd_wallet.transactions.create!(
            transaction_type: 'withdrawal',
            status: 'approved',
            amount: amount_in,
            coin_type: 'bank',
            address: 'Tunnel Conversion (USD to NGN)',
            metadata: fx_quote.present? ? { fx_quote_token: fx_quote.token, fx_execution_reference: execution_reference } : {}
          )

          # Debit USD stored balance
          usd_wallet.debit_cents!(usd_cents)

          # Record NGN deposit transaction (legacy structure)
          ngn_wallet.transactions.create!(
            transaction_type: 'deposit',
            status: 'approved',
            amount: amount_out,
            coin_type: 'bank',
            address: 'Tunnel Conversion (USD to NGN)',
            metadata: fx_quote.present? ? { fx_quote_token: fx_quote.token, fx_execution_reference: execution_reference } : {}
          )

          fx_quote&.update!(
            executed_at: Time.current,
            execution_reference: execution_reference
          )
        end
        return if performed?

        ngn_wallet = current_user.wallets.for_api.find(ngn_wallet.id)
        usd_wallet = current_user.wallets.for_api.find(usd_wallet.id)

        render json: {
          message: 'Conversion successful',
          data: {
            ngn_wallet: WalletSerializer.new(ngn_wallet).as_json,
            usd_wallet: WalletSerializer.new(usd_wallet).as_json,
            quote: serialize_quote(quote_data).merge(quote_token: fx_quote&.token)
          }
        }, status: :ok
      end

      # ✅ Quote USD -> NGN conversion (no PIN, no transfer)
      # POST /api/v1/wallets/tunnel/quote-back
      # Body: { amount_usd }
      def quote_usd_to_ngn
        amount_usd = extract_amount_usd
        return render json: { message: 'amount_usd must be greater than 0' }, status: :unprocessable_entity if amount_usd <= 0

        quote_data = FxDesk::Pricing.new.quote_usd_to_ngn(amount_usd)
        fx_quote = persist_fx_quote(quote_data, 'usd_to_ngn')

        render json: serialize_quote(quote_data).merge(quote_token: fx_quote.token), status: :ok
      end

      # POST /api/v1/wallets/send_money
      # Body:
      # { transfer: { phone_number: "080...", amount: 1500, transaction_pin: "1234", description: "..." } }
      # OR root params: { phone_number, amount, transaction_pin, description }
      def send_money
        amount = extract_transfer_amount
        raw_pin = extract_transaction_pin
        phone_raw = extract_transfer_phone
        description = extract_transfer_description

        return render json: { message: 'amount must be greater than 0' }, status: :unprocessable_entity if amount <= 0
        return render json: { message: 'phone_number is required' }, status: :unprocessable_entity if phone_raw.blank?

        return unless require_transaction_pin!(raw_pin)

        recipient_profile = find_recipient_profile(phone_raw)
        return render json: { message: 'Recipient not found' }, status: :not_found if recipient_profile.blank?

        recipient_user = recipient_profile.user
        if recipient_user.id == current_user.id
          return render json: { message: 'You cannot send money to yourself' }, status: :unprocessable_entity
        end

        sender_wallet = current_user.ngn_wallet
        recipient_wallet = recipient_user.ngn_wallet

        sender_label = current_user.user_profile&.phone_number.presence || current_user.email
        recipient_label = recipient_profile.phone_number.presence || phone_raw
        narrative = description.presence || "BitBridge transfer to #{recipient_label}"

        ActiveRecord::Base.transaction do
          sender_wallet.transactions.create!(
            transaction_type: 'withdrawal',
            status: 'approved',
            amount: amount,
            coin_type: 'bank',
            address: narrative
          )

          recipient_wallet.transactions.create!(
            transaction_type: 'deposit',
            status: 'approved',
            amount: amount,
            coin_type: 'bank',
            address: "BitBridge transfer from #{sender_label}"
          )
        end

        sender_wallet = current_user.wallets.for_api.find(sender_wallet.id)
        recipient_wallet = recipient_user.wallets.for_api.find(recipient_wallet.id)

        render json: {
          message: 'Transfer successful',
          data: {
            sender_wallet: WalletSerializer.new(sender_wallet).as_json,
            recipient_wallet: WalletSerializer.new(recipient_wallet).as_json
          }
        }, status: :ok
      end

      def create
        wallet = Wallet.new(wallet_params)
        if wallet.save
          wallet = Wallet.for_api.find(wallet.id)
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

      def disable_client_cache
        expires_now
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        response.cache_control.clear
      end

      def strip_cache_validators
        response.headers.delete('ETag')
        response.headers.delete('Last-Modified')
      end

      def set_wallet
        @wallet = Wallet.for_api.find(params[:id])
      end

      def wallet_summary(wallet)
        return nil unless wallet

        {
          id: wallet.id,
          wallet_type: wallet.wallet_type,
          currency: wallet.currency,
          balance: wallet.balance,
          balance_cents: wallet.usd? ? wallet.balance_cents.to_i : nil,
          available_balance: wallet.ngn? ? wallet.ledger_available_balance.to_f : wallet.cents_to_money(wallet.balance_cents).to_f,
          book_balance: wallet.balance.to_f,
          outstanding_hold: wallet.respond_to?(:ledger_outstanding_hold) ? wallet.ledger_outstanding_hold.to_f : 0.0,
          commission: wallet.commission,
          reward_balance: wallet.user_id.present? ? RewardTransaction.available_sum_for(wallet.user_id).to_f : 0.0
        }.compact
      end

      def wallet_params
        params.require(:wallet).permit(:user_id, :wallet_type, :currency)
      end

      def extract_quote_token
        params[:quote_token].presence ||
          params.dig(:wallet, :quote_token).presence ||
          ''
      end

      def fetch_fx_quote(direction, expected_amount: nil, tolerance: 0, lock: false)
        token = extract_quote_token
        return nil if token.blank?

        scope = FxQuote.valid_token(token).where(user_id: current_user.id)
        scope = scope.lock('FOR UPDATE') if lock
        quote = scope.find_by(user_id: current_user.id)
        if quote.blank? || quote.direction != direction
          render json: { message: 'Invalid or expired quote', errors: { quote_token: 'invalid' } },
                 status: :unprocessable_entity
          return :invalid
        end

        if expected_amount && (quote.amount_in.to_d - expected_amount.to_d).abs > tolerance.to_d
          render json: {
            message: 'Quote amount mismatch',
            errors: {
              amount_in: 'does not match quote'
            }
          }, status: :unprocessable_entity
          return :invalid
        end

        quote
      end

      def render_conversion_replay(ngn_wallet, usd_wallet, quote_data, fx_quote)
        ngn_wallet = current_user.wallets.for_api.find(ngn_wallet.id)
        usd_wallet = current_user.wallets.for_api.find(usd_wallet.id)

        render json: {
          message: 'Conversion already processed',
          data: {
            ngn_wallet: WalletSerializer.new(ngn_wallet).as_json,
            usd_wallet: WalletSerializer.new(usd_wallet).as_json,
            quote: serialize_quote(quote_data).merge(quote_token: fx_quote&.token),
            replayed: true
          }
        }, status: :ok
      end

      def quote_from_record(record)
        from, to = quote_pair_for(record.direction)

        {
          from: from,
          to: to,
          base_rate: record.base_rate,
          markup: record.markup,
          execution_rate: record.execution_rate,
          fee_amount: record.fee_amount,
          fee_currency: record.fee_currency,
          amount_in: record.amount_in,
          amount_after_fee: record.amount_after_fee,
          amount_out: record.amount_out,
          as_of: record.created_at
        }
      end

      def persist_fx_quote(quote_data, direction)
        FxQuote.create!(
          user: current_user,
          direction: direction,
          base_rate: quote_data[:base_rate],
          markup: quote_data[:markup],
          execution_rate: quote_data[:execution_rate],
          base_rate_raw: quote_data[:base_rate_raw],
          markup_raw: quote_data[:markup_raw],
          execution_rate_raw: quote_data[:execution_rate_raw],
          fee_amount: quote_data[:fee_amount],
          fee_amount_raw: quote_data[:fee_amount_raw],
          fee_currency: quote_data[:fee_currency],
          amount_in: quote_data[:amount_in],
          amount_in_raw: quote_data[:amount_in_raw],
          amount_after_fee: quote_data[:amount_after_fee],
          amount_after_fee_raw: quote_data[:amount_after_fee_raw],
          amount_out: quote_data[:amount_out],
          amount_out_raw: quote_data[:amount_out_raw],
          expires_at: 5.minutes.from_now
        )
      end

      def serialize_quote(quote_data)
        {
          from: quote_data[:from],
          to: quote_data[:to],
          amount_in: quote_data[:amount_in].to_f,
          fee_amount: quote_data[:fee_amount].to_f,
          fee_currency: quote_data[:fee_currency],
          amount_after_fee: quote_data[:amount_after_fee].to_f,
          base_rate: quote_data[:base_rate].to_f,
          markup: quote_data[:markup].to_f,
          execution_rate: quote_data[:execution_rate].to_f,
          amount_out: quote_data[:amount_out].to_f,
          as_of: quote_data[:as_of]&.iso8601
        }
      end

      def quote_pair_for(direction)
        direction == 'ngn_to_usd' ? ['NGN', 'USD'] : ['USD', 'NGN']
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

      def extract_transfer_amount
        raw =
          params[:amount].presence ||
          params.dig(:transfer, :amount).presence ||
          params.dig(:wallet, :amount).presence

        raw.to_d
      rescue StandardError
        0.to_d
      end

      def extract_transfer_phone
        params[:phone_number].presence ||
          params.dig(:transfer, :phone_number).presence ||
          params.dig(:wallet, :phone_number).presence ||
          ''
      end

      def extract_transfer_description
        params[:description].presence ||
          params.dig(:transfer, :description).presence ||
          ''
      end

      def find_recipient_profile(phone_raw)
        e164 = PhoneNormalizer.to_e164_ng(phone_raw)
        variants = [phone_raw.to_s.strip, e164, e164 ? "+#{e164}" : nil].compact.uniq

        UserProfile
          .where(phone_e164: variants)
          .or(UserProfile.where(phone_number: variants))
          .includes(:user)
          .first
      end
    end
  end
end
