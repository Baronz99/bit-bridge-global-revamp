# frozen_string_literal: true

module Api
  module V1
    class ServiceCatalogController < ApplicationController
      skip_before_action :authenticate_user!, only: [:index]

      def index
        data = ::Core::Catalog::ServiceCatalogQuery.new(
          section: params[:section],
          category: params[:category]
        ).call

        render json: { success: true, data: data }, status: :ok
      end
    end
  end
end
