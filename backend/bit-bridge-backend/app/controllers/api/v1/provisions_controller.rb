# frozen_string_literal: true

module Api
  module V1
    class ProvisionsController < ApplicationController
      before_action :set_provision, only: %i[show update destroy]
      before_action :require_admin!, only: %i[create update destroy]
      skip_before_action :authenticate_user!, only: %i[index show]
      # GET /provisions
      def index
        @provisions = Provision.includes(
          { product: :provisions },
          order_items: %i[product order_detail card_token]
        )
        render json: { data: ActiveModelSerializers::SerializableResource.new(@provisions) }
      end

      # GET /provisions/1
      def show
        render json: { data: ProvisionSerializer.new(@provision) }, status: :ok
      end

      # POST /provisions
      def create
        @provision = Provision.new(provision_params)

        if @provision.save
          render json: { data: ProvisionSerializer.new(@provision), message: 'provision has been created' },
                 status: :created
        else
          render_validation_error(@provision)
        end
      end

      # PATCH/PUT /provisions/1
      def update
        if @provision.update(provision_params)
          render json: { data: ProvisionSerializer.new(@provision), message: 'Provision updated' }, status: :ok
        else
          render_validation_error(@provision)
        end
      end

      # DELETE /provisions/1
      def destroy
        @provision.destroy!
      end

      private

      # Use callbacks to share common setup or constraints between actions.
      def set_provision
        @provision = Provision.find(params[:id])
      end

      # Only allow a list of trusted parameters through.
      def provision_params
        params.require(:provision).permit(:name, :value, :description, :currency, :min_value, :max_value,
                                          :provision_value_type, :product_id, :service_type, :info, :notice, value_range: [])
      end

      def require_admin!
        return if current_user&.admin?

        render json: { message: 'Admin access required' }, status: :forbidden
      end

      def render_validation_error(record)
        render json: {
          message: record.errors.full_messages.to_sentence,
          errors: record.errors.to_hash(true)
        }, status: :unprocessable_entity
      end
    end
  end
end
