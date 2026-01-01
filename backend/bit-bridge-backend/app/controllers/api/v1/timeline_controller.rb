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
    end
  end
end
