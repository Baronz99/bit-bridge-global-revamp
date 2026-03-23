# frozen_string_literal: true

module Api
  module V1
    class CircleTransactionReactionsController < ApplicationController
      before_action :authenticate_user!
      before_action :set_tx!
      before_action :ensure_reaction_access!

      # POST /api/v1/circle_transactions/:id/react
      # body: { emoji: "👍" }
      def react
        emoji = params[:emoji].to_s

        reaction = CircleTransactionReaction.new(
          circle_transaction: @tx,
          user: current_user,
          emoji: emoji
        )

        if reaction.save
          render_counts
        else
          render json: { errors: reaction.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/circle_transactions/:id/unreact?emoji=👍
      def unreact
        emoji = params[:emoji].to_s

        CircleTransactionReaction
          .where(circle_transaction: @tx, user: current_user, emoji: emoji)
          .delete_all

        render_counts
      end

      private

      def set_tx!
        @tx = CircleTransaction.includes(circle: :circle_memberships).find_by(id: params[:id])
        return render(json: { errors: ['Transaction not found'] }, status: :not_found) unless @tx

        circle = @tx.circle
        allowed =
          circle.owner_id == current_user.id ||
          circle.circle_memberships.exists?(user_id: current_user.id)

        return if allowed

        render json: { errors: ['Not authorised'] }, status: :forbidden
      end

      def render_counts
        # Ensure fresh counts after create/delete
        @tx.reload

        counts = @tx.reactions.group(:emoji).count
        mine   = @tx.reactions.where(user_id: current_user.id).pluck(:emoji)

        render json: { reactions: { counts: counts, mine: mine } }, status: :ok
      end

      def ensure_reaction_access!
        ensure_circle_access!(@tx.circle, message: 'Complete verification to react in this circle.')
      end
    end
  end
end
