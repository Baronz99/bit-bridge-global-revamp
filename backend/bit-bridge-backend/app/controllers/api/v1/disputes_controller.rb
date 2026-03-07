# frozen_string_literal: true

module Api
  module V1
    class DisputesController < ApplicationController
      before_action :authenticate_user!
      before_action :ensure_tier2!, message: 'Complete Tier 2 verification to use shared groups.'

      # POST /api/v1/disputes
      def create
        tx = CircleTransaction.includes(:circle).find(params[:circle_transaction_id])

        # Security: user must belong to this circle (owner or member)
        circle = tx.circle
        allowed =
          circle.owner_id == current_user.id ||
          circle.circle_memberships.exists?(user_id: current_user.id)

        return render json: { error: 'Not authorised' }, status: :forbidden unless allowed

        dispute = tx.create_dispute!(
          raised_by: current_user,
          reason: params[:reason],
          note: params[:note]
        )

        membership = circle.circle_memberships.find_by(user_id: current_user.id)
        render json: {
          id: dispute.id,
          status: dispute.status,
          reason: dispute.reason,
          note: dispute.note,
          created_at: dispute.created_at,
          raised_by: {
            id: current_user.id,
            username: membership&.username,
            display_name: membership&.username.presence || mask_email(current_user.email),
            email: mask_email(current_user.email)
          }
        }, status: :created
      rescue ActiveRecord::RecordNotFound
        render json: { error: 'Transaction not found' }, status: :not_found
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      private

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
    end
  end
end
