# frozen_string_literal: true

require 'test_helper'

class CardsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @card = cards(:one)
  end

  test 'should get index' do
    get cards_url, as: :json
    assert_response :success
  end

  test 'should create card' do
    assert_difference('Card.count') do
      post cards_url,
           params: { card: { card_brand: @card.card_brand, card_currency: @card.card_currency, card_id: @card.card_id, card_limit: @card.card_limit, card_type: @card.card_type, cardholder_id: @card.cardholder_id, funding_amount: @card.funding_amount, meta_data: @card.meta_data, pin_encrypted: @card.pin_encrypted, status: @card.status, transaction_reference: @card.transaction_reference, user_id: @card.user_id } }, as: :json
    end

    assert_response :created
  end

  test 'should show card' do
    get card_url(@card), as: :json
    assert_response :success
  end

  test 'should update card' do
    patch card_url(@card),
          params: { card: { card_brand: @card.card_brand, card_currency: @card.card_currency, card_id: @card.card_id, card_limit: @card.card_limit, card_type: @card.card_type, cardholder_id: @card.cardholder_id, funding_amount: @card.funding_amount, meta_data: @card.meta_data, pin_encrypted: @card.pin_encrypted, status: @card.status, transaction_reference: @card.transaction_reference, user_id: @card.user_id } }, as: :json
    assert_response :success
  end

  test 'should destroy card' do
    assert_difference('Card.count', -1) do
      delete card_url(@card), as: :json
    end

    assert_response :no_content
  end
end
