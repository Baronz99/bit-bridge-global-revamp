# frozen_string_literal: true

require 'test_helper'

class ProvisionsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @provision = provisions(:one)
  end

  test 'should get index' do
    get provisions_url, as: :json
    assert_response :success
  end

  test 'should create provision' do
    assert_difference('Provision.count') do
      post provisions_url,
           params: { provision: { max_value: @provision.max_value, min_value: @provision.min_value, name: @provision.name, product_id: @provision.product_id, provision_value_type: @provision.provision_value_type } }, as: :json
    end

    assert_response :created
  end

  test 'should show provision' do
    get provision_url(@provision), as: :json
    assert_response :success
  end

  test 'should update provision' do
    patch provision_url(@provision),
          params: { provision: { max_value: @provision.max_value, min_value: @provision.min_value, name: @provision.name, product_id: @provision.product_id, provision_value_type: @provision.provision_value_type } }, as: :json
    assert_response :success
  end

  test 'should destroy provision' do
    assert_difference('Provision.count', -1) do
      delete provision_url(@provision), as: :json
    end

    assert_response :no_content
  end
end
