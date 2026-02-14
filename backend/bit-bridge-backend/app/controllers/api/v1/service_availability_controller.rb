# frozen_string_literal: true

module Api
  module V1
    class ServiceAvailabilityController < ApplicationController
      before_action :authenticate_user!

      def index
        snapshot = ServiceAvailability::SnapshotBuilder.new.call

        render json: { success: true, data: snapshot }, status: :ok
      end
    end
  end
end
