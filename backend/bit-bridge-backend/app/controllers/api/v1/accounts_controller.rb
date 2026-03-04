# frozen_string_literal: true

module Api
  module V1
    class AccountsController < ApplicationController
      before_action :set_account, only: %i[show update destroy]

      # 🔒 Require Tier 2+ for *state-changing* Anchor flows only
      before_action :ensure_anchor_kyc!,
                    only: %i[
                      create
                      setup_anchor_onboarding
                      get_account_number
                      provision_account_number
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
        non_anchor_accounts = current_user.accounts.where.not(vendor: 'anchor').to_a
        canonical_anchor = canonical_anchor_account_for(current_user)
        @accounts = canonical_anchor.present? ? (non_anchor_accounts + [canonical_anchor]) : non_anchor_accounts
        begin
          anchor_service = AnchorService.new
          anchor_service.send(:sync_anchor_deposit_account!, canonical_anchor) if canonical_anchor.present?
        rescue StandardError => e
          Rails.logger.warn("[AccountsController] user_accounts anchor sync skipped message=#{e.message}") if defined?(Rails) && Rails.logger
        end
        render json: { data: ActiveModelSerializers::SerializableResource.new(@accounts) }, status: :ok
      end

      def create
        if account_params[:vendor] == 'anchor'
          create_anchor_account
        else
          render json: { message: 'New Monnify/Moniepoint account creation is disabled.' }, status: :unprocessable_entity
        end
      end

      def verify_kyc
        account = canonical_anchor_account_for(current_user)
        unless account
          return render json: anchor_error_payload(
            'anchor_account_missing',
            'No Anchor account present',
            retryable: false
          ), status: :not_found
        end

        request_params = account_params_or_empty
        kyc_payload = resolved_anchor_kyc_payload(request_params, account)
        kyc_missing_fields = anchor_kyc_missing_fields(kyc_payload)
        if kyc_missing_fields.any?
          return render json: anchor_error_payload(
            'anchor_kyc_incomplete',
            'Complete Anchor KYC fields before verification.',
            retryable: false,
            details: { missing_fields: kyc_missing_fields }
          ), status: :unprocessable_entity
        end

        service = AnchorService.new
        service_response = service.user_kyc_verification(kyc_payload, account)

        if service_response[:status] == :ok
          account.reload
          flow = anchor_flow_snapshot(account, has_deposit_account: account.account_number.present?)
          render json: anchor_success_payload(
            data: service_response[:response],
            message: service_response[:message].presence || 'KYC verification submitted',
            flow: flow
          ), status: :ok
        else
          code, retryable = map_anchor_kyc_error(service_response[:message], service_response[:provider_body])
          render json: anchor_error_payload(
            code,
            service_response[:message],
            retryable: retryable,
            details: { provider_status: service_response[:provider_status] }.compact
          ), status: :unprocessable_entity
        end
      end

      # One-call orchestration for Anchor onboarding after platform Tier 2:
      # 1) Ensure Anchor customer exists
      # 2) Ensure Anchor KYC submitted/completed
      # 3) Ensure deposit account number provisioned
      def setup_anchor_onboarding
        request_params = account_params_or_empty
        account = canonical_anchor_account_for(current_user)

        unless account
          account = create_anchor_customer_for_setup(request_params)
          return if performed?
        end

        account = ensure_anchor_kyc_for_setup(account, request_params)
        return if performed?

        # Reuse existing provisioning behavior and response envelope.
        get_account_number
      end

      def get_account_number
        account = canonical_anchor_account_for(current_user)
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

        backfill_anchor_completed_status!(account)

        if account.account_number.present?
          flow = anchor_flow_snapshot(account, has_deposit_account: true)
          return render json: anchor_success_payload(
            data: account,
            message: 'Account already provisioned',
            flow: flow
          ), status: :ok
        end

        unless account.status.to_s == 'completed'
          return render json: anchor_error_payload(
            'anchor_kyc_incomplete',
            'Complete Anchor KYC before generating an account number.',
            retryable: false
          ), status: :unprocessable_entity
        end

        service = AnchorService.new

        # Serialize provisioning attempts per account row so concurrent requests
        # cannot create multiple provider deposit accounts for the same user.
        account.with_lock do
          account.reload

          # If we already have a created deposit account id, avoid creating another one.
          if account.useable_id.present? && account.account_number.blank?
            begin
              service.send(:sync_anchor_deposit_account!, account)
              account.reload
            rescue StandardError => e
              Rails.logger.warn("[AccountsController] account_number sync skipped account_id=#{account.id} message=#{e.message}") if defined?(Rails) && Rails.logger
            end

            if account.account_number.present?
              flow = anchor_flow_snapshot(account, has_deposit_account: true)
              return render json: anchor_success_payload(
                data: account,
                message: 'Account already provisioned',
                flow: flow
              ), status: :ok
            end

            flow = anchor_flow_snapshot(account, has_deposit_account: false)
            return render json: anchor_success_payload(
              data: account,
              message: 'Account provisioning is in progress',
              flow: flow,
              extra: {
                provisioning_pending: true,
                retryable: true,
                retry_after_seconds: 5
              }
            ), status: :accepted
          end

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
            flow = anchor_flow_snapshot(account, has_deposit_account: true)
            render json: anchor_success_payload(
              data: service_response[:response],
              message: 'Account created',
              flow: flow
            ), status: :ok
          elsif service_response[:status] == :accepted
            flow = anchor_flow_snapshot(account.reload, has_deposit_account: false)
            render json: anchor_success_payload(
              data: service_response[:response] || account,
              message: service_response[:message].presence || 'Account provisioning is in progress',
              flow: flow,
              extra: {
                provisioning_pending: true,
                retryable: true,
                retry_after_seconds: 5
              }
            ), status: :accepted
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
      end

      # Preferred verb for state-changing account provisioning.
      # Kept separate to preserve compatibility with existing GET clients.
      def provision_account_number
        get_account_number
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
      def transfer_quote
        current_level = current_user&.kyc_rank.to_i
        required_level = 2
        unless current_level >= required_level
          return render json: {
            message: 'Complete Tier 2 verification to use bank transfer.',
            error_code: 'TIER_INELIGIBLE',
            current_level: current_level,
            required_level: required_level
          }, status: :forbidden
        end

        raw_amount = params[:amount]
        amount = parse_quote_amount(raw_amount)
        if amount.nil? || amount <= 0
          return render json: {
            message: 'amount must be a numeric value greater than 0',
            error_code: 'AMOUNT_INVALID',
            attempted_amount: raw_amount
          }, status: :unprocessable_entity
        end

        daily = Transfers::NgnTransferDailyLimit.snapshot(user: current_user, attempted_amount: amount)
        fee_quote = quote_fee_for_amount(amount)

        render json: {
          eligible: true,
          tier: current_user.kyc_level.to_s,
          business_timezone: daily[:business_timezone],
          day_start: daily[:day_start]&.iso8601,
          day_end: daily[:day_end]&.iso8601,
          daily_limit: daily[:daily_limit].to_f,
          daily_spent: daily[:daily_spent].to_f,
          daily_remaining: daily[:daily_remaining].to_f,
          attempted_amount: daily[:attempted_amount].to_f,
          currency: 'NGN',
          as_of: daily[:as_of]&.iso8601,
          fee: fee_quote[:fee],
          total_debit: fee_quote[:total_debit],
          fee_is_estimate: fee_quote[:fee_is_estimate],
          fee_breakdown: fee_quote[:fee_breakdown]
        }, status: :ok
      rescue StandardError => e
        Rails.logger.error("[AccountsController] transfer_quote_failed user_id=#{current_user&.id} message=#{e.message}")
        render json: {
          message: 'Unable to compute transfer quote right now',
          error_code: 'quote_unavailable'
        }, status: :unprocessable_entity
      end

      def initiate_fund_transfer
        anchor_account = canonical_anchor_account_for(current_user)

        if anchor_account.nil? || anchor_account.useable_id.nil?
          return render json: { message: 'No Anchor account present' }, status: :not_found
        end

        return unless validate_transfer_params!

        pin = params.dig(:account, :pin).to_s.strip
        return unless require_transaction_pin!(pin, error_key: :message)

        anchor_service = AnchorService.new
        if anchor_service.respond_to?(:ensure_transfer_source_account!)
          anchor_account = anchor_service.ensure_transfer_source_account!(anchor_account)
        end
        if Rails.env.production? && !anchor_account.useable_id.to_s.end_with?('-anc_acc')
          return render_transfer_error(
            'Source account is not provisioned for transfers. Refresh your Anchor account details and try again.',
            code: 'source_account_invalid'
          )
        end

        bool = ActiveModel::Type::Boolean.new
        transfer_params = account_params.to_h.symbolize_keys.merge(
          source_id:             anchor_account.useable_id,
          source_name:           anchor_account.account_name,
          account_id:            anchor_account.id,
          wallet_id:             current_user.ngn_wallet.id,
          source_account_number: anchor_account.account_number
        )
        transfer_params[:inter_bank] = bool.cast(transfer_params[:inter_bank])
        transfer_params[:save_beneficiary] = bool.cast(transfer_params[:save_beneficiary])
        transfer_params[:counter_party_id] =
          params[:counter_party_id].presence ||
          params.dig(:account, :counter_party_id).presence ||
          transfer_params[:counter_party_id]
        normalize_inter_bank_counter_party_id!(transfer_params)

        if transfer_params[:inter_bank] && transfer_params[:counter_party_id].blank?
          counter_party_response = AnchorService.new.create_counter_party(transfer_params)
          if counter_party_response[:status] != :ok
            return render_transfer_error(
              counter_party_response[:message] || 'Unable to resolve beneficiary',
              code: 'beneficiary_resolution_failed'
            )
          end

          counter_party_id = counter_party_response.dig(:data, 'id')
          if counter_party_id.blank?
            return render_transfer_error('Unable to resolve beneficiary', code: 'beneficiary_resolution_failed')
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

        response_body = result[:body].is_a?(Hash) ? result[:body].dup : { message: result[:body].to_s }
        if result[:status] == :unprocessable_entity && response_body[:error_code].blank? && response_body['error_code'].blank?
          message_text = response_body[:message] || response_body['message']
          error_code =
            if message_text.to_s.include?('Minimum transfer amount')
              'transfer_amount_below_minimum'
            elsif message_text.to_s.include?('Invalid transfer amount')
              'transfer_amount_invalid'
            elsif message_text.to_s.include?('Insufficient balance.')
              'transfer_insufficient_balance'
            else
              'transfer_validation_failed'
            end
          response_body[:error_code] = error_code
          Rails.logger.info(
            "[AnchorTransfer] validation_error request_id=#{request.request_id} user_id=#{current_user.id} code=#{error_code}"
          )
        end

        render json: response_body, status: result[:status]

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
        account = canonical_anchor_account_for(current_user)

        # 👇 New behaviour: if there is *no* Anchor account yet, that's OK.
        # We return 200 with data: null so the frontend can quietly show
        # "no Anchor account yet" instead of a red error toast.
        unless account
          flow = anchor_flow_snapshot(nil)
          return render json: anchor_success_payload(
            data: nil,
            message: 'No Anchor account yet',
            flow: flow,
            extra: {
              has_anchor_account: false,
              has_deposit_account: false
            }
          ), status: :ok
        end

        account_identifier = account.useable_id.presence || account.account_id

        service = AnchorService.new
        begin
          service.send(:sync_anchor_deposit_account!, account)
          account.reload
          backfill_anchor_completed_status!(account)
        rescue StandardError => e
          Rails.logger.warn("[AccountsController] get_user_account_detail anchor sync skipped account_id=#{account.id} message=#{e.message}") if defined?(Rails) && Rails.logger
        end

        if account.status.to_s == 'verifying' || account.status.to_s == 'pending'
          customer_response = service.fetch_customer_detail(account.account_id)
          if customer_response[:status] == :ok
            customer_status = customer_response.dig(:data, 'attributes', 'status').to_s.downcase
            if %w[approved verified completed active].any? { |v| customer_status.include?(v) }
              account.update(status: 'completed')
            end
          end
        end

        service_response = service.fetch_account_detail(account_identifier, true)

        if service_response[:status] == :ok
          detail_data = canonicalize_anchor_detail_payload(service_response[:data], account)
          flow = anchor_flow_snapshot(account, has_deposit_account: true)
          render json: anchor_success_payload(
            data: detail_data,
            message: 'Account Numbers fetched',
            flow: flow,
            extra: {
              has_anchor_account: true,
              has_deposit_account: true
            }
          ), status: :ok
        else
          message = service_response[:message] || service_response[:response]
          if message.to_s.downcase.include?('no account found')
            flow = anchor_flow_snapshot(account, has_deposit_account: false)
            return render json: anchor_success_payload(
              data: nil,
              message: 'No deposit account yet',
              flow: flow,
              extra: {
                has_anchor_account: true,
                has_deposit_account: false
              }
            ), status: :ok
          end

          render json: anchor_error_payload(
            'anchor_detail_fetch_failed',
            message,
            retryable: true,
            flow: anchor_flow_snapshot(account, has_deposit_account: account.account_number.present?)
          ), status: :unprocessable_entity
        end
      end

      def anchor_onboarding_state
        account = canonical_anchor_account_for(current_user)
        backfill_anchor_completed_status!(account) if account.present?
        account.reload if account.present?
        has_deposit_account = account&.account_number.present? || false
        flow = anchor_flow_snapshot(account, has_deposit_account: has_deposit_account)

        render json: anchor_success_payload(
          data: {
            account_id: account&.id,
            account_number_masked: masked_account_number(account&.account_number),
            kyc_status: account&.status
          }.compact,
          message: 'Anchor onboarding state fetched',
          flow: flow,
          extra: {
            has_anchor_account: account.present?,
            has_deposit_account: has_deposit_account
          }
        ), status: :ok
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
          return render json: anchor_error_payload(
            'ANCHOR_ONBOARDING_INCOMPLETE',
            'Complete your profile to create an Anchor account.',
            retryable: false,
            flow: {
              state: 'blocked_profile_incomplete',
              next_action: 'complete_profile'
            },
            details: { missing_fields: missing_fields }
          ).merge(missing_fields: missing_fields), status: :unprocessable_entity
        end

        log_anchor_onboarding_will_call(account_info)
        service_response = service.create_individual_account(account_info)

        if service_response[:status] == :ok
          created_account = service_response[:response]
          flow = anchor_flow_snapshot(created_account, has_deposit_account: created_account&.account_number.present?)
          render json: anchor_success_payload(
            data: service_response[:response],
            message: 'User onboarded successfully',
            flow: flow,
            extra: {
              has_anchor_account: true,
              has_deposit_account: false
            }
          ), status: :ok
        else
          duplicate_phone_error = duplicate_anchor_phone_error?(service_response[:message])
          duplicate_customer_error =
            duplicate_anchor_customer_error?(service_response[:message]) ||
            duplicate_anchor_customer_error?(safe_provider_body(service_response[:provider_body]))

          if duplicate_customer_error
            existing_anchor = canonical_anchor_account_for(current_user)
            if existing_anchor.present?
              flow = anchor_flow_snapshot(existing_anchor, has_deposit_account: existing_anchor.account_number.present?)
              return render json: anchor_success_payload(
                data: existing_anchor,
                message: 'Anchor profile already exists. Continue onboarding.',
                flow: flow,
                extra: {
                  has_anchor_account: true,
                  has_deposit_account: existing_anchor.account_number.present?
                }
              ), status: :ok
            end

            return render json: anchor_error_payload(
              'ANCHOR_CUSTOMER_EXISTS',
              'Anchor profile already exists. Refresh and continue onboarding.',
              retryable: false,
              flow: {
                state: 'customer_created_no_deposit_account',
                next_action: 'provision_account_number'
              }
            ), status: :conflict
          end

          if duplicate_phone_error
            log_anchor_onboarding_error(
              code: 'ANCHOR_PHONE_EXISTS',
              phone: account_info[:phone_number],
              debug_message: service_response[:message]
            )
            return render json: anchor_error_payload(
              'ANCHOR_PHONE_EXISTS',
              'This phone number already exists in Anchor Sandbox.',
              retryable: false,
              flow: {
                state: 'blocked_phone_exists',
                next_action: 'contact_support_or_retry_detail_fetch'
              }
            ), status: :conflict
          end

          Rails.logger.info(
            {
              event: 'anchor.onboarding.failure',
              status: service_response[:provider_status],
              message: service_response[:message],
              provider_body: safe_provider_body(service_response[:provider_body]),
              user_id: current_user&.id,
              request_id: request.request_id
            }.compact
          )

          render json: anchor_error_payload(
            'ANCHOR_ONBOARDING_FAILED',
            service_response[:message].presence || 'Unable to create Anchor account.',
            retryable: true,
            flow: {
              state: 'temporary_provider_failure',
              next_action: 'retry_create_anchor_account'
            }
          ), status: :unprocessable_entity
        end
      end

      def create_monify_account
        render json: { message: 'New Monnify/Moniepoint account creation is disabled.' }, status: :unprocessable_entity and return

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

      # setup_anchor_onboarding accepts partial payloads and can run with no
      # account body by deriving values from user/profile records.
      def account_params_or_empty
        return ActionController::Parameters.new.permit if params[:account].blank?

        account_params
      rescue ActionController::ParameterMissing
        ActionController::Parameters.new.permit
      end

      def create_anchor_customer_for_setup(request_params)
        service = AnchorService.new
        account_info = AnchorOnboardingMapper.build_account_info(
          user: current_user,
          account_params: request_params
        )

        missing_fields = anchor_onboarding_missing_fields(account_info)
        if missing_fields.any?
          render json: anchor_error_payload(
            'ANCHOR_ONBOARDING_INCOMPLETE',
            'Complete your profile to create an Anchor account.',
            retryable: false,
            flow: {
              state: 'blocked_profile_incomplete',
              next_action: 'complete_profile'
            },
            details: { missing_fields: missing_fields }
          ).merge(missing_fields: missing_fields), status: :unprocessable_entity
          return nil
        end

        service_response = service.create_individual_account(account_info)
        return service_response[:response] if service_response[:status] == :ok

        duplicate_phone_error = duplicate_anchor_phone_error?(service_response[:message])
        duplicate_customer_error =
          duplicate_anchor_customer_error?(service_response[:message]) ||
          duplicate_anchor_customer_error?(safe_provider_body(service_response[:provider_body]))

        if duplicate_customer_error
          existing_anchor = canonical_anchor_account_for(current_user)
          if existing_anchor.present?
            return existing_anchor
          end

          linked_anchor = link_anchor_customer_from_duplicate_error(
            service_response: service_response,
            account_info: account_info
          )
          return linked_anchor if linked_anchor.present?

          render json: anchor_error_payload(
            'ANCHOR_CUSTOMER_EXISTS',
            'Anchor profile already exists. Refresh and continue onboarding.',
            retryable: false,
            flow: {
              state: 'customer_created_no_deposit_account',
              next_action: 'provision_account_number'
            }
          ), status: :conflict
          return nil
        end

        if duplicate_phone_error
          render json: anchor_error_payload(
            'ANCHOR_PHONE_EXISTS',
            'This phone number already exists in Anchor Sandbox.',
            retryable: false,
            flow: {
              state: 'blocked_phone_exists',
              next_action: 'contact_support_or_retry_detail_fetch'
            }
          ), status: :conflict
          return nil
        end

        render json: anchor_error_payload(
          'ANCHOR_ONBOARDING_FAILED',
          service_response[:message].presence || 'Unable to create Anchor account.',
          retryable: true,
          flow: {
            state: 'temporary_provider_failure',
            next_action: 'retry_create_anchor_account'
          }
        ), status: :unprocessable_entity
        nil
      end

      def ensure_anchor_kyc_for_setup(account, request_params)
        return account if account.blank?

        account.reload
        backfill_anchor_completed_status!(account)
        return account if account.status.to_s == 'completed'

        kyc_payload = resolved_anchor_kyc_payload(request_params, account)
        kyc_missing_fields = anchor_kyc_missing_fields(kyc_payload)
        if kyc_missing_fields.any?
          render json: anchor_error_payload(
            'anchor_kyc_incomplete',
            'Complete Anchor KYC fields before verification.',
            retryable: false,
            details: { missing_fields: kyc_missing_fields }
          ), status: :unprocessable_entity
          return nil
        end

        service = AnchorService.new
        service_response = service.user_kyc_verification(kyc_payload, account)

        if service_response[:status] == :ok
          account.reload
          return account
        end

        code, retryable = map_anchor_kyc_error(service_response[:message], service_response[:provider_body])
        render json: anchor_error_payload(
          code,
          service_response[:message],
          retryable: retryable,
          details: { provider_status: service_response[:provider_status] }.compact
        ), status: :unprocessable_entity
        nil
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

      # Defensive normalization for older/mobile payloads:
      # - if a local beneficiary id is sent, map it to stored provider counter_party_id
      # - if an unresolved UUID-like local id is sent, clear it so we resolve/create beneficiary server-side
      # - keep non-empty opaque ids untouched to preserve backward compatibility
      def normalize_inter_bank_counter_party_id!(transfer_params)
        return unless ActiveModel::Type::Boolean.new.cast(transfer_params[:inter_bank])

        incoming_id = transfer_params[:counter_party_id].to_s.strip
        return if incoming_id.blank?

        return if incoming_id.end_with?('-anc_cp')

        beneficiary =
          current_user.beneficiaries.find_by(id: incoming_id) ||
          current_user.beneficiaries.find_by(counter_party_id: incoming_id)
        if beneficiary&.counter_party_id.present?
          transfer_params[:counter_party_id] = beneficiary.counter_party_id
        elsif incoming_id.match?(/\A[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z/i)
          transfer_params[:counter_party_id] = nil
        end
      rescue StandardError => e
        Rails.logger.warn("Unable to normalize counter_party_id user_id=#{current_user.id}: #{e.message}")
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
          'address.postalCode' => account_info[:postal_code]
        }

        required.select { |_key, value| value.blank? }.keys
      end

      def anchor_kyc_missing_fields(kyc_payload)
        required = {
          'bvn' => kyc_payload[:bvn],
          'dob' => kyc_payload[:dob],
          'gender' => kyc_payload[:gender]
        }

        required.select { |_key, value| value.blank? }.keys
      end

      def resolved_anchor_kyc_payload(request_params, account)
        request_hash =
          if request_params.respond_to?(:to_h)
            request_params.to_h.symbolize_keys
          else
            {}
          end

        profile = current_user&.user_profile
        user_kyc = current_user&.user_kyc

        bvn = normalize_anchor_bvn(
          request_hash[:bvn].presence ||
          request_hash[:bvn_number].presence ||
          verified_anchor_bvn_from_kyc(user_kyc) ||
          account&.bvn
        )

        dob = normalize_anchor_dob(
          request_hash[:dob].presence ||
          request_hash[:date_of_birth].presence ||
          request_hash[:birthdate].presence ||
          account&.dob ||
          profile&.date_of_birth
        )

        gender = normalize_anchor_gender(
          request_hash[:gender].presence ||
          account&.gender ||
          profile&.gender
        )

        {
          bvn: bvn,
          dob: dob,
          gender: gender
        }
      end

      def verified_anchor_bvn_from_kyc(user_kyc)
        return nil unless user_kyc
        return nil unless user_kyc.bvn_status.to_s == 'verified' || user_kyc.bvn_verified_at.present?

        normalize_anchor_bvn(user_kyc.decrypted_bvn)
      rescue StandardError
        nil
      end

      def normalize_anchor_bvn(value)
        digits = value.to_s.gsub(/\D/, '')
        return nil unless digits.length == 11

        digits
      end

      def normalize_anchor_dob(value)
        return nil if value.blank?
        return value.to_date.iso8601 if value.respond_to?(:to_date)

        Date.iso8601(value.to_s).iso8601
      rescue StandardError
        nil
      end

      def normalize_anchor_gender(value)
        normalized = value.to_s.strip.downcase
        return normalized if %w[male female].include?(normalized)

        nil
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

      def duplicate_anchor_customer_error?(message)
        msg = message.to_s.downcase
        return true if msg.include?('customer with email already exist in this organization')
        return true if msg.include?('customer already exist')

        false
      end

      def link_anchor_customer_from_duplicate_error(service_response:, account_info:)
        customer_id = extract_anchor_customer_id_from_duplicate_error(service_response)
        return nil if customer_id.blank?

        existing = current_user.accounts.where(vendor: 'anchor')
                               .where('account_id = :id OR useable_id = :id', id: customer_id)
                               .order(updated_at: :desc)
                               .first
        if existing.present?
          existing.update(active: true) unless existing.active?
          return existing
        end

        gender = normalize_anchor_gender(account_info[:gender] || current_user&.user_profile&.gender)
        account_name = [account_info[:first_name], account_info[:last_name]].compact.join(' ').strip.presence

        current_user.accounts.create!(
          account_type: :individual,
          status: :verifying,
          active: true,
          vendor: 'anchor',
          account_id: customer_id,
          useable_id: customer_id,
          account_name: account_name,
          bank_name: 'Anchor',
          bvn: normalize_anchor_bvn(account_info[:bvn]),
          dob: normalize_anchor_dob(account_info[:dob]),
          gender: gender
        )
      rescue StandardError => e
        Rails.logger.warn(
          "[Anchor Onboarding] duplicate_customer_autolink_failed user_id=#{current_user&.id} " \
          "message=#{e.message}"
        )
        nil
      end

      def extract_anchor_customer_id_from_duplicate_error(service_response)
        body = service_response[:provider_body]
        candidates = []
        collect_anchor_id_candidates!(body, candidates)
        collect_anchor_id_candidates!(service_response[:message], candidates)

        normalized = candidates.map { |value| value.to_s.strip }.reject(&:blank?).uniq
        normalized.find { |value| value.match?(/\A[\w-]+-anc_cus\z/i) } ||
          normalized.find { |value| value.match?(/\Acus_[\w-]+\z/i) } ||
          normalized.find { |value| value.match?(/\A[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z/i) }
      end

      def collect_anchor_id_candidates!(source, candidates)
        case source
        when Hash
          source.each do |key, value|
            key_text = key.to_s.downcase
            if value.is_a?(String) && key_text.include?('id')
              candidates << value
            end
            if value.is_a?(String)
              candidates.concat(value.scan(/[\w-]+-anc_cus/i))
              candidates.concat(value.scan(/cus_[\w-]+/i))
            end
            collect_anchor_id_candidates!(value, candidates)
          end
        when Array
          source.each { |value| collect_anchor_id_candidates!(value, candidates) }
        when String
          candidates.concat(source.scan(/[\w-]+-anc_cus/i))
          candidates.concat(source.scan(/cus_[\w-]+/i))
          if source =~ /\b(?:customer|customer_id|id)\b[^A-Za-z0-9_-]*([A-Za-z0-9_-]{8,})/i
            candidates << Regexp.last_match(1)
          end
        end
      end

      def map_anchor_account_number_error(message, provider_body = nil)
        text = message.to_s.downcase
        body_text = provider_body.to_s.downcase

        return ['anchor_phone_already_exists', false] if duplicate_anchor_phone_error?(text) || duplicate_anchor_phone_error?(body_text)
        return ['anchor_kyc_incomplete', false] if text.include?('kyc') || text.include?('missing') || body_text.include?('kyc')
        return ['provider_unavailable', true] if [text, body_text].any? { |t| t.include?('unavailable') || t.include?('timeout') || t.include?('timed out') || t.include?('503') }

        ['anchor_account_number_failed', true]
      end

      def map_anchor_kyc_error(message, provider_body = nil)
        text = message.to_s.downcase
        body_text = provider_body.to_s.downcase

        return ['anchor_kyc_already_verified', false] if text.include?('already completed') || text.include?('already verified')
        return ['provider_unavailable', true] if [text, body_text].any? { |t| t.include?('unavailable') || t.include?('timeout') || t.include?('timed out') || t.include?('503') }

        ['anchor_kyc_verification_failed', false]
      end

      def anchor_success_payload(data:, message:, flow:, extra: {})
        meta = {
          provider: 'anchor',
          request_id: request.request_id,
          flow: flow,
          docs: anchor_docs_reference
        }

        # Keep backward compatibility: expose retry hints in both top-level
        # fields and meta for clients that already parse one shape or the other.
        %i[retryable provisioning_pending retry_after_seconds].each do |key|
          meta[key] = extra[key] if extra.key?(key)
        end

        payload = {
          success: true,
          data: data,
          message: message,
          flow: flow,
          requirements: anchor_requirements(flow[:state]),
          capabilities: anchor_capabilities(flow[:state]),
          request_id: request.request_id,
          meta: meta
        }
        payload.merge(extra)
      end

      def anchor_error_payload(code, message, retryable:, flow: nil, details: nil)
        resolved_flow = flow || anchor_error_flow(code)
        resolved_message = message.presence || 'Unable to complete Anchor onboarding action'
        {
          success: false,
          error: code,
          error_code: code,
          message: resolved_message,
          details: details || {},
          errors: [resolved_message],
          retryable: retryable,
          flow: resolved_flow,
          requirements: anchor_requirements(resolved_flow[:state], details: details),
          capabilities: anchor_capabilities(resolved_flow[:state]),
          request_id: request.request_id,
          meta: {
            provider: 'anchor',
            request_id: request.request_id,
            retryable: retryable,
            flow: resolved_flow,
            docs: anchor_docs_reference
          }
        }
      end

      def anchor_docs_reference
        'https://docs.getanchor.co/docs/developer-onboarding-to-anchor-api'
      end

      def anchor_requirements(flow_state, details: nil)
        base = {
          platform_kyc_level_required: 'tier_2',
          profile_fields: %w[first_name last_name email phone address city state postal_code],
          kyc_fields: %w[bvn dob gender]
        }
        if details.is_a?(Hash) && details[:missing_fields].present?
          base[:missing_fields] = details[:missing_fields]
        end

        case flow_state.to_s
        when 'blocked_kyc'
          base.merge(
            current_blocker: 'Complete Tier 2 verification',
            next_action_hint: 'complete_kyc'
          )
        when 'pending_kyc_review'
          base.merge(
            current_blocker: 'Anchor KYC is under provider review',
            next_action_hint: 'refresh_status'
          )
        when 'blocked_profile_incomplete'
          base.merge(
            current_blocker: 'Complete required profile fields',
            next_action_hint: 'complete_profile'
          )
        else
          base
        end
      end

      def anchor_capabilities(flow_state)
        state = flow_state.to_s
        {
          can_create_anchor_profile: %w[not_started blocked_profile_incomplete blocked_phone_exists temporary_provider_failure].include?(state),
          can_submit_anchor_kyc: !%w[not_started pending_kyc_review].include?(state),
          can_provision_account_number: %w[customer_created_no_deposit_account].include?(state),
          can_fund_wallet: %w[provisioned].include?(state)
        }
      end

      def masked_account_number(account_number)
        return nil if account_number.blank?

        digits = account_number.to_s
        return '*' * digits.length if digits.length <= 4

        "****#{digits[-4, 4]}"
      end

      def anchor_flow_snapshot(account, has_deposit_account: false)
        if account.nil?
          return {
            state: 'not_started',
            next_action: 'create_anchor_account'
          }
        end

        if %w[verifying pending].include?(account.status.to_s)
          return {
            state: 'pending_kyc_review',
            next_action: 'refresh_status'
          }
        end

        if account.status.to_s != 'completed'
          return {
            state: 'blocked_kyc',
            next_action: 'verify_kyc'
          }
        end

        return {
          state: 'customer_created_no_deposit_account',
          next_action: 'provision_account_number'
        } unless has_deposit_account

        {
          state: 'provisioned',
          next_action: 'none'
        }
      end

      def backfill_anchor_completed_status!(account)
        return if account.blank?
        return unless account.account_number.present?
        return if account.status.to_s == 'completed'

        account.update(status: 'completed')
      end

      # Deterministic selector for a user's canonical Anchor record.
      # Priority: provisioned account_number, then deposit account id, then freshest state.
      def canonical_anchor_account_for(user)
        return nil if user.blank?

        user.accounts
            .where(vendor: 'anchor')
            .order(
              Arel.sql("CASE WHEN active = TRUE THEN 0 ELSE 1 END ASC"),
              Arel.sql("CASE WHEN account_number IS NOT NULL AND account_number <> '' THEN 0 WHEN useable_id IS NOT NULL AND useable_id <> '' THEN 1 ELSE 2 END ASC"),
              status: :desc,
              updated_at: :desc,
              created_at: :desc
            )
            .first
      end

      def canonicalize_anchor_detail_payload(detail_data, account)
        data = detail_data.is_a?(Hash) ? detail_data.deep_dup : {}
        attributes = data['attributes'].is_a?(Hash) ? data['attributes'].deep_dup : {}
        bank = attributes['bank'].is_a?(Hash) ? attributes['bank'].deep_dup : {}

        canonical_account_number = account.account_number.to_s.strip
        canonical_account_name = account.account_name.to_s.strip
        canonical_bank_name = account.bank_name.to_s.strip
        canonical_bank_code = account.bank_code.to_s.strip

        data['account_number'] = canonical_account_number if canonical_account_number.present?
        data['accountNumber'] = canonical_account_number if canonical_account_number.present?
        data['account_name'] = canonical_account_name if canonical_account_name.present?
        data['accountName'] = canonical_account_name if canonical_account_name.present?
        data['bank_name'] = canonical_bank_name if canonical_bank_name.present?
        data['bankName'] = canonical_bank_name if canonical_bank_name.present?
        data['bank_code'] = canonical_bank_code if canonical_bank_code.present?
        data['bankCode'] = canonical_bank_code if canonical_bank_code.present?

        if canonical_account_number.present?
          attributes['accountNumber'] = canonical_account_number
          bank['accountNumber'] = canonical_account_number
        end
        attributes['accountName'] = canonical_account_name if canonical_account_name.present?
        attributes['name'] = canonical_account_name if canonical_account_name.present?
        attributes['bank_name'] = canonical_bank_name if canonical_bank_name.present?
        attributes['bankName'] = canonical_bank_name if canonical_bank_name.present?
        bank['name'] = canonical_bank_name if canonical_bank_name.present?
        bank['code'] = canonical_bank_code if canonical_bank_code.present?

        attributes['bank'] = bank if bank.any?
        data['attributes'] = attributes if attributes.any?
        data
      end

      def anchor_error_flow(code)
        case code
        when 'anchor_account_missing'
          { state: 'not_started', next_action: 'create_anchor_account' }
        when 'ANCHOR_ONBOARDING_INCOMPLETE'
          { state: 'blocked_profile_incomplete', next_action: 'complete_profile' }
        when 'ANCHOR_PHONE_EXISTS'
          { state: 'blocked_phone_exists', next_action: 'contact_support_or_retry_detail_fetch' }
        when 'ANCHOR_CUSTOMER_EXISTS'
          { state: 'customer_created_no_deposit_account', next_action: 'provision_account_number' }
        when 'ANCHOR_ONBOARDING_FAILED'
          { state: 'temporary_provider_failure', next_action: 'retry_create_anchor_account' }
        when 'anchor_kyc_incomplete'
          { state: 'blocked_kyc', next_action: 'complete_kyc' }
        when 'anchor_kyc_already_verified'
          { state: 'customer_created_no_deposit_account', next_action: 'provision_account_number' }
        when 'pending_kyc_review'
          { state: 'pending_kyc_review', next_action: 'refresh_status' }
        when 'anchor_kyc_verification_failed'
          { state: 'blocked_kyc', next_action: 'complete_kyc' }
        when 'anchor_phone_already_exists'
          { state: 'blocked_phone_exists', next_action: 'contact_support_or_retry_detail_fetch' }
        when 'provider_unavailable'
          { state: 'temporary_provider_failure', next_action: 'retry_provision' }
        when 'anchor_detail_fetch_failed'
          { state: 'temporary_provider_failure', next_action: 'retry_detail_fetch' }
        else
          { state: 'customer_created_no_deposit_account', next_action: 'retry_provision' }
        end
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
        bank_name = account_params[:bank].to_s.strip
        description = account_params[:description].to_s.strip
        amount = account_params[:amount]
        inter_bank_raw = account_params[:inter_bank]

        unless account_number.match?(/\A\d{10}\z/)
          render_transfer_error('account_number must be 10 digits', code: 'account_number_invalid')
          return false
        end

        if bank_code.blank?
          render_transfer_error('bank_code is required', code: 'bank_code_required')
          return false
        end

        if account_params[:account_name].to_s.strip.blank?
          render_transfer_error(
            'account_name is required. Resolve account details first.',
            code: 'account_name_required'
          )
          return false
        end

        if bank_name.blank?
          render_transfer_error('bank is required', code: 'bank_required')
          return false
        end

        if description.blank?
          render_transfer_error('description is required', code: 'description_required')
          return false
        end

        if inter_bank_raw.nil?
          render_transfer_error('inter_bank is required and must be boolean', code: 'inter_bank_required')
          return false
        end

        normalized_inter_bank = inter_bank_raw.to_s.strip.downcase
        unless %w[true false 1 0].include?(normalized_inter_bank) || [true, false].include?(inter_bank_raw)
          render_transfer_error('inter_bank must be boolean', code: 'inter_bank_invalid')
          return false
        end

        numeric_amount = amount.to_d rescue nil
        if numeric_amount.nil? || numeric_amount <= 0
          render_transfer_error('amount must be greater than 0', code: 'amount_invalid')
          return false
        end

        true
      end

      def render_transfer_error(message, code:, status: :unprocessable_entity)
        Rails.logger.info(
          "[AnchorTransfer] request_validation_error request_id=#{request.request_id} user_id=#{current_user.id} code=#{code}"
        )
        render json: { message: message, error_code: code }, status: status
      end

      def parse_quote_amount(raw_amount)
        BigDecimal(raw_amount.to_s)
      rescue ArgumentError, TypeError
        nil
      end

      def quote_fee_for_amount(amount)
        fee_breakdown = Pricing::Engine.transfer_fee_breakdown_ngn(amount)
        total_fee = fee_breakdown.fetch(:total_fee).to_d
        {
          fee: total_fee.to_f,
          total_debit: (amount + total_fee).to_f,
          fee_is_estimate: false,
          fee_breakdown: {
            platform_fee: fee_breakdown.fetch(:platform_fee).to_d.to_f,
            stamp_duty_fee: fee_breakdown.fetch(:stamp_duty_fee).to_d.to_f,
            total_fee: total_fee.to_f
          }
        }
      rescue StandardError
        {
          fee: nil,
          total_debit: nil,
          fee_is_estimate: true,
          fee_breakdown: {
            message: 'Fee confirmed on transfer submission'
          }
        }
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

        render json: anchor_error_payload(
          'kyc_required',
          'Please complete Tier 2 verification before generating or using an Anchor virtual account.',
          retryable: false,
          flow: {
            state: 'blocked_kyc',
            next_action: 'complete_kyc'
          },
          details: {
            error: 'kyc_required',
            current_level: current_user&.kyc_level.to_s.presence || 'tier_0',
            required_level: required_level
          }
        ).merge(
          error: 'kyc_required',
          current_level: current_user&.kyc_level.to_s.presence || 'tier_0',
          required_level: required_level
        ), status: :forbidden
      end
    end
  end
end
