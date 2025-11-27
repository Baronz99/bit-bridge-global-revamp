# frozen_string_literal: true

require 'test_helper'

class MonnifyControllerTest < ActionDispatch::IntegrationTest
  test 'should get webhook' do
    get monnify_webhook_url
    assert_response :success
  end
end
