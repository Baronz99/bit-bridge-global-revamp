# frozen_string_literal: true

module Api
  module V1
    class UsersController < ApplicationController
      before_action :set_user, only: %i[show update destroy clear_pin_lockout]
      skip_before_action :authenticate_user!,
                         only: %i[update_password password_reset activate_user resend_confirmation_token]

      # ========= PROFILE / BASIC CRUD =========

      def user_profile
  return render json: { error: 'User not found or not authenticated' }, status: :unauthorized if current_user.nil?

  serialized = UserSerializer.new(current_user).serializable_hash

  # If serializer returns JSON:API style: { data: { attributes: {...} } }
  attrs =
    serialized.dig(:data, :attributes) ||
    serialized.dig('data', 'attributes') ||
    serialized

  render json: { data: attrs }, status: :ok
end



      def index
        @users = User.all
        render json: { data: @users }, status: :ok
      end

      def show
        render json: { data: UserSerializer.new(@user) }, status: :ok
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
        if current_user.update(user_update_params)
          render json: { data: UserSerializer.new(current_user), message: 'User updated' }, status: :ok
        else
          render json: { message: current_user.errors.full_messages.to_sentence }, status: :unprocessable_entity
        end
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
        unless current_user&.admin?
          return render json: { message: 'Not authorized' }, status: :forbidden
        end

        return render json: { message: 'User not found' }, status: :not_found unless @user

        @user.update_columns(
          transaction_pin_attempts: 0,
          transaction_pin_locked_until: nil
        )

        render json: {
          message: 'Transaction PIN lockout cleared',
          data: UserSerializer.new(@user)
        }, status: :ok
      end

      # ========= HELPERS =========

      private

      def set_user
        @user = User.find_by(id: params[:id])
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
          user_profile_attributes: %i[
            id
            first_name
            last_name
            phone_number
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

      def user_update_params
        params.require(:user).permit(
          :email,
          :active,
          user_profile_attributes: %i[
            id
            first_name
            last_name
            phone_number
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


