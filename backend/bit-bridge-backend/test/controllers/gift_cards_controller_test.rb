# frozen_string_literal: true

require 'test_helper'

class GiftCardsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @gift_card = gift_cards(:one)
  end

  test 'should get index' do
    get gift_cards_url, as: :json
    assert_response :success
  end

  test 'should create gift_card' do
    assert_difference('GiftCard.count') do
      post gift_cards_url,
           params: { gift_card: { alert_info: @gift_card.alert_info, description: @gift_card.description, header_info: @gift_card.header_info, notice_info: @gift_card.notice_info, provider: @gift_card.provider, provision: @gift_card.provision, rating: @gift_card.rating, value: @gift_card.value, value_max: @gift_card.value_max, value_min: @gift_card.value_min } }, as: :json
    end

    assert_response :created
  end

  test 'should show gift_card' do
    get gift_card_url(@gift_card), as: :json
    assert_response :success
  end

  test 'should update gift_card' do
    patch gift_card_url(@gift_card),
          params: { gift_card: { alert_info: @gift_card.alert_info, description: @gift_card.description, header_info: @gift_card.header_info, notice_info: @gift_card.notice_info, provider: @gift_card.provider, provision: @gift_card.provision, rating: @gift_card.rating, value: @gift_card.value, value_max: @gift_card.value_max, value_min: @gift_card.value_min } }, as: :json
    assert_response :success
  end

  test 'should destroy gift_card' do
    assert_difference('GiftCard.count', -1) do
      delete gift_card_url(@gift_card), as: :json
    end

    assert_response :no_content
  end
end
