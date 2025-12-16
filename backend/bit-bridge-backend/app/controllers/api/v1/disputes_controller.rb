# frozen_string_literal: true

module Api
  module V1
    class DisputesController < ApplicationController
      before_action :authenticate_user!

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

        render json: dispute.as_json(
          only: %i[id status reason note created_at],
          include: { raised_by: { only: %i[id email] } }
        ), status: :created
      rescue ActiveRecord::RecordNotFound
        render json: { error: 'Transaction not found' }, status: :not_found
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end
    end
  end
end
