# frozen_string_literal: true

require 'test_helper'

class ProductsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @product = products(:one)
  end

  test 'should get index' do
    get products_url, as: :json
    assert_response :success
  end

  test 'should create product' do
    assert_difference('Product.count') do
      post products_url,
           params: { product: { alert_info: @product.alert_info, description: @product.description, extra_info: @product.extra_info, featured: @product.featured, header_info: @product.header_info, notice_info: @product.notice_info, product_type: @product.product_type, provider: @product.provider, provision: @product.provision, rating: @product.rating, value: @product.value, value_max: @product.value_max, value_min: @product.value_min } }, as: :json
    end

    assert_response :created
  end

  test 'should show product' do
    get product_url(@product), as: :json
    assert_response :success
  end

  test 'should update product' do
    patch product_url(@product),
          params: { product: { alert_info: @product.alert_info, description: @product.description, extra_info: @product.extra_info, featured: @product.featured, header_info: @product.header_info, notice_info: @product.notice_info, product_type: @product.product_type, provider: @product.provider, provision: @product.provision, rating: @product.rating, value: @product.value, value_max: @product.value_max, value_min: @product.value_min } }, as: :json
    assert_response :success
  end

  test 'should destroy product' do
    assert_difference('Product.count', -1) do
      delete product_url(@product), as: :json
    end

    assert_response :no_content
  end
end
