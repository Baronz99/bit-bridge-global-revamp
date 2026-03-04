# frozen_string_literal: true

module Api
  module V1
    module Admin
      class StatisticsController < ApplicationController
        before_action :require_admin_access!

        def index
          stats = Statistics.new
          render json: {
                   data: {
                     users: stats.total_users,
                     total_withdrawals: stats.total_withdrawals,
                     total_deposits: stats.total_deposits
                   }
                 },
                 status: :ok
        end

        private

        def require_admin_access!
          return if current_user&.admin_access?

          render json: { message: 'Not authorized' }, status: :forbidden
        end
      end
    end
  end
end
