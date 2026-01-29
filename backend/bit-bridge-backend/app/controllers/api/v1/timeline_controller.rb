# frozen_string_literal: true

module Api
  module V1
    class TimelineController < ApplicationController
      before_action :authenticate_user!

      # GET /api/v1/timeline
      def index
        result =
          TimelineQuery.new(
            user: current_user,
            limit: params[:limit],
            cursor: params[:cursor]
          ).call

        render json: result
      end

      # GET /api/v1/timeline/:id
      # Resolves wallet-tx-*, bill-*, card-evt-*, circle-tx-* into the same shape as /timeline.
      def show
        item =
          TimelineQuery.new(
            user: current_user,
            limit: 1
          ).find_item(params[:id])

        return render json: { message: 'Timeline item not found' }, status: :not_found if item.nil?

        render json: { message: 'ok', data: item }, status: :ok
      end
    end
  end
end
