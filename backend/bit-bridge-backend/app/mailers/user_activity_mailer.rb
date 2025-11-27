# frozen_string_literal: true

class UserActivityMailer < ApplicationMailer
  # Subject can be set in your I18n file at config/locales/en.yml
  # with the following lookup:
  #
  #   en.user_activity_mailer.send_gift_token.subject
  #
  def send_gift_token(email, provision, token)
    Rails.logger.info "Sending email to: #{email} with token: #{token}"

    @email = email
    @token = token
    @provision = provision

    mail(to: email, subject: 'Gift CardToken')
  end
end
