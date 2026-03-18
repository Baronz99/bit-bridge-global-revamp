# frozen_string_literal: true

module Api
  module V1
    module Circles
      class TimelineController < ApplicationController
        before_action :authenticate_user!
        before_action :set_circle
        before_action :ensure_circle_access_gate!

        # GET /api/v1/circles/:id/timeline
        def index
          result =
            TimelineQuery.new(
              user: current_user,
              limit: params[:limit],
              cursor: params[:cursor],
              circle_id: @circle.id,
              default_limit: 20,
              max_limit: 50
            ).call

          render json: result
        end

        private

        def set_circle
          @circle = current_user.circles.find(params[:id])
        rescue ActiveRecord::RecordNotFound
          render json: { error: 'Circle not found' }, status: :not_found
        end

        def ensure_circle_access_gate!
          ensure_circle_access!(@circle, message: 'Complete Tier 2 verification to use shared groups.')
        end
      end
    end
  end
end
