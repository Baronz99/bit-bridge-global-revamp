# frozen_string_literal: true

require 'uri'

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

        user = User.includes(
          :user_kyc,
          :wallet,
          user_profile: [
            { id_document_attachment: :blob },
            { proof_of_address_attachment: :blob }
          ]
        ).find(current_user.id)
        profile = user.user_profile
        kyc = user.user_kyc
        ngn_wallet = user.wallet
        account = user.accounts.order(created_at: :desc).first

        document_reviews = latest_document_reviews(user.id)
        id_doc_review = document_reviews['id_document']
        proof_doc_review = document_reviews['proof_of_address']

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
            user_profile: serialize_compact_profile(profile, id_doc_review: id_doc_review, proof_doc_review: proof_doc_review),
            user_kyc: serialize_compact_kyc(kyc),
            kyc_requirements: ::Kyc::RequirementsCalculator.new(user).call
          }.compact
        }, status: :ok
      end



      def index
        if current_user&.admin_access? && truthy_param?(params[:summary])
          return render_summary_users
        end

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
        # Attachments are handled via UserProfile only; never mass-assign them on User.
        attrs.delete(:id_document)
        attrs.delete(:proof_of_address)
        id_document_upload = params.dig(:user, :id_document)
        proof_of_address_upload = params.dig(:user, :proof_of_address)
        nin_changed = nin_value_changed?(user: current_user, attrs: attrs)
        should_recheck = should_recheck_bvn_snapshot?(current_user, profile_attrs)
        should_recalculate_kyc =
          profile_attrs.present? ||
          attrs[:id_type].present? ||
          attrs[:id_number].present? ||
          id_document_upload.present? ||
          proof_of_address_upload.present?

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
          "attachments={id_document=#{id_document_upload&.class} " \
          "proof_of_address=#{proof_of_address_upload&.class}}"
        )

        begin
          User.transaction do
            current_user.update!(attrs)
            reset_nin_verification_state!(current_user) if nin_changed

            if profile_attrs.present? || id_document_upload.present? || proof_of_address_upload.present?
              profile = current_user.user_profile || current_user.build_user_profile
              safe_profile_attrs = (profile_attrs || {}).dup
              has_dob_key = safe_profile_attrs.key?(:date_of_birth)
              dob_raw = safe_profile_attrs.delete(:date_of_birth)

              profile.assign_attributes(safe_profile_attrs)

              if has_dob_key
                if dob_raw.present?
                  begin
                    profile.date_of_birth = Date.iso8601(dob_raw.to_s)
                  rescue ArgumentError
                    profile.errors.add(:date_of_birth, 'is invalid (use YYYY-MM-DD)')
                    raise ActiveRecord::RecordInvalid.new(profile)
                  end
                else
                  profile.date_of_birth = nil
                end
              end

              profile.id_document.attach(id_document_upload) if id_document_upload.present?
              profile.proof_of_address.attach(proof_of_address_upload) if proof_of_address_upload.present?
              profile.save!
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
        rescue ActiveRecord::RecordInvalid => e
          errors = e.record&.errors&.full_messages.presence || [e.message]
          Rails.logger.warn(
            "[USER_UPDATE] validation_failed user_id=#{current_user&.id} " \
            "error_class=#{e.class} errors=#{errors.join(' | ')} " \
            "attrs_keys=#{attrs.keys} profile_keys=#{profile_attrs&.keys}"
          )
          return render json: { message: errors.join(', '), errors: errors }, status: :unprocessable_entity
        rescue StandardError => e
          Rails.logger.error(
            "[USER_UPDATE] unexpected_failure user_id=#{current_user&.id} " \
            "error_class=#{e.class} error=#{e.message} " \
            "attrs_keys=#{attrs.keys} profile_keys=#{profile_attrs&.keys}"
          )
          return render json: {
            message: 'Unable to update profile at the moment. Please retry.',
            error_code: 'user_update_failed'
          }, status: :unprocessable_entity
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

        reason = params[:reason].to_s.strip
        if reason.blank?
          return render json: { message: 'reason is required' }, status: :unprocessable_entity
        end

        allowed_levels = User::KYC_RANKS.keys
        level = params[:kyc_level]
        if level.present? && !allowed_levels.include?(level.to_s)
          return render json: {
            message: "kyc_level must be one of: #{allowed_levels.join(', ')}"
          }, status: :unprocessable_entity
        end

        previous_level = user.kyc_level
        user.kyc_level = level if level.present?

        if user.save
          log_admin_audit(
            'update_kyc_level',
            target: user,
            metadata: {
              reason: reason,
              previous_level: previous_level,
              new_level: user.kyc_level
            }
          )
          Rails.logger.info(
            "[KYC_LEVEL_ADMIN_UPDATE] admin_id=#{current_user.id} target_user_id=#{user.id} " \
            "from=#{previous_level.inspect} to=#{user.kyc_level.inspect} reason=#{reason.inspect}"
          )
          render json: {
            message: 'KYC level updated',
            reason: reason,
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

        summary = compact_wallet_summary(wallet)

        {
          id: wallet.id,
          wallet_type: wallet.wallet_type,
          currency: wallet.currency,
          balance: summary[:balance],
          available_balance: summary[:available_balance],
          commission: wallet.commission,
          total_bills: summary[:total_bills],
          withdrawn: summary[:withdrawn],
          total_deposit: summary[:total_deposit],
          wallet_stats: summary[:wallet_stats]
        }.compact
      end

      def compact_wallet_summary(wallet)
        available_balance =
          if wallet.respond_to?(:ledger_available_balance)
            wallet.ledger_available_balance
          else
            wallet.balance
          end
        balance = wallet.ngn? ? available_balance : wallet.balance

        approved_withdrawals =
          wallet.transactions
                .where(transaction_type: :withdrawal, status: :approved)

        transfer_withdrawals =
          approved_withdrawals
            .where("COALESCE(metadata ->> 'provider', '') = ?", 'anchor')
            .where("COALESCE(metadata ->> 'transfer_reference', '') <> ''")

        transfer_principal =
          transfer_withdrawals
            .where("COALESCE(metadata ->> 'subtype', '') = ?", 'principal')
            .sum(:amount)

        transfer_fees =
          transfer_withdrawals
            .where("COALESCE(metadata ->> 'subtype', '') = ?", 'fee')
            .sum(:amount)

        transfer_total = transfer_principal.to_d + transfer_fees.to_d

        card_spend_total =
          approved_withdrawals
            .where(
              "bridge_card_id IS NOT NULL OR " \
              "COALESCE(metadata ->> 'subtype', '') LIKE 'card_%' OR " \
              "COALESCE(metadata ->> 'subtype', '') IN ('provider_fee', 'bitbridge_fee', 'fx_markup')"
            )
            .sum(:amount)

        circle_funding_total =
          approved_withdrawals
            .where("COALESCE(metadata ->> 'group_reference', '') <> ''")
            .sum(:amount)

        bills_total =
          wallet.bill_orders
                .where(status: :completed, payment_method: :wallet)
                .where.not("COALESCE(provider_response ->> 'source', '') = ?", 'anchor_transfer')
                .where.not(
                  "LOWER(COALESCE(service_type, '')) = ? AND LOWER(COALESCE(biller, '')) = ?",
                  'other',
                  'anchor'
                )
                .sum(:total_amount)

        total_withdrawals_approved = approved_withdrawals.sum(:amount)
        categorized_outflow = transfer_total.to_d + card_spend_total.to_d + circle_funding_total.to_d
        other_withdrawals = total_withdrawals_approved.to_d - categorized_outflow
        other_withdrawals = 0.to_d if other_withdrawals.negative?

        {
          balance: balance,
          available_balance: available_balance,
          total_bills: bills_total,
          withdrawn: total_withdrawals_approved,
          total_deposit: wallet.transactions
                               .where(transaction_type: :deposit, status: :approved)
                               .sum(Arel.sql("amount + COALESCE(bonus, 0)")),
          wallet_stats: {
            schema_version: 1,
            bills_wallet_total: bills_total.to_f,
            bank_transfers_total: transfer_total.to_f,
            bank_transfer_principal_total: transfer_principal.to_f,
            bank_transfer_fee_total: transfer_fees.to_f,
            card_spend_total: card_spend_total.to_f,
            circle_funding_total: circle_funding_total.to_f,
            other_withdrawals_total: other_withdrawals.to_f,
            total_withdrawals_approved: total_withdrawals_approved.to_f
          }
        }
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

      def serialize_compact_profile(profile, id_doc_review:, proof_doc_review:)
        return nil unless profile

        id_document_uploaded = profile.respond_to?(:id_document) && profile.id_document.attached?
        proof_of_address_uploaded = profile.respond_to?(:proof_of_address) && profile.proof_of_address.attached?
        id_document_status = resolve_document_status(uploaded: id_document_uploaded, review: id_doc_review)
        proof_of_address_status = resolve_document_status(uploaded: proof_of_address_uploaded, review: proof_doc_review)

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
          proof_of_address_type: profile.proof_of_address_type,
          id_document_url: blob_url_for(profile, :id_document),
          proof_of_address_url: blob_url_for(profile, :proof_of_address),
          id_document_filename: blob_filename_for(profile, :id_document),
          proof_of_address_filename: blob_filename_for(profile, :proof_of_address),
          id_document_uploaded: id_document_uploaded,
          proof_of_address_uploaded: proof_of_address_uploaded,
          id_document_status: id_document_status,
          proof_of_address_status: proof_of_address_status,
          id_document_rejection_reason: (id_doc_review&.reason if id_document_status == 'rejected'),
          proof_of_address_rejection_reason: (proof_doc_review&.reason if proof_of_address_status == 'rejected')
        }.compact
      end

      def latest_document_reviews(user_id)
        KycReview
          .where(user_id: user_id, kyc_type: %w[id_document proof_of_address])
          .order(created_at: :desc)
          .group_by(&:kyc_type)
          .transform_values(&:first)
      end

      def latest_document_review(user_id, kyc_type)
        latest_document_reviews(user_id)[kyc_type]
      end

      def resolve_document_status(uploaded:, review:)
        return 'pending' unless uploaded
        return 'rejected' if review&.status.to_s == 'rejected'

        'approved'
      end

      def blob_url_for(profile, attachment_name)
        return nil unless profile.respond_to?(attachment_name)

        attachment = profile.public_send(attachment_name)
        return nil unless attachment.attached?

        host, protocol = blob_url_host_and_protocol
        return nil if host.blank?

        Rails.application.routes.url_helpers.rails_blob_url(
          attachment,
          host: host,
          protocol: protocol
        )
      end

      def blob_filename_for(profile, attachment_name)
        return nil unless profile.respond_to?(attachment_name)

        attachment = profile.public_send(attachment_name)
        return nil unless attachment.attached?

        attachment.filename.to_s
      end

      def blob_url_host_and_protocol
        raw = ENV['STAGING_BACKEND_HOST'] || ENV['BACKEND_HOST'] || 'localhost:3000'
        return [nil, nil] if raw.blank?

        if raw.include?('://')
          uri = URI.parse(raw)
          [uri.host, uri.scheme || blob_default_protocol]
        else
          [raw, blob_default_protocol]
        end
      rescue URI::InvalidURIError
        [raw, blob_default_protocol]
      end

      def blob_default_protocol
        Rails.env.production? || Rails.env.staging? ? 'https' : 'http'
      end

      def serialize_compact_kyc(kyc)
        return nil unless kyc

        {
          bvn_status: kyc.bvn_status,
          bvn_last4: kyc.bvn_last4,
          bvn_verified_at: kyc.bvn_verified_at,
          bvn_last_result_reason: kyc.bvn_last_result_reason,
          nin_status: kyc.nin_status,
          nin_last4: kyc.nin_last4,
          nin_verified_at: kyc.nin_verified_at,
          nin_last_result_reason: kyc.nin_last_result_reason,
          tier3_status: kyc.effective_tier3_status,
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

      def render_summary_users
        limit = parse_limit(params[:limit], default: 500, max: 1000)
        return if performed?

        users = User
                .left_joins(:user_profile)
                .left_joins(:wallet)
                .select(
                  'users.id',
                  'users.email',
                  'users.role',
                  'users.active',
                  'users.created_at',
                  'user_profiles.first_name AS profile_first_name',
                  'user_profiles.last_name AS profile_last_name',
                  'user_profiles.phone_number AS profile_phone_number',
                  'wallets.id AS ngn_wallet_id',
                  'wallets.wallet_type AS ngn_wallet_type',
                  'wallets.balance_cents AS ngn_wallet_balance_cents'
                )
                .order('users.created_at DESC')
                .limit(limit)

        wallet_ids = users.filter_map { |user| user.attributes['ngn_wallet_id'] }
        computed_balances = compute_ngn_available_balances(wallet_ids)

        data = users.map do |user|
          wallet_id = user.attributes['ngn_wallet_id']
          wallet_balance =
            if wallet_id.present? && computed_balances.key?(wallet_id)
              computed_balances[wallet_id]
            else
              cents_to_amount(user.attributes['ngn_wallet_balance_cents'])
            end

          {
            id: user.id,
            email: user.email,
            role: user.role,
            active: user.active,
            created_at: user.created_at,
            user_profile: {
              first_name: user.attributes['profile_first_name'],
              last_name: user.attributes['profile_last_name'],
              phone_number: user.attributes['profile_phone_number']
            }.compact,
            wallets: user.attributes['ngn_wallet_id'].present? ? [
              {
                id: user.attributes['ngn_wallet_id'],
                wallet_type: wallet_type_label(user.attributes['ngn_wallet_type']),
                wallet_balance: wallet_balance
              }
            ] : []
          }
        end

        render json: { data: data }, status: :ok
      end

      def parse_limit(raw, default:, max:)
        return default if raw.blank?

        limit = Integer(raw)
        if limit <= 0
          render json: { message: 'limit must be greater than 0' }, status: :unprocessable_entity
          return nil
        end

        [limit, max].min
      rescue ArgumentError, TypeError
        render json: { message: 'limit must be an integer' }, status: :unprocessable_entity
        nil
      end

      def truthy_param?(value)
        ActiveModel::Type::Boolean.new.cast(value)
      end

      def wallet_type_label(value)
        if value.is_a?(Integer)
          Wallet.wallet_types.key(value) || value
        else
          value
        end
      end

      def cents_to_amount(value)
        return nil if value.nil?

        value.to_d / 100
      end

      def compute_ngn_available_balances(wallet_ids)
        return {} if wallet_ids.blank?

        deposits = Transaction
                   .unscope(:order)
                   .where(wallet_id: wallet_ids, transaction_type: :deposit, status: :approved)
                   .group(:wallet_id)
                   .sum(:amount)

        withdrawals = Transaction
                      .unscope(:order)
                      .where(wallet_id: wallet_ids, transaction_type: :withdrawal, status: %i[pending approved])
                      .where("COALESCE(metadata ->> 'ledger_hold_reserved', 'false') != 'true'")
                      .group(:wallet_id)
                      .sum(:amount)

        refunds = WalletLedgerEntry
                  .where(wallet_id: wallet_ids, entry_type: :refund)
                  .group(:wallet_id)
                  .sum(:amount)

        debits = WalletLedgerEntry
                 .where(wallet_id: wallet_ids, entry_type: :debit)
                 .group(:wallet_id)
                 .sum(:amount)

        bill_sums = WalletLedgerEntry
                    .where(wallet_id: wallet_ids, entry_type: %i[hold release debit])
                    .where.not(bill_order_id: nil)
                    .group(:wallet_id, :bill_order_id, :entry_type)
                    .sum(:amount)

        outstanding_by_wallet = Hash.new { |hash, key| hash[key] = {} }
        bill_sums.each do |(wallet_id, bill_order_id, entry_type), amount|
          outstanding_by_wallet[wallet_id][bill_order_id] ||= { hold: 0.to_d, release: 0.to_d, debit: 0.to_d }
          normalized_type =
            if entry_type.is_a?(Integer)
              WalletLedgerEntry.entry_types.key(entry_type)
            else
              entry_type.to_s
            end
          next unless %w[hold release debit].include?(normalized_type)

          outstanding_by_wallet[wallet_id][bill_order_id][normalized_type.to_sym] = amount.to_d
        end

        outstanding_per_wallet = {}
        outstanding_by_wallet.each do |wallet_id, bills|
          total = bills.values.sum do |totals|
            delta = totals[:hold] - totals[:release] - totals[:debit]
            delta.positive? ? delta : 0.to_d
          end
          outstanding_per_wallet[wallet_id] = total
        end

        wallet_ids.each_with_object({}) do |wallet_id, acc|
          raw =
            deposits[wallet_id].to_d +
            refunds[wallet_id].to_d -
            withdrawals[wallet_id].to_d -
            debits[wallet_id].to_d
          available = raw - outstanding_per_wallet[wallet_id].to_d
          acc[wallet_id] = available.negative? ? 0.to_d : available
        end
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

      def nin_value_changed?(user:, attrs:)
        effective_id_type = attrs[:id_type].to_s.strip.presence || user.id_type.to_s.strip
        return false unless effective_id_type.to_s.casecmp('nin').zero?
        return false unless attrs.key?(:id_number)

        incoming = attrs[:id_number].to_s.gsub(/\s+/, '').presence
        return false if incoming.blank?

        current = user.id_number.to_s.gsub(/\s+/, '').presence
        incoming != current
      end

      def reset_nin_verification_state!(user)
        kyc = user.user_kyc || user.build_user_kyc
        kyc.assign_attributes(
          nin_status: 'unverified',
          nin_last4: nil,
          nin_provider: 'prembly',
          nin_provider_reference: nil,
          nin_verified_at: nil,
          nin_last_result_status: nil,
          nin_last_result_reason: nil,
          nin_last_checked_at: nil,
          nin_name_match: nil,
          nin_dob_match: nil,
          nin_first_name_match: nil,
          nin_last_name_match: nil,
          nin_match_score: nil,
          nin_encrypted: nil
        )
        kyc.save! if kyc.changed?
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
          :id_number,
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
          :id_number,
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
          :id_number,
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
