# frozen_string_literal: true

require 'test_helper'

class SendEmailComfirmationMailerTest < ActionMailer::TestCase
  test 'welcome_email' do
    mail = SendEmailComfirmationMailer.welcome_email
    assert_equal 'Welcome email', mail.subject
    assert_equal ['to@example.org'], mail.to
    assert_equal ['from@example.com'], mail.from
    assert_match 'Hi', mail.body.encoded
  end
end
