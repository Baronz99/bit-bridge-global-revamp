# frozen_string_literal: true

module Api
  module V1
    class OnboardingController < ApplicationController
      before_action :authenticate_user!

      # PATCH /api/v1/onboarding/profile
      #
      # Expect params like:
      # {
      #   user: {
      #     first_name: "Jane",
      #     last_name: "Doe",
      #     phone_number: "080...",
      #     date_of_birth: "1995-01-01"
      #   }
      # }
      def update_profile
        profile = current_user.user_profile || current_user.build_user_profile

        profile.assign_attributes(profile_params)

        ActiveRecord::Base.transaction do
          profile.save!
          current_user.update!(onboarding_stage: 'basic_profile')
        end

        render json: UserSerializer.new(current_user).as_json, status: :ok
      rescue ActiveRecord::RecordInvalid => e
        render json: {
          errors: profile.errors.full_messages.presence || [e.message]
        }, status: :unprocessable_entity
      end

      # PATCH /api/v1/onboarding/use_case
      #
      # Expect params like:
      # {
      #   primary_use_case: "send_and_receive",
      #   onboarding_stage: "use_case_selected",        # optional, we override to this anyway
      #   user_profile_attributes: {
      #     first_name: "John",
      #     last_name: "Doe",
      #     date_of_birth: "1995-01-01"
      #   }
      # }
      def update_use_case
        attrs = use_case_params
        use_case = attrs[:primary_use_case]

        unless use_case.present?
          return render json: { errors: ['primary_use_case is required'] },
                        status: :unprocessable_entity
        end

        # Always force the stage to "use_case_selected" when this endpoint is hit
        attrs[:onboarding_stage] = 'use_case_selected'

        current_user.update!(attrs)

        render json: UserSerializer.new(current_user).as_json, status: :ok
      rescue ActiveRecord::RecordInvalid => e
        render json: {
          errors: current_user.errors.full_messages.presence || [e.message]
        }, status: :unprocessable_entity
      end

      # POST /api/v1/onboarding/kyc
      #
      # Expect params like:
      # {
      #   id_type:   "bvn",        # or "nin", "passport", etc.
      #   id_number: "12345678901",
      #   kyc_level: "tier_1"      # optional, defaults to "tier_1"
      # }
      def submit_kyc
        current_user.update!(
          id_type:   params[:id_type],
          id_number: params[:id_number],
          kyc_level: params[:kyc_level].presence || 'tier_1',
          onboarding_stage: 'kyc_submitted'
        )

        render json: UserSerializer.new(current_user).as_json, status: :ok
      rescue ActiveRecord::RecordInvalid => e
        render json: {
          errors: current_user.errors.full_messages.presence || [e.message]
        }, status: :unprocessable_entity
      end

      private

      def profile_params
        # These columns should already exist on user_profiles
        params.require(:user).permit(
          :first_name,
          :last_name,
          :phone_number,
          :date_of_birth
        )
      end

      # ✅ New: strong params for the use-case step,
      # accepting nested user_profile_attributes.
      def use_case_params
        params.permit(
          :primary_use_case,
          :onboarding_stage,
          user_profile_attributes: %i[first_name last_name date_of_birth]
        )
      end
    end
  end
end
