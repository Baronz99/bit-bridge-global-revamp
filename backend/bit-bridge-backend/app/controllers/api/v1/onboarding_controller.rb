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
      # Accepts ANY of these shapes:
      # 1) { primary_use_case: "...", onboarding_stage: "..." }
      # 2) { use_case: "...", onboarding_stage: "..." }
      # 3) { selected_use_case: "...", ... }
      # 4) { user: { primary_use_case: "...", onboarding_stage: "..." } }
      # 5) { user: { use_case: "...", ... } }
      def update_use_case
        unless current_user
          render json: { errors: ['Not authenticated'] }, status: :unauthorized and return
        end

        # Try several keys (flat + nested) so we don't break if
        # the frontend sends a slightly different name.
        use_case =
          params[:primary_use_case].presence ||
          params[:use_case].presence ||
          params[:selected_use_case].presence ||
          params.dig(:user, :primary_use_case).presence ||
          params.dig(:user, :use_case).presence ||
          params.dig(:user, :selected_use_case).presence

        stage =
          params[:onboarding_stage].presence ||
          params[:stage].presence ||
          params.dig(:user, :onboarding_stage).presence ||
          params.dig(:user, :stage).presence ||
          'use_case_selected'

        if use_case.blank?
          render json: { errors: ['primary_use_case is required'] },
                 status: :unprocessable_entity and return
        end

        current_user.primary_use_case = use_case
        current_user.onboarding_stage = stage

        if current_user.save
          render json: UserSerializer.new(current_user).as_json, status: :ok
        else
          render json: {
            errors: current_user.errors.full_messages.presence || ['Unable to update use case']
          }, status: :unprocessable_entity
        end
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
    end
  end
end
