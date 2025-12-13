# app/controllers/api/v1/circle_memberships_controller.rb
# frozen_string_literal: true

module Api
  module V1
    class CircleMembershipsController < ApplicationController
      before_action :authenticate_user!
      before_action :set_circle

      # POST /api/v1/circles/:circle_id/memberships
      #
      # Params:
      # {
      #   membership: {
      #     email: "friend@example.com",
      #     role:  "member"   # optional, defaults to "member"
      #   }
      # }
      #
      def create
        membership_params = params.require(:membership).permit(:email, :role)

        raw_email = membership_params[:email].to_s.strip
        if raw_email.blank?
          return render json: { errors: ['Enter an email to add.'] },
                        status: :unprocessable_entity
        end

        email = raw_email.downcase

        # 1) Only the circle owner (or future admins) can add people
        unless @circle.owner_id == current_user.id
          return render json: { errors: ['Only the group owner can add people right now.'] },
                        status: :forbidden
        end

        # 2) The person must already have a BitBridge account (MVP rule)
        user = User.find_by(email: email)
        unless user
          return render json: { errors: ['No BitBridge account found for this email. Ask them to sign up first, then try again.'] },
                        status: :unprocessable_entity
        end

        # 3) Don’t add someone twice
        if @circle.members.exists?(id: user.id)
          return render json: { errors: ['This person is already in this group.'] },
                        status: :unprocessable_entity
        end

        # 4) Role – default to "member"
        requested_role = membership_params[:role].presence || 'member'
        if CircleMembership.respond_to?(:roles) && !CircleMembership.roles.key?(requested_role)
          requested_role = 'member'
        end

        membership = @circle.circle_memberships.new(user: user, role: requested_role)

        if membership.save
          render json: {
            id:   membership.id,
            role: membership.role,
            user: {
              id:    user.id,
              email: user.email
            }
          }, status: :created
        else
          render json: { errors: membership.errors.full_messages }, status: :unprocessable_entity
        end
      rescue StandardError => e
        Rails.logger.error("[CircleMemberships#create] #{e.class}: #{e.message}")
        render json: { errors: ['Unable to add this person at the moment. Please try again.'] },
               status: :unprocessable_entity
      end

      private

      def set_circle
        # Only circles the current user belongs to / owns
        @circle = current_user.circles.find(params[:circle_id])
      rescue ActiveRecord::RecordNotFound
        render json: { errors: ['Circle not found.'] }, status: :not_found
      end
    end
  end
end
