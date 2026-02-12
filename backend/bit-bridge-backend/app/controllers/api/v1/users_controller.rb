# frozen_string_literal: true

module Api
  module V1
    class UsersController < ApplicationController
      before_action :set_user, only: %i[show update destroy clear_pin_lockout]
      before_action :require_admin_access!, only: %i[index show clear_pin_lockout]
      before_action :require_super_admin!, only: %i[destroy]
      skip_before_action :authenticate_user!,
                         only: %i[update_password password_reset activate_user resend_confirmation_token]

      # ========= PROFILE / BASIC CRUD =========

      def user_profile
        return render json: { error: 'User not found or not authenticated' }, status: :unauthorized if current_user.nil?

        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'

        user = User.includes(:user_profile, :user_kyc, :wallet, :accounts).find(current_user.id)
        profile = user.user_profile
        kyc = user.user_kyc
        ngn_wallet = user.wallet
        account = user.accounts.order(created_at: :desc).first

        render json: {
          data: {
            id: user.id,
            email: user.email,
            active: user.active,
            admin: user.admin?,
            role: user.role,
            admin_role: user.admin_role,
            onboarding_stage: user.onboarding_stage,
            primary_use_case: user.primary_use_case,
            kyc_level: user.kyc_level,
            id_type: user.id_type,
            phone_verified: profile&.phone_verified_at.present?,
            phone_verified_at: profile&.phone_verified_at,
            transaction_pin_set: user.transaction_pin_set?,
            transaction_pin_locked: user.transaction_pin_locked?,
            transaction_pin_lock_remaining_seconds: user.transaction_pin_lock_remaining_seconds,
            wallet: serialize_compact_wallet(ngn_wallet),
            account: serialize_compact_account(account),
            user_profile: serialize_compact_profile(profile),
            user_kyc: serialize_compact_kyc(kyc)
          }.compact
        }, status: :ok
      end



      def index
        @users = User.all
        render json: {
          data: ActiveModelSerializers::SerializableResource.new(@users, each_serializer: UserSerializer)
        }, status: :ok
      end

      def show
        log_admin_audit('view_user', target: @user) if current_user&.admin_access?
        render json: { data: UserSerializer.new(@user, scope: current_user) }, status: :ok
      end

      def update
        if params.dig(:user, :user_profile_attributes, :bvn_status).present? ||
           params.dig(:user, :user_profile_attributes, :bvn_rejection_reason).present?
          unless current_user&.admin?
            return render json: { message: 'Not authorized' }, status: :forbidden
          end
        end

        if @user.update(user_params)
          render json: { data: UserSerializer.new(@user), message: 'User updated' }, status: :ok
        else
          render json: { message: @user.errors.full_messages.to_sentence }, status: :unprocessable_entity
        end
      end

      def destroy
        if @user.destroy
          render json: { message: 'User deleted' }, status: :ok
        else
          render json: { message: @user.errors.full_messages.to_sentence }, status: :unprocessable_entity
        end
      end

      # ========= CONFIRMATION / ACTIVATION =========

      def resend_confirmation_token
        user = User.find_by(email: params[:email].downcase.strip) if params[:email].present?

        return render json: { message: 'User not found' }, status: :not_found unless user

        if user.confirmed?
          return render json: { message: 'User already confirmed' }.as_json, status: :unprocessable_entity
        end

        user.send_confirmation_instructions
        render json: { message: 'Confirmation token resent', data: user }, status: :ok
      end

      def activate_user
        unless current_user&.admin?
          return render json: { message: 'You are not authorized to perform this operation' },
                        status: :unprocessable_entity
        end

        user = User.find_by(email: params[:email].downcase.strip)

        return render json: { message: 'User not found' }, status: :not_found unless user

        if user.update(user_params)
          render json: { data: UserSerializer.new(user), message: 'User updated' }, status: :ok
        else
          render json: { message: user.errors.full_messages.to_sentence }, status: :unprocessable_entity
        end
      end

      # ========= PASSWORD RESET (REQUEST EMAIL) =========

      def password_reset
        email = params[:email]&.downcase&.strip
        user  = User.find_by(email: email)

        unless user
          return render json: { message: 'User not found' }, status: :not_found
        end

        generate_reset_token(user)
        render json: { message: 'A password reset link has been sent to you' }, status: :ok
      end

      # ========= PASSWORD UPDATE USING TOKEN =========

      def update_password
        raw_token = user_params[:password_token]
        password  = user_params[:password]

        if raw_token.blank? || password.blank?
          return render json: { message: 'Password reset token and password are required' },
                        status: :unprocessable_entity
        end

        digested = Devise.token_generator.digest(User, :reset_password_token, raw_token)
        user = User.find_by(reset_password_token: digested)

        unless user&.reset_password_period_valid?
          return render json: { message: 'Invalid or expired token' }, status: :unauthorized
        end

        if user.update(password: password)
          user.update(reset_password_token: nil, reset_password_sent_at: nil)

          render json: { data: UserSerializer.new(user), message: 'Password updated' }, status: :ok
        else
          render json: { message: user.errors.full_messages.to_sentence }, status: :unprocessable_entity
        end
      end

      # ========= UPDATE CURRENT USER (PROFILE) =========

      def user_update
        attrs = user_update_params.to_h.deep_symbolize_keys
        profile_attrs = attrs.delete(:user_profile_attributes)
        should_recheck = should_recheck_bvn_snapshot?(current_user, profile_attrs)
        should_recalculate_kyc = profile_attrs.present? || attrs[:id_type].present?

        if ENV['DEBUG_UPLOADS'].present?
          Rails.logger.info(
            "[USER_UPDATE] uploads debug " \
            "id_document_present=#{params.dig(:user, :id_document).present?} " \
            "id_document_class=#{params.dig(:user, :id_document)&.class} " \
            "proof_present=#{params.dig(:user, :proof_of_address).present?} " \
            "proof_class=#{params.dig(:user, :proof_of_address)&.class} " \
            "permitted_user_keys=#{attrs.keys} " \
            "permitted_profile_keys=#{profile_attrs&.keys}"
          )
        end

        Rails.logger.info(
          "[USER_UPDATE] raw_user_keys=#{params[:user]&.keys} raw_profile_keys=#{params[:user]&.dig(:user_profile_attributes)&.keys}"
        )

        Rails.logger.info(
          "[USER_UPDATE] profile_keys=#{profile_attrs&.keys} " \
          "attachments={id_document=#{profile_attrs&.dig(:id_document)&.class} " \
          "proof_of_address=#{profile_attrs&.dig(:proof_of_address)&.class}}"
        )

        begin
          User.transaction do
            current_user.update!(attrs)

            if profile_attrs.present?
              profile = current_user.user_profile || current_user.build_user_profile
              profile.update!(profile_attrs)
              profile.reload
              Rails.logger.info(
                "[USER_UPDATE] saved profile attachments id_document_attached=#{profile.id_document.attached?} " \
                "proof_of_address_attached=#{profile.proof_of_address.attached?} " \
                "proof_of_address_type=#{profile.proof_of_address_type.inspect}"
              )
            end

            if should_recalculate_kyc
              current_user.kyc_level = ::Kyc::LevelCalculator.resolve_level(current_user)
              current_user.save! if current_user.changed?
            end
          end
        rescue StandardError => e
          return render json: { message: e.message }, status: :unprocessable_entity
        end

        current_user.reload
        current_user.user_profile&.reload

        run_bvn_snapshot_recheck!(current_user) if should_recheck
        render json: { data: UserSerializer.new(current_user), message: 'User updated' }, status: :ok
      end

      # ========= ONBOARDING STAGE ONLY =========

      def onboarding_stage
        unless current_user
          return render json: { message: 'Not authenticated' }, status: :unauthorized
        end

        attrs = params.require(:user).permit(:onboarding_stage)
        stage = attrs[:onboarding_stage]

        current_user.onboarding_stage = stage if stage.present?

        if current_user.save
          render json: {
            message: 'Onboarding stage updated',
            data: UserSerializer.new(current_user)
          }, status: :ok
        else
          render json: { message: current_user.errors.full_messages.to_sentence }, status: :unprocessable_entity
        end
      end

      # ========= PRIMARY USE CASE + STAGE =========

      def use_case
        unless current_user
          return render json: { message: 'Not authenticated' }, status: :unauthorized
        end

        raw_attrs =
          if params[:user].present?
            params.require(:user).permit(:primary_use_case, :onboarding_stage)
          else
            params.permit(:primary_use_case, :onboarding_stage)
          end

        use_case = raw_attrs[:primary_use_case]
        stage    = raw_attrs[:onboarding_stage]

        unless use_case.present?
          return render json: { message: 'primary_use_case is required' },
                        status: :unprocessable_entity
        end

        current_user.primary_use_case = use_case
        current_user.onboarding_stage = stage if stage.present?

        if current_user.save
          render json: {
            message: 'Use case saved',
            data: UserSerializer.new(current_user)
          }, status: :ok
        else
          render json: { message: current_user.errors.full_messages.to_sentence },
                 status: :unprocessable_entity
        end
      end

      # ========= BASIC PROFILE / LIGHT KYC =========
      # PATCH /api/v1/users/basic_profile

      def basic_profile
        unless current_user
          return render json: { message: 'Not authenticated' }, status: :unauthorized
        end

        permitted = basic_profile_params

        # ✅ Normalize nested params into a plain Hash with STRING keys
        profile_attrs = (permitted[:user_profile_attributes] || {}).to_h
        id_type       = permitted[:id_type]
        should_recheck = should_recheck_bvn_snapshot?(current_user, profile_attrs)

        error_message = nil

        ActiveRecord::Base.transaction do
          profile = current_user.user_profile || current_user.build_user_profile
          # ✅ Handle DOB safely (do not wipe existing if blank)
          dob_raw = profile_attrs["date_of_birth"].presence
          profile_attrs.delete("date_of_birth")

          profile.assign_attributes(profile_attrs)

          if dob_raw.present?
            begin
              profile.date_of_birth = Date.iso8601(dob_raw.to_s)
            rescue ArgumentError
              error_message = "date_of_birth is invalid (use YYYY-MM-DD)"
              raise ActiveRecord::Rollback
            end
          end

          # Optional file uploads
          if params[:user].present?
            profile.id_document.attach(params[:user][:id_document]) if params[:user][:id_document].present?
            profile.proof_of_address.attach(params[:user][:proof_of_address]) if params[:user][:proof_of_address].present?
          end

          unless profile.save
            error_message = profile.errors.full_messages.to_sentence
            Rails.logger.error "Profile save failed: #{error_message}"
            raise ActiveRecord::Rollback
          end

          # Update user fields (id_type + kyc_level)
          current_user.id_type = id_type if id_type.present?

          current_user.kyc_level = ::Kyc::LevelCalculator.resolve_level(current_user)

          unless current_user.save
            error_message = current_user.errors.full_messages.to_sentence
            Rails.logger.error "User save failed: #{error_message}"
            raise ActiveRecord::Rollback
          end
        end

        if error_message.present?
          render json: { message: error_message }, status: :unprocessable_entity
        else
          run_bvn_snapshot_recheck!(current_user) if should_recheck
          render json: {
            message: 'Profile updated',
            data: UserSerializer.new(current_user.reload)
          }, status: :ok
        end
      rescue StandardError => e
        Rails.logger.error "basic_profile unexpected error: #{e.message}"
        render json: { message: e.message }, status: :unprocessable_entity
      end

      # ========= CHANGE PASSWORD WHILE LOGGED IN =========

      def user_password_update
        unless current_user.valid_password?(user_params[:old_password])
          return render json: { message: 'old password is incorrect' }, status: :unprocessable_entity
        end

        unless user_params[:password] == user_params[:confirm_password]
          return render json: { message: 'passwords do not match' }, status: :unprocessable_entity
        end

        if current_user.update(password: user_params[:password])
          render json: { message: 'pasword has been updated' }
        else
          render json: {
            message: "failed to update password:  #{current_user.errors.full_messages.to_sentence}"
          }, status: :unprocessable_entity
        end
      end

      # ========= ADMIN: MANUAL KYC LEVEL UPDATE =========

      def update_kyc_level
        unless current_user&.admin?
          return render json: { message: 'Not authorized' }, status: :forbidden
        end

        user = User.find_by(id: params[:id] || params[:user_id])
        return render json: { message: 'User not found' }, status: :not_found unless user

        level = params[:kyc_level]
        user.kyc_level = level if level.present?

        if user.save
          render json: {
            message: 'KYC level updated',
            data: UserSerializer.new(user)
          }, status: :ok
        else
          render json: { message: user.errors.full_messages.to_sentence }, status: :unprocessable_entity
        end
      end

      # ========= ADMIN: CLEAR TRANSACTION PIN LOCKOUT =========

      def clear_pin_lockout
        return render json: { message: 'User not found' }, status: :not_found unless @user

        @user.update_columns(
          transaction_pin_attempts: 0,
          transaction_pin_locked_until: nil
        )

        log_admin_audit('clear_pin_lockout', target: @user)

        render json: {
          message: 'Transaction PIN lockout cleared',
          data: UserSerializer.new(@user)
        }, status: :ok
      end

      # ========= HELPERS =========

      private

      def serialize_compact_wallet(wallet)
        return nil unless wallet

        {
          id: wallet.id,
          wallet_type: wallet.wallet_type,
          currency: wallet.currency,
          balance: wallet.balance,
          available_balance: wallet.respond_to?(:ledger_available_balance) ? wallet.ledger_available_balance : wallet.balance,
          commission: wallet.commission,
          total_bills: wallet.respond_to?(:total_bills) ? wallet.total_bills : nil,
          withdrawn: wallet.respond_to?(:withdrawn) ? wallet.withdrawn : nil,
          total_deposit: wallet.respond_to?(:total_deposit) ? wallet.total_deposit : nil
        }.compact
      end

      def serialize_compact_account(account)
        return nil unless account

        {
          id: account.id,
          account_name: account.account_name,
          account_number: account.account_number,
          bank_name: account.bank_name,
          bank_code: account.bank_code,
          vendor: account.vendor,
          currency: account.currency
        }.compact
      end

      def serialize_compact_profile(profile)
        return nil unless profile

        {
          id: profile.id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone_number: profile.phone_number,
          phone_e164: profile.phone_e164,
          phone_verified_at: profile.phone_verified_at,
          date_of_birth: profile.date_of_birth,
          gender: profile.gender,
          address_line1: profile.address_line1,
          address_line2: profile.address_line2,
          city: profile.city,
          state: profile.state,
          country: profile.country,
          postal_code: profile.postal_code,
          proof_of_address_type: profile.proof_of_address_type
        }.compact
      end

      def serialize_compact_kyc(kyc)
        return nil unless kyc

        {
          bvn_status: kyc.bvn_status,
          bvn_last4: kyc.bvn_last4,
          bvn_verified_at: kyc.bvn_verified_at,
          bvn_last_result_reason: kyc.bvn_last_result_reason,
          tier3_status: kyc.tier3_status,
          tier3_verified_at: kyc.tier3_verified_at
        }.compact
      end

      def set_user
        @user = User.find_by(id: params[:id])
      end

      def require_admin_access!
        return if current_user&.admin_access?

        render json: { message: 'Not authorized' }, status: :forbidden
      end

      def require_super_admin!
        return if current_user&.super_admin?

        render json: { message: 'Not authorized' }, status: :forbidden
      end

      def log_admin_audit(action, target: nil, metadata: {})
        AdminAuditEvent.create!(
          admin_user_id: current_user.id,
          target_user_id: target&.id,
          action: action,
          ip: request.remote_ip.to_s,
          user_agent: request.user_agent.to_s,
          metadata: metadata
        )
      rescue StandardError
        nil
      end

      def should_recheck_bvn_snapshot?(user, profile_attrs)
        return false unless profile_attrs

        profile = user&.user_profile
        first = profile_attrs["first_name"] || profile_attrs[:first_name]
        last = profile_attrs["last_name"] || profile_attrs[:last_name]
        dob_raw = profile_attrs["date_of_birth"] || profile_attrs[:date_of_birth]

        changed = false
        if first.present?
          current = profile&.first_name.to_s.strip.downcase
          incoming = first.to_s.strip.downcase
          changed ||= incoming != current
        end

        if last.present?
          current = profile&.last_name.to_s.strip.downcase
          incoming = last.to_s.strip.downcase
          changed ||= incoming != current
        end

        if dob_raw.present?
          current_date = profile&.date_of_birth
          incoming_date =
            begin
              Date.iso8601(dob_raw.to_s)
            rescue StandardError
              nil
            end
          changed ||= incoming_date.nil? || incoming_date != current_date
        end

        changed
      end

      def run_bvn_snapshot_recheck!(user)
        kyc = user&.user_kyc
        return unless kyc
        return unless kyc.bvn_fingerprint.present?
        return unless %w[mismatch pending_review unverified].include?(kyc.bvn_status.to_s)
        return unless ::Kyc::BvnSnapshotRecheck.snapshot_available?(kyc)

        ::Kyc::BvnSnapshotRecheck.call(user)
      end

      def user_params
        params.require(:user).permit(
          :email,
          :active,
          :password,
          :old_password,
          :confirm_password,
          :password_token,
          :onboarding_stage,
          :primary_use_case,
          :kyc_level,
          :id_type,
          :id_document,
          :proof_of_address,
          user_profile_attributes: %i[
            id
            first_name
            last_name
            phone_number
            gender
            date_of_birth
            address_line1
            address_line2
            city
            state
            country
            postal_code
            proof_of_address_type
            id_document
            proof_of_address
          ]
        )
      end

      def user_update_params
        params.require(:user).permit(
          :email,
          :active,
          :id_type,
          :id_document,
          :proof_of_address,
          user_profile_attributes: %i[
            id
            first_name
            last_name
            phone_number
            gender
            date_of_birth
            address_line1
            address_line2
            city
            state
            country
            postal_code
            proof_of_address_type
            id_document
            proof_of_address
          ]
        )
      end

      def basic_profile_params
        params.require(:user).permit(
          :id_type,
          :id_document,
          :proof_of_address,
          user_profile_attributes: %i[
            id
            first_name
            last_name
            phone_number
            gender
            date_of_birth
            address_line1
            address_line2
            city
            state
            country
            postal_code
            proof_of_address_type
          ]
        )
      end

      def generate_reset_token(user)
        raw, hashed = Devise.token_generator.generate(User, :reset_password_token)

        @token = raw
        user.reset_password_token   = hashed
        user.reset_password_sent_at = Time.now

        if user.save
          puts 'Token saved successfully!'
          UserMailer.send_password_reset(user, @token).deliver_later
        else
          puts "Failed to save token: #{user.errors.full_messages.join(', ')}"
        end
      end
    end
  end
end
