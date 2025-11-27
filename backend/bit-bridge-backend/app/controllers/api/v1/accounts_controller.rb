# frozen_string_literal: true

module Api
  module V1
    class AccountsController < ApplicationController
      before_action :set_account, only: %i[show update destroy]

      # 🔒 Require Tier 1+ for *state-changing* Anchor flows only
      before_action :ensure_anchor_kyc!,
                    only: %i[
                      create
                      get_account_number
                      initiate_fund_transfer
                      verify_kyc
                      create_counter_party
                    ]

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
        return render json: { message: 'transfer_id is required' }, status: :unprocessable_entity

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
        service = AnchorService.new
        service_response = service.create_counter_party(account_params)

        if service_response[:status] == :ok
          render json: {
            data:     service_response[:data],
            messsage: 'Counter Party created'
          }, status: :ok
        else
          render json: { message: service_response[:message] }, status: :unprocessable_entity
        end
      end

      def initiate_fund_transfer
        service = AnchorService.new
        anchor_account = current_user.accounts.find_by(vendor: 'anchor')

        if anchor_account.nil? || anchor_account.useable_id.nil?
          return render json: { message: 'No Anchor account present' }, status: :not_found
        end

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
          render json: {
            data:    service_response[:data],
            message: 'Fund has been sent'
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

      def set_account
        @accout = Account.find_by(id: params[:id])
        return if @accout

        render json: { message: 'Account not found' }, status: :not_found
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
          :account_number
        )
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
          message: 'Please complete Tier 1 verification before generating or using an Anchor virtual account.'
        }, status: :forbidden
      end
    end
  end
end
