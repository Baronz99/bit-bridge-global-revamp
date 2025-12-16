module Api
  module V1
    class CircleTransactionsController < ApplicationController
      before_action :authenticate_user!

      def react
        tx = CircleTransaction.find(params[:id])

        # Authorization: must belong to circle
        unless current_user.circles.exists?(id: tx.circle_id)
          return render json: { errors: ['Not authorised.'] }, status: :forbidden
        end

        emoji = params[:emoji].to_s
        reaction = tx.reactions.create!(user: current_user, emoji: emoji)

        render json: {
          ok: true,
          reaction: reaction.as_json(only: %i[id emoji user_id created_at])
        }, status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def unreact
        tx = CircleTransaction.find(params[:id])

        unless current_user.circles.exists?(id: tx.circle_id)
          return render json: { errors: ['Not authorised.'] }, status: :forbidden
        end

        emoji = params[:emoji].to_s
        tx.reactions.where(user: current_user, emoji: emoji).destroy_all

        render json: { ok: true }, status: :ok
      end
    end
  end
end
