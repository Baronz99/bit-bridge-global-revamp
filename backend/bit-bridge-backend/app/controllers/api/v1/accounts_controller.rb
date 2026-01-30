# frozen_string_literal: true

module Api
  module V1
    class AccountsController < ApplicationController
      before_action :set_account, only: %i[show update destroy]

      # 🔒 Require Tier 2+ for *state-changing* Anchor flows only
      before_action :ensure_anchor_kyc!,
                    only: %i[
                      create
                      get_account_number
                      initiate_fund_transfer
                      verify_kyc
                      create_counter_party
                    ]
      before_action :ensure_tier2!,
                    only: %i[initiate_fund_transfer],
                    message: 'Complete Tier 2 verification to make transfers.'

      def index
        @accounts = Account.all
        render json: { data: ActiveModelSerializers::SerializableResource.new(@accounts) }, status: :ok
      end

      def user_accounts
        @accounts = current_user.accounts.all
        render json: { data: ActiveModelSerializers::SerializableResource.new(@accounts) }, status: :ok
      end

      def create
        if account_params[:vendor] == 'anchor'
          create_anchor_account
        else
          render json: { message: 'Monnify account creation is disabled.' }, status: :unprocessable_entity
        end
      end

      def verify_kyc
        account = Account.find_by(user_id: current_user.id, vendor: 'anchor')
        unless account
          return render json: { message: 'No Anchor account present' }, status: :not_found
        end

        service = AnchorService.new
        service_response = service.user_kyc_verification(account_params, account)

        if service_response[:status] == :ok
          render json: {
            data:     service_response[:response],
            messsage: service_response[:message]
          }, status: :ok
        else
          render json: { message: service_response[:message] }, status: :unprocessable_entity
        end
      end

      def get_account_number
        account = current_user.accounts.find_by(vendor: 'anchor')
        unless account
          log_anchor_account_number_failure(
            status: :not_found,
            code: 'anchor_account_missing',
            message: 'No Anchor account present',
            account_id: nil
          )
          return render json: anchor_error_payload('anchor_account_missing', 'No Anchor account present', retryable: false),
                        status: :not_found
        end

        service = AnchorService.new
        service_response = service.create_account_number(type: account.account_type.to_sym, account: account)

        if service_response[:status] == :ok
          unless account.reload.account_number.present?
            code = 'anchor_account_number_failed'
            log_anchor_account_number_failure(
              status: :unprocessable_entity,
              code: code,
              message: 'Anchor did not return an account number',
              account_id: account.id,
              retryable: true,
              provider_status: service_response[:provider_status],
              provider_body: service_response[:provider_body]
            )
            return render json: anchor_error_payload(code, 'Anchor did not return an account number', retryable: true),
                          status: :unprocessable_entity
          end
          render json: {
            data:     service_response[:response],
            messsage: 'Account created'
          }, status: :ok
        else
          raw_message = service_response[:message] || service_response[:response]
          provider_status = service_response[:provider_status]
          provider_body = service_response[:provider_body]
          code, retryable = map_anchor_account_number_error(raw_message, provider_body)

          log_anchor_account_number_failure(
            status: :unprocessable_entity,
            code: code,
            message: raw_message,
            account_id: account.id,
            retryable: retryable,
            provider_status: provider_status,
            provider_body: provider_body
          )

          render json: anchor_error_payload(code, raw_message, retryable: retryable),
                 status: :unprocessable_entity
        end
      end

      def show
        service = AccountService.new
        service_response = service.get_wallet_account(params[:id])

        if service_response[:status] == :ok
          render json: { data: service_response[:response] }, status: :ok
        else
          render json: { message: service_response[:message] }, status: :unprocessable_entity
        end
      end

      def get_banks
        service = AnchorService.new
        service_response = service.fetch_bank_list

        if service_response[:status] == :ok
          render json: {
            data:     service_response[:data],
            messsage: 'Bank fetched'
          }, status: :ok
        else
          render json: { message: service_response[:message] }, status: :unprocessable_entity
        end
      rescue RuntimeError => e
        if e.message.to_s.include?('Missing ANCHOR_')
          render json: {
            message: 'Anchor is not configured. Showing empty bank list.',
            warning: e.message.to_s,
            data: []
          }, status: :ok
        else
          raise
        end
      end

      def beneficiaries
        items = current_user.beneficiaries.order(created_at: :desc)

        data = items.map do |item|
          {
            id: item.id,
            vendor: item.vendor,
            bank_code: item.bank_code,
            bank_name: item.bank_name,
            account_number: item.account_number,
            account_name: item.account_name,
            counter_party_id: item.counter_party_id,
            created_at: item.created_at
          }
        end

        render json: { data: data }, status: :ok
      end

      def verify_account
        service = AccountService.new
        service_response = service.verify_account

        if service_response[:status] == :ok
          render json: {
            data:     service_response[:response],
            messsage: 'Bank fetched'
          }, status: :ok
        else
          render json: { message: service_response[:message] }, status: :unprocessable_entity
        end
      end

      def verify_transfer
        transfer_id = params[:transfer_id]
        return render json: { message: 'transfer_id is required' }, status: :unprocessable_entity if transfer_id.blank?

        service = AccountService.new
        service_response = service.verify_transfer_request(transfer_id)

        if service_response[:status] == :ok
          render json: {
            data:     service_response[:response],
            messsage: 'Bank fetched'
          }, status: :ok
        else
          render json: { message: service_response[:message] }, status: :unprocessable_entity
        end
      end

      def create_counter_party
        bank_code = account_params[:bank_code]
        account_number = account_params[:account_number]

        if bank_code.blank? || account_number.blank?
          return render json: { message: 'bank_code and account_number are required' },
                        status: :unprocessable_entity
        end

        unless account_number.to_s.strip.match?(/\A\d{10}\z/)
          return render json: { message: 'account_number must be 10 digits' },
                        status: :unprocessable_entity
        end

        existing = current_user.beneficiaries.find_by(
          vendor: 'anchor',
          bank_code: bank_code,
          account_number: account_number
        )

        if existing&.counter_party_id.present?
          return render json: {
            data:     existing.counter_party_payload,
            messsage: 'Counter Party fetched'
          }, status: :ok
        end

        service = AnchorService.new
        service_response = service.create_counter_party(account_params)

        if service_response[:status] == :ok
          data = service_response[:data] || {}

          render json: {
            data:     data,
            messsage: 'Counter Party created'
          }, status: :ok
        else
          render json: { message: service_response[:message] }, status: :unprocessable_entity
        end
      end

      # ✅ PIN enforced here (with lockouts)
      def initiate_fund_transfer
        anchor_account = current_user.accounts.find_by(vendor: 'anchor')

        if anchor_account.nil? || anchor_account.useable_id.nil?
          return render json: { message: 'No Anchor account present' }, status: :not_found
        end

        return unless validate_transfer_params!

        pin = params.dig(:account, :pin).to_s.strip
        return unless require_transaction_pin!(pin, error_key: :message)
        bool = ActiveModel::Type::Boolean.new
        transfer_params = account_params.to_h.symbolize_keys.merge(
          source_id:             anchor_account.useable_id,
          source_name:           anchor_account.account_name,
          account_id:            anchor_account.id,
          wallet_id:             current_user.ngn_wallet.id,
          source_account_number: anchor_account.account_number,
          account_name:          anchor_account.account_name
        )
        transfer_params[:inter_bank] = bool.cast(transfer_params[:inter_bank])
        transfer_params[:save_beneficiary] = bool.cast(transfer_params[:save_beneficiary])
        transfer_params[:counter_party_id] =
          params[:counter_party_id].presence ||
          params.dig(:account, :counter_party_id).presence ||
          transfer_params[:counter_party_id]

        if !transfer_params[:inter_bank] && transfer_params[:counter_party_id].blank?
          counter_party_response = AnchorService.new.create_counter_party(transfer_params)
          if counter_party_response[:status] != :ok
            return render json: { message: counter_party_response[:message] || 'Unable to resolve beneficiary' },
                          status: :unprocessable_entity
          end

          counter_party_id = counter_party_response.dig(:data, 'id')
          if counter_party_id.blank?
            return render json: { message: 'Unable to resolve beneficiary' }, status: :unprocessable_entity
          end

          transfer_params[:counter_party_id] = counter_party_id
          transfer_params[:bank] = counter_party_response.dig(:data, 'attributes', 'bank', 'name') || transfer_params[:bank]
          transfer_params[:account_name] =
            counter_party_response.dig(:data, 'attributes', 'accountName') || transfer_params[:account_name]
        end

        narration = transfer_params[:description].presence || 'Fund Transfer'
        transfer_reference =
          params[:transfer_reference].presence ||
          params.dig(:account, :transfer_reference).presence
        result = Transfers::AnchorNgnTransferService.call(
          user: current_user,
          sender_wallet: current_user.ngn_wallet,
          amount_ngn: transfer_params[:amount],
          bank_payload: transfer_params,
          narration: narration,
          transfer_reference: transfer_reference
        )

        render json: result[:body], status: result[:status]

        transfer_status = result.dig(:body, :status).to_s
        should_save = bool.cast(params[:save_beneficiary].presence || params.dig(:account, :save_beneficiary))
        insufficient_funds =
          result[:status] == :unprocessable_entity &&
          result.dig(:body, :message).to_s.include?('Insufficient balance.')

        if should_save &&
            ((result[:status] == :ok && %w[pending approved].include?(transfer_status)) || insufficient_funds)
          upsert_beneficiary_if_requested!(transfer_params)
        end
      end

      def resolve
        account_number =
          params[:account_number].presence ||
          params.dig(:account, :account_number).presence
        bank_code =
          params[:bank_code].presence ||
          params.dig(:account, :bank_code).presence

        if bank_code.blank?
          return render json: { message: 'bank_code is required' }, status: :unprocessable_entity
        end

        unless account_number.to_s.strip.match?(/\A\d{10}\z/)
          return render json: { message: 'account_number must be 10 digits' },
                        status: :unprocessable_entity
        end

        service = AnchorService.new
        service_response = service.resolve_account_name(bank_code, account_number)

        if service_response[:status] == :ok
          render json: {
            account_name: service_response[:account_name],
            bank_name: service_response[:bank_name],
            bank_code: bank_code
          }, status: :ok
        else
          render json: { message: service_response[:message] || 'Account not found' },
                 status: :unprocessable_entity
        end
      end

      def get_account(user_id = nil)
        accout_ref = params[:accountReference] || user_id

        service = AccountService.new
        service_response = service.get_reserved_account(accout_ref)

        if service_response[:status] == :ok
          render json: { data: service_response[:response] }, status: :ok
        else
          render json: { message: service_response[:message] }, status: :unprocessable_entity
        end
      end

      def get_user_account_detail
        account = Account.find_by(user_id: current_user.id, vendor: 'anchor')

        # 👇 New behaviour: if there is *no* Anchor account yet, that's OK.
        # We return 200 with data: null so the frontend can quietly show
        # "no Anchor account yet" instead of a red error toast.
        unless account
          return render json: {
            data:    nil,
            message: 'No Anchor account yet',
            has_anchor_account: false
          }, status: :ok
        end

        service = AnchorService.new
        service_response = service.fetch_account_detail(account.useable_id, true)

        if service_response[:status] == :ok
          render json: {
            data:     service_response[:data],
            messsage: 'Account Numbers fetched',
            has_anchor_account: true
          }, status: :ok
        else
          render json: {
            message: service_response[:message] || service_response[:response]
          }, status: :unprocessable_entity
        end
      end

      def get_account_details
        service = AnchorService.new
        service_response = service.fetch_all_account_details

        if service_response[:status] == :ok
          render json: {
            data:     service_response[:data],
            messsage: 'Account Numbers fetched'
          }, status: :ok
        else
          render json: {
            message: service_response[:message] || service_response[:response]
          }, status: :unprocessable_entity
        end
      end

      def update
        service = AccountService.new
        service_response = service.update_wallet_account(params[:id], account_params)

        if service_response[:status] == :ok
          render json: { data: service_response[:response] }, status: :ok
        else
          render json: { message: service_response[:message] }, status: :unprocessable_entity
        end
      end

      def destroy
        service = AccountService.new
        service_response = service.delete_wallet_account(params[:id])

        if service_response[:status] == :ok
          render json: { message: 'Account deleted successfully' }, status: :ok
        else
          render json: { message: service_response[:message] }, status: :unprocessable_entity
        end
      end

      def create_anchor_account
        service = AnchorService.new

        account_info = AnchorOnboardingMapper.build_account_info(
          user: current_user,
          account_params: account_params
        )

        missing_fields = anchor_onboarding_missing_fields(account_info)
        log_anchor_onboarding_fields(account_info, missing_fields)
        if missing_fields.any?
          return render json: {
            message: 'Complete your profile to create an Anchor account.',
            error_code: 'ANCHOR_ONBOARDING_INCOMPLETE',
            missing_fields: missing_fields
          }, status: :unprocessable_entity
        end

        log_anchor_onboarding_will_call(account_info)
        service_response = service.create_individual_account(account_info)

        if service_response[:status] == :ok
          render json: {
            data:    service_response[:response],
            message: 'User onboarded successfully'
          }, status: :ok
        else
          duplicate_phone_error = duplicate_anchor_phone_error?(service_response[:message])
          if duplicate_phone_error
            log_anchor_onboarding_error(
              code: 'ANCHOR_PHONE_EXISTS',
              phone: account_info[:phone_number],
              debug_message: service_response[:message]
            )
            return render json: {
              message: 'This phone number already exists in Anchor Sandbox.',
              error_code: 'ANCHOR_PHONE_EXISTS'
            }, status: :conflict
          end

          render json: { message: 'Unable to create Anchor account.' }, status: :unprocessable_entity
        end
      end

      def create_monify_account
        render json: { message: 'Monnify account creation is disabled.' }, status: :unprocessable_entity and return

        service = AccountService.new

        account_info = {
          vendor:        account_params[:vendor] || 'monnify',
          bvn:           account_params[:bvn],
          user_id:       current_user.id,
          email:         current_user.email,
          account_name:  account_params[:account_name] || current_user.full_name,
          customer_name: current_user.full_name,
          currency:      account_params[:currency] || 'NGN'
        }

        service_response = service.create_wallet_account(account_info)

        if service_response[:status] == :ok
          render json: {
            data:    service_response[:response],
            message: 'Account created successfully'
          }, status: :ok
        else
          render json: { message: service_response[:message] }, status: :unprocessable_entity
        end
      end

      private

      def set_account
        @accout = Account.find_by(id: params[:id])
        return if @accout

        render json: { message: 'Account not found' }, status: :not_found
      end

      # Strong params
      def account_params
        params.require(:account).permit(
          :vendor,
          :bvn,
          :bvn_number,
          :currency,
          :account_name,
          :account_type,
          :address,
          :address_line_1,
          :addressLine1,
          :addressLine_1,
          :street,
          :street_address,
          :residential_address,
          :city,
          :lga_city,
          :town,
          :counter_party_id,
          :inter_bank,
          :amount,
          :description,
          :state,
          :state_of_residence,
          :province,
          :region,
          :postal_code,
          :postcode,
          :zip,
          :zip_code,
          :country,
          :active,
          :status,
          :gender,
          :dob,
          :date_of_birth,
          :birthdate,
          :bank_code,
          :bank,
          :account_number,
          :pin,
          :phone,
          :phone_number,
          :mobile,
          :msisdn,
          :first_name,
          :firstname,
          :given_name,
          :last_name,
          :lastname,
          :surname,
          :family_name,
          :email,
          :save_beneficiary,
          :transfer_reference
        )
      end

      def upsert_beneficiary_if_requested!(transfer_params)
        counter_party_id = transfer_params[:counter_party_id]
        return if counter_party_id.blank?

        beneficiary = current_user.beneficiaries.find_or_initialize_by(
          vendor: 'anchor',
          bank_code: transfer_params[:bank_code],
          account_number: transfer_params[:account_number]
        )
        beneficiary.assign_attributes(
          counter_party_id: counter_party_id,
          account_name: transfer_params[:account_name],
          bank_name: transfer_params[:bank] || transfer_params[:bank_name]
        )
        beneficiary.save!
      rescue ActiveRecord::RecordNotUnique
        existing = current_user.beneficiaries.find_by(
          vendor: 'anchor',
          bank_code: transfer_params[:bank_code],
          account_number: transfer_params[:account_number]
        )
        if existing
          existing.update(
            counter_party_id: counter_party_id,
            account_name: transfer_params[:account_name],
            bank_name: transfer_params[:bank] || transfer_params[:bank_name]
          )
        end
      rescue StandardError => e
        Rails.logger.error("Failed to save beneficiary: #{e.message}")
      end

      def anchor_onboarding_missing_fields(account_info)
        required = {
          'first_name' => account_info[:first_name],
          'last_name' => account_info[:last_name],
          'email' => account_info[:email],
          'phone' => account_info[:phone_number],
          'address.addressLine_1' => account_info[:address],
          'address.city' => account_info[:city],
          'address.state' => account_info[:state],
          'address.postalCode' => account_info[:postal_code],
          'bvn' => account_info[:bvn],
          'dob' => account_info[:dob]
        }

        required.select { |_key, value| value.blank? }.keys
      end

      def log_anchor_onboarding_fields(account_info, missing_fields)
        return if Rails.env.production?

        masked = {
          first_name: account_info[:first_name].presence,
          last_name: account_info[:last_name].presence,
          email: account_info[:email].presence,
          phone: mask_phone(account_info[:phone_number]),
          address: account_info[:address].presence,
          city: account_info[:city].presence,
          state: account_info[:state].presence,
          postal_code: account_info[:postal_code].presence,
          bvn: mask_bvn(account_info[:bvn]),
          dob: account_info[:dob].presence
        }

        Rails.logger.info(
          "[Anchor Onboarding] missing_fields=#{missing_fields} values=#{masked}"
        )
      end

      def log_anchor_onboarding_will_call(account_info)
        return if Rails.env.production?

        masked = {
          first_name: account_info[:first_name].presence,
          last_name: account_info[:last_name].presence,
          email: account_info[:email].presence,
          phone: mask_phone(account_info[:phone_number]),
          address: account_info[:address].presence,
          city: account_info[:city].presence,
          state: account_info[:state].presence,
          postal_code: account_info[:postal_code].presence,
          bvn: mask_bvn(account_info[:bvn]),
          dob: account_info[:dob].presence
        }

        Rails.logger.info(
          "[Anchor Onboarding] will_call_anchor=true values=#{masked}"
        )
      end

      def log_anchor_onboarding_error(code:, phone:, debug_message: nil)
        return if Rails.env.production?

        Rails.logger.info(
          "[Anchor Onboarding] error_code=#{code} phone=#{mask_phone(phone)} debug_message=#{debug_message}"
        )
      end

      def mask_phone(phone)
        return nil if phone.blank?

        digits = phone.to_s.gsub(/\D/, '')
        return '*' * digits.length if digits.length <= 4

        masked = digits.gsub(/\d(?=\d{4})/, '*')
        masked
      end

      def mask_bvn(bvn)
        return nil if bvn.blank?

        digits = bvn.to_s.gsub(/\D/, '')
        return '*' * digits.length if digits.length <= 3

        masked = digits.gsub(/\d(?=\d{3})/, '*')
        masked
      end

      def duplicate_anchor_phone_error?(message)
        msg = message.to_s.downcase
        return true if msg.include?('phonenumber already exist in this organization')
        return true if msg.include?('phone number already attached')

        false
      end

      def map_anchor_account_number_error(message, provider_body = nil)
        text = message.to_s.downcase
        body_text = provider_body.to_s.downcase

        return ['anchor_phone_already_exists', false] if duplicate_anchor_phone_error?(text) || duplicate_anchor_phone_error?(body_text)
        return ['anchor_kyc_incomplete', false] if text.include?('kyc') || text.include?('missing') || body_text.include?('kyc')
        return ['provider_unavailable', true] if [text, body_text].any? { |t| t.include?('unavailable') || t.include?('timeout') || t.include?('timed out') || t.include?('503') }

        ['anchor_account_number_failed', true]
      end

      def anchor_error_payload(code, message, retryable:)
        {
          error: code,
          errors: [message.presence || 'Unable to generate account number'],
          meta: {
            provider: 'anchor',
            request_id: request.request_id,
            retryable: retryable
          }
        }
      end

      def log_anchor_account_number_failure(status:, code:, message:, account_id:, retryable: nil, provider_status: nil, provider_body: nil)
        Rails.logger.info(
          {
            event: 'anchor.account_number.failure',
            status: status,
            error: code,
            message: message,
            user_id: current_user&.id,
            account_id: account_id,
            provider: 'anchor',
            provider_status: provider_status,
            provider_body: safe_provider_body(provider_body),
            request_id: request.request_id,
            retryable: retryable
          }.compact
        )
      end

      def safe_provider_body(body)
        return nil if body.nil?

        str = body.is_a?(String) ? body : (body.to_json rescue body.to_s)
        str[0, 1000]
      end

      # ✅ Transaction PIN enforcement with lockouts + attempt tracking (safe if columns don't exist)
      #
      # Returns true to continue, otherwise renders JSON + returns false.
      def validate_transfer_params!
        account_number = account_params[:account_number].to_s.strip
        bank_code = account_params[:bank_code].to_s.strip
        counter_party_id = account_params[:counter_party_id].to_s.strip
        amount = account_params[:amount]
        inter_bank = ActiveModel::Type::Boolean.new.cast(account_params[:inter_bank])

        unless account_number.match?(/\A\d{10}\z/)
          render json: { message: 'account_number must be 10 digits' }, status: :unprocessable_entity
          return false
        end

        if bank_code.blank?
          render json: { message: 'bank_code is required' }, status: :unprocessable_entity
          return false
        end

        if !inter_bank && counter_party_id.blank?
          render json: { message: 'counter_party_id is required for NIP transfers' },
                 status: :unprocessable_entity
          return false
        end

        numeric_amount = amount.to_d rescue nil
        if numeric_amount.nil? || numeric_amount <= 0
          render json: { message: 'amount must be greater than 0' }, status: :unprocessable_entity
          return false
        end

        true
      end

      # 🔒 Anchor KYC guard
      def ensure_anchor_kyc!
        # For create, only enforce when vendor is actually "anchor"
        if action_name == 'create'
          vendor = params.dig(:account, :vendor)
          return unless vendor == 'anchor'
        end

        required_level = 'tier_2'

        return if current_user&.kyc_at_least?(required_level)

        render json: {
          error: 'kyc_required',
          required_level: required_level,
          message: 'Please complete Tier 2 verification before generating or using an Anchor virtual account.'
        }, status: :forbidden
      end
    end
  end
end
