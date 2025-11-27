# frozen_string_literal: true

module Users
  class UsersController < ApplicationController
    def index
      render json: { data: current_user }, status: :ok
    end

    def update; end

    # def delete
    # end
  end
end
