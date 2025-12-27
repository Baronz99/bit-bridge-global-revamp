# app/controllers/api/v1/circle_memberships_controller.rb
# frozen_string_literal: true

module Api
  module V1
    class CircleMembershipsController < ApplicationController
      before_action :authenticate_user!
      before_action :ensure_tier1!, message: 'Complete Tier 1 verification to use shared groups.'
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

        # 1) Only the circle owner/admin can add people
        memberships = @circle.circle_memberships
        membership_for_current = memberships.find { |m| m.user_id == current_user.id }
        is_owner = @circle.owner_id == current_user.id
        is_admin = membership_for_current&.admin?

        unless is_owner || is_admin
          return render json: { errors: ['Only the group owner/admin can add people right now.'] },
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
          render json: member_payload(membership, true).merge(
            invited_by: {
              id: current_user.id,
              email: current_user.email
            }
          ), status: :created
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

      def member_payload(membership, allow_full)
        user = membership.user
        profile = user.user_profile
        first_name = profile&.first_name
        last_name = profile&.last_name
        phone = profile&.phone_number
        email = user.email

        if allow_full
          display_name = [first_name, last_name].compact.join(' ')
          display_name = email if display_name.blank?
          return {
            id: membership.id,
            role: membership.role,
            masked: false,
            user: {
              id: user.id,
              email: email,
              phone_number: phone,
              first_name: first_name,
              last_name: last_name,
              display_name: display_name
            }
          }
        end

        {
          id: membership.id,
          role: membership.role,
          masked: true,
          user: {
            id: user.id,
            email: mask_email(email),
            phone_number: mask_phone(phone),
            display_name: mask_name(first_name, last_name, email)
          }
        }
      end

      def mask_email(email)
        return '' if email.blank?
        local, domain = email.split('@', 2)
        return email if domain.blank?
        local_mask = local.length <= 1 ? '*' : "#{local[0]}***"
        domain_name, tld = domain.split('.', 2)
        domain_mask = domain_name.present? ? "#{domain_name[0]}***" : '***'
        tld_part = tld.present? ? ".#{tld}" : ''
        "#{local_mask}@#{domain_mask}#{tld_part}"
      end

      def mask_phone(phone)
        return '' if phone.blank?
        digits = phone.to_s.gsub(/\D/, '')
        return '*' * phone.length if digits.length <= 4
        digits.gsub(/\d(?=\d{4})/, '*')
      end

      def mask_name(first_name, last_name, email)
        if first_name.present? || last_name.present?
          fi = first_name.to_s.strip[0] || ''
          li = last_name.to_s.strip[0] || ''
          return [fi, li].reject(&:blank?).map { |c| "#{c}." }.join(' ').strip
        end
        mask_email(email)
      end
    end
  end
end
