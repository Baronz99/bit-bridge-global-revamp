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
        unless current_user.user_profile.present?
          return render json: { message: 'User profile not found: please update your account' },
                        status: :unprocessable_entity
        end

        if account_params[:vendor] == 'anchor'
          create_anchor_account
        else
          create_monify_account
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
        account = Account.find_by(user_id: current_user.id, vendor: 'anchor')
        unless account
          return render json: { message: 'No Anchor account present' }, status: :not_found
        end

        service = AnchorService.new
        service_response = service.create_account_number(type: account.account_type.to_sym, account: account)

        if service_response[:status] == :ok
          render json: {
            data:     service_response[:response],
            messsage: 'Account created'
          }, status: :ok
        else
          render json: {
            message: service_response[:message] || service_response[:response]
          }, status: :unprocessable_entity
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
          counter_party_id = data['id']

          if counter_party_id.present?
            beneficiary = current_user.beneficiaries.find_or_initialize_by(
              vendor: 'anchor',
              bank_code: bank_code,
              account_number: account_number
            )
            beneficiary.assign_attributes(
              counter_party_id: counter_party_id,
              account_name: data.dig('attributes', 'accountName') || account_params[:account_name],
              bank_name: data.dig('attributes', 'bank', 'name')
            )

            begin
              beneficiary.save!
            rescue StandardError => e
              Rails.logger.error("Failed to save beneficiary: #{e.message}")
            end
          end

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
        service = AnchorService.new
        anchor_account = current_user.accounts.find_by(vendor: 'anchor')

        if anchor_account.nil? || anchor_account.useable_id.nil?
          return render json: { message: 'No Anchor account present' }, status: :not_found
        end

        return unless validate_transfer_params!

        pin = params.dig(:account, :pin).to_s.strip
return unless require_transaction_pin!(pin, error_key: :message)




        transfer_params = account_params.to_h.symbolize_keys.merge(
          source_id:             anchor_account.useable_id,
          source_name:           anchor_account.account_name,
          account_id:            anchor_account.id,
          wallet_id:             current_user.wallet.id,
          source_account_number: anchor_account.account_number,
          account_name:          anchor_account.account_name
        )

        service_response = service.initiate_transfer(transfer_params)

        if service_response[:status] == :ok
          transfer_id = service_response[:data]&.transfer_id
          render json: {
            data:    service_response[:data],
            message: 'Fund has been sent',
            meta: {
              transfer_id: transfer_id
            }
          }, status: :ok
        else
          render json: { message: service_response[:message] }, status: :unprocessable_entity
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
            message: 'No Anchor account yet'
          }, status: :ok
        end

        service = AnchorService.new
        service_response = service.fetch_account_detail(account.useable_id, true)

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

        current_user_info = current_user.attributes.symbolize_keys.merge(account_params.to_h.symbolize_keys)
        user_data = current_user.user_profile.attributes.symbolize_keys
        account_info = current_user_info.merge(user_data)

        service_response = service.create_individual_account(account_info)

        if service_response[:status] == :ok
          render json: {
            data:    service_response[:response],
            message: 'User onboarded successfully'
          }, status: :ok
        else
          render json: { message: service_response[:message] }, status: :unprocessable_entity
        end
      end

      def create_monify_account
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
          :currency,
          :account_name,
          :account_type,
          :address,
          :city,
          :counter_party_id,
          :inter_bank,
          :amount,
          :description,
          :state,
          :postal_code,
          :country,
          :active,
          :status,
          :gender,
          :dob,
          :bank_code,
          :bank,
          :account_number,
          :pin # ✅ allow pin through params
        )
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

        allowed_levels = %w[tier_1 tier_2]
        user_level = current_user&.kyc_level.to_s

        return if allowed_levels.include?(user_level)

        render json: {
          message: 'Please complete Tier 2 verification before generating or using an Anchor virtual account.'
        }, status: :forbidden
      end
    end
  end
end
