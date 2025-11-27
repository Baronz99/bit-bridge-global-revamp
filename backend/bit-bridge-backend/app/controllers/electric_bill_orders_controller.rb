# frozen_string_literal: true

class ElectricBillOrdersController < ApplicationController
  before_action :set_electric_bill_order, only: %i[show update destroy]

  # GET /electric_bill_orders
  def index
    @electric_bill_orders = ElectricBillOrder.all

    render json: @electric_bill_orders
  end

  # GET /electric_bill_orders/1
  def show
    render json: @electric_bill_order
  end

  # POST /electric_bill_orders
  def create
    @electric_bill_order = ElectricBillOrder.new(electric_bill_order_params)

    if @electric_bill_order.save
      render json: @electric_bill_order, status: :created, location: @electric_bill_order
    else
      render json: @electric_bill_order.errors, status: :unprocessable_entity
    end
  end

  # PATCH/PUT /electric_bill_orders/1
  def update
    if @electric_bill_order.update(electric_bill_order_params)
      render json: @electric_bill_order
    else
      render json: @electric_bill_order.errors, status: :unprocessable_entity
    end
  end

  # DELETE /electric_bill_orders/1
  def destroy
    @electric_bill_order.destroy!
  end

  private

  # Use callbacks to share common setup or constraints between actions.
  def set_electric_bill_order
    @electric_bill_order = ElectricBillOrder.find(params[:id])
  end

  # Only allow a list of trusted parameters through.
  def electric_bill_order_params
    params.require(:electric_bill_order).permit(:billersCode, :amount, :request_id, :variation_code, :phone,
                                                :serviceID, :email, :type)
  end
end
