# frozen_string_literal: true

require 'test_helper'

class UserActivityMailerTest < ActionMailer::TestCase
  test 'send_gift_token' do
    mail = UserActivityMailer.send_gift_token
    assert_equal 'Send gift token', mail.subject
    assert_equal ['to@example.org'], mail.to
    assert_equal ['from@example.com'], mail.from
    assert_match 'Hi', mail.body.encoded
  end
end
