# frozen_string_literal: true

require 'test_helper'

class BillOrdersControllerTest < ActionDispatch::IntegrationTest
  setup do
    @bill_order = bill_orders(:one)
  end

  test 'should get index' do
    get bill_orders_url, as: :json
    assert_response :success
  end

  test 'should create bill_order' do
    assert_difference('BillOrder.count') do
      post bill_orders_url,
           params: { bill_order: { amount: @bill_order.amount, email: @bill_order.email, meter_number: @bill_order.meter_number, meter_type: @bill_order.meter_type, name: @bill_order.name, payment_type: @bill_order.payment_type, phone: @bill_order.phone, serviceID: @bill_order.serviceID, service_type: @bill_order.service_type, status: @bill_order.status, tariff_class: @bill_order.tariff_class } }, as: :json
    end

    assert_response :created
  end

  test 'should show bill_order' do
    get bill_order_url(@bill_order), as: :json
    assert_response :success
  end

  test 'should update bill_order' do
    patch bill_order_url(@bill_order),
          params: { bill_order: { amount: @bill_order.amount, email: @bill_order.email, meter_number: @bill_order.meter_number, meter_type: @bill_order.meter_type, name: @bill_order.name, payment_type: @bill_order.payment_type, phone: @bill_order.phone, serviceID: @bill_order.serviceID, service_type: @bill_order.service_type, status: @bill_order.status, tariff_class: @bill_order.tariff_class } }, as: :json
    assert_response :success
  end

  test 'should destroy bill_order' do
    assert_difference('BillOrder.count', -1) do
      delete bill_order_url(@bill_order), as: :json
    end

    assert_response :no_content
  end
end
