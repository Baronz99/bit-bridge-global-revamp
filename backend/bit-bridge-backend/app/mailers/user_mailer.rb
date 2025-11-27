# frozen_string_literal: true

class UserMailer < ApplicationMailer
  def welcome_email(user)
    @user = user
    attachments.inline['logo'] = File.read(Rails.root.join('app/assets/images/logo1.png'))

    @url = 'https://bitbridgeglobal.com'
    @confirmation_url = confirm_url(@user.confirmation_token)
    mail(to: @user.email, subject: 'Welcome to Bit Bridge Global')
  end

  def login_alert(user)
    attachments.inline['logo'] = File.read(Rails.root.join('app/assets/images/logo1.png'))
    @user = user
    mail(to: @user.email, subject: 'Login Alert to BitBridge Global')
  end

  def send_password_reset(user, token)
    @user = user
    @url  = password_reset_url(@user, token)
    mail(to: @user.email, subject: 'Reset Your Password')
  end

  private

  def password_reset_url(user, token)
    frontend_base = Rails.configuration.x.frontend_url
    "#{frontend_base}/reset_password?password_token=#{token}&email=#{CGI.escape(user.email)}"
  end

  def confirm_url(token)
    frontend_base = Rails.configuration.x.frontend_url
    "#{frontend_base}/confirmation?confirmation_token=#{token}"
  end
end
