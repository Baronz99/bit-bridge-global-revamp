# frozen_string_literal: true

require 'test_helper'

class ElectricBillOrdersControllerTest < ActionDispatch::IntegrationTest
  setup do
    @electric_bill_order = electric_bill_orders(:one)
  end

  test 'should get index' do
    get electric_bill_orders_url, as: :json
    assert_response :success
  end

  test 'should create electric_bill_order' do
    assert_difference('ElectricBillOrder.count') do
      post electric_bill_orders_url,
           params: { electric_bill_order: { amount: @electric_bill_order.amount, billersCode: @electric_bill_order.billersCode, email: @electric_bill_order.email, phone: @electric_bill_order.phone, request_id: @electric_bill_order.request_id, serviceID: @electric_bill_order.serviceID, type: @electric_bill_order.type, variation_code: @electric_bill_order.variation_code } }, as: :json
    end

    assert_response :created
  end

  test 'should show electric_bill_order' do
    get electric_bill_order_url(@electric_bill_order), as: :json
    assert_response :success
  end

  test 'should update electric_bill_order' do
    patch electric_bill_order_url(@electric_bill_order),
          params: { electric_bill_order: { amount: @electric_bill_order.amount, billersCode: @electric_bill_order.billersCode, email: @electric_bill_order.email, phone: @electric_bill_order.phone, request_id: @electric_bill_order.request_id, serviceID: @electric_bill_order.serviceID, type: @electric_bill_order.type, variation_code: @electric_bill_order.variation_code } }, as: :json
    assert_response :success
  end

  test 'should destroy electric_bill_order' do
    assert_difference('ElectricBillOrder.count', -1) do
      delete electric_bill_order_url(@electric_bill_order), as: :json
    end

    assert_response :no_content
  end
end
