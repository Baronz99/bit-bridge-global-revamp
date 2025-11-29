# frozen_string_literal: true

module Api
  module V1
    class UsersController < ApplicationController
      before_action :set_user, only: %i[show update destroy]
      skip_before_action :authenticate_user!,
                         only: %i[update_password password_reset activate_user resend_confirmation_token]

      # ========= PROFILE / BASIC CRUD =========

      def user_profile
        if current_user.nil?
          render json: { error: 'User not found or not authenticated' }, status: :unauthorized
        else
          render json: { data: UserSerializer.new(current_user) }, status: :ok
        end
      end

      def index
        @users = User.all
        render json: { data: @users }, status: :ok
      end

      def show
        render json: { data: UserSerializer.new(@user) }, status: :ok
      end

      def update
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
      # PATCH /api/v1/users/onboarding_stage
      # Frontend sends: { user: { onboarding_stage: "..." } }

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
      # PATCH /api/v1/users/use_case
      # Frontend sends: { user: { primary_use_case: "...", onboarding_stage: "..." } }

      def use_case
        unless current_user
          return render json: { message: 'Not authenticated' }, status: :unauthorized
        end

        attrs   = params.require(:user).permit(:primary_use_case, :onboarding_stage)
        use_case = attrs[:primary_use_case]
        stage    = attrs[:onboarding_stage]

        current_user.primary_use_case = use_case if use_case.present?
        current_user.onboarding_stage = stage if stage.present?

        if current_user.save
          render json: {
            message: 'Use case saved',
            data: UserSerializer.new(current_user)
          }, status: :ok
        else
          render json: { message: current_user.errors.full_messages.to_sentence }, status: :unprocessable_entity
        end
      end

      # ========= BASIC PROFILE / LIGHT KYC =========

            # ========= BASIC PROFILE / LIGHT KYC =========

      def basic_profile
        unless current_user
          return render json: { message: 'Not authenticated' }, status: :unauthorized
        end

        permitted     = basic_profile_params
        profile_attrs = permitted[:user_profile_attributes] || {}
        id_type       = permitted[:id_type]

        ActiveRecord::Base.transaction do
          profile = current_user.user_profile || current_user.build_user_profile
          profile.assign_attributes(profile_attrs)

          # 🔹 Handle optional file uploads (ID & proof of address)
          if params[:user].present?
            if params[:user][:id_document].present?
              profile.id_document.attach(params[:user][:id_document])
            end

            if params[:user][:proof_of_address].present?
              profile.proof_of_address.attach(params[:user][:proof_of_address])
            end
          end

          unless profile.save
            raise ActiveRecord::Rollback, profile.errors.full_messages.to_sentence
          end

          current_user.id_type = id_type if id_type.present?

          has_names   = profile.first_name.present? && profile.last_name.present?
          has_phone   = profile.phone_number.present?
          has_id_type = current_user.id_type.present?
          has_address = profile.address_line1.present? && profile.city.present? && profile.country.present?
          has_proof   = profile.proof_of_address_type.present?

          if has_names && has_phone && has_id_type && has_address && has_proof
            if current_user.kyc_level.blank? || current_user.kyc_level == 'tier_0'
              current_user.kyc_level = 'tier_1'
            end
          else
            current_user.kyc_level ||= 'tier_0'
          end

          unless current_user.save
            raise ActiveRecord::Rollback, current_user.errors.full_messages.to_sentence
          end
        end

        render json: {
          message: 'Profile updated',
          data: UserSerializer.new(current_user)
        }, status: :ok
      rescue StandardError => e
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

      # ========= HELPERS =========

      private

      def set_user
        @user = User.find_by(id: params[:id])
      end

      # General strong params
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

      # For /user_update
      def user_update_params
        params.require(:user).permit(
          :email,
          :active,
          user_profile_attributes: %i[
            id
            first_name
            last_name
            phone_number
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

      # For /basic_profile
            def basic_profile_params
        params.require(:user).permit(
          :id_type,
          :id_document,        # 🔹 file field for ID
          :proof_of_address,   # 🔹 file field for proof of address
          user_profile_attributes: %i[
            id
            first_name
            last_name
            phone_number
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
