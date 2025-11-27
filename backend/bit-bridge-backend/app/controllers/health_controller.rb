# backend/bit-bridge-backend/app/controllers/health_controller.rb
class HealthController < ApplicationController
  # Make health check public (no login required)
  skip_before_action :authenticate_user!

  def index
    render json: { status: 'ok' }, status: :ok
  end
end
