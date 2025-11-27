# frozen_string_literal: true

module Api
  module V1
    class UserProfilesController < ApplicationController
      before_action :set_user_profile, only: %i[show update destroy]

      # GET /user_profiles
      def index
        @user_profiles = UserProfile.all
        render json: @user_profiles
      end

      # GET /user_profiles/1
      def show
        render json: current_user
      end

      def user
        render json: current_user
      end

      # POST /user_profiles
      def create
        @user_profile = UserProfile.new(user_profile_params)

        if @user_profile.save
          render json: @user_profile, status: :created, location: @user_profile
        else
          render json: @user_profile.errors, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /user_profiles/1
      def update
        if @user_profile.update(user_profile_params)
          render json: @user_profile
        else
          render json: @user_profile.errors, status: :unprocessable_entity
        end
      end

      # DELETE /user_profiles/1
      def destroy
        @user_profile.destroy!
      end

      private

      # Use callbacks to share common setup or constraints between actions.
      def set_user_profile
        @user_profile = UserProfile.find(params[:id])
      end

      # Only allow a list of trusted parameters through.
      # Only allow a list of trusted parameters through.
def user_profile_params
  params.require(:user_profile).permit(
    :first_name,
    :last_name,
    :phone_number,
    :date_of_birth,          # 👈 NEW
    :address_line1,
    :address_line2,
    :city,
    :state,
    :country,
    :postal_code,
    :proof_of_address_type,
    :user_id
  )
end

    end
  end
end
