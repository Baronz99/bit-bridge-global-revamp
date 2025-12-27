# frozen_string_literal: true

module Api
  module V1
    class CircleActivitiesController < ApplicationController
      before_action :authenticate_user!
      before_action :ensure_tier1!, message: 'Complete Tier 1 verification to use shared groups.'
      before_action :set_circle
      before_action :authorize_create!, only: [:create]

      # GET /api/v1/circles/:circle_id/activities
      def index
        activities = @circle.circle_activities.recent_first

        render json: activities.map { |a| activity_json(a) }
      end

      # GET /api/v1/circles/:circle_id/activities/:id
      # Returns activity + recent linked transactions (contributions)
      def show
        activity = @circle.circle_activities.find(params[:id])

        txs = activity.circle_transactions
                      .includes(:user)
                      .order(occurred_at: :desc)
                      .limit(50)

        render json: {
          activity: activity_json(activity),
          transactions: txs.map { |tx| tx_json(tx) }
        }
      end

      # POST /api/v1/circles/:circle_id/activities
      def create
        activity = @circle.circle_activities.new(activity_params)
        activity.created_by = current_user
        activity.status ||= :active

        if activity.save
          render json: { activity: activity_json(activity) }, status: :created
        else
          render json: { errors: activity.errors.full_messages }, status: :unprocessable_entity
        end
      end

      private

      def set_circle
        @circle = current_user.circles.find(params[:circle_id])
      rescue ActiveRecord::RecordNotFound
        render json: { error: 'Circle not found' }, status: :not_found
      end

      def authorize_create!
        memberships = @circle.circle_memberships
        membership_for_current = memberships.find { |m| m.user_id == current_user.id }

        allowed =
          (@circle.owner_id == current_user.id) ||
          (membership_for_current && membership_for_current.admin?)

        return if allowed

        render json: { errors: ['Not authorised to create activities in this group'] }, status: :forbidden
      end

      def activity_params
        params.require(:activity).permit(:name, :target_amount_cents, :deadline_at, :contribution_frequency)
      end

      def activity_json(activity)
        activity.as_json(
          only: %i[id name target_amount_cents deadline_at contribution_frequency status created_at],
          methods: %i[raised_amount_cents],
          include: { created_by: { only: %i[id email] } }
        )
      end

      def tx_json(tx)
        tx.as_json(
          only: %i[id amount_cents direction kind description reference occurred_at circle_activity_id],
          include: { user: { only: %i[id email] } }
        )
      end
    end
  end
end
