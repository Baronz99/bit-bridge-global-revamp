# frozen_string_literal: true

require 'test_helper'

class OrderMailerTest < ActionMailer::TestCase
  test 'purchase_confirmation' do
    mail = OrderMailer.purchase_confirmation
    assert_equal 'Purchase confirmation', mail.subject
    assert_equal ['to@example.org'], mail.to
    assert_equal ['from@example.com'], mail.from
    assert_match 'Hi', mail.body.encoded
  end
end
