# frozen_string_literal: true

require 'test_helper'

class CardTokensControllerTest < ActionDispatch::IntegrationTest
  setup do
    @card_token = card_tokens(:one)
  end

  test 'should get index' do
    get card_tokens_url, as: :json
    assert_response :success
  end

  test 'should create card_token' do
    assert_difference('CardToken.count') do
      post card_tokens_url,
           params: { card_token: { order_item_id: @card_token.order_item_id, reveal: @card_token.reveal, token: @card_token.token } }, as: :json
    end

    assert_response :created
  end

  test 'should show card_token' do
    get card_token_url(@card_token), as: :json
    assert_response :success
  end

  test 'should update card_token' do
    patch card_token_url(@card_token),
          params: { card_token: { order_item_id: @card_token.order_item_id, reveal: @card_token.reveal, token: @card_token.token } }, as: :json
    assert_response :success
  end

  test 'should destroy card_token' do
    assert_difference('CardToken.count', -1) do
      delete card_token_url(@card_token), as: :json
    end

    assert_response :no_content
  end
end
