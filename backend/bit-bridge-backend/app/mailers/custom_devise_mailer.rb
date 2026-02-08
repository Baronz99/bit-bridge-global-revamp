# frozen_string_literal: true

class CustomDeviseMailer < Devise::Mailer
  default from: 'support@bitbridgeglobal.com'

  # ===== EMAIL CONFIRMATION =====
  def confirmation_instructions(record, token, opts = {})
    base_url = Rails.application.credentials[:frontend_url] ||
               ENV['FRONTEND_URL'] ||
               'http://127.0.0.1:5173/' # local React dev URL

    frontend_url = "#{base_url}confirmation?confirmation_token=#{token}"

    begin
      attachments.inline['logo'] = File.read(Rails.root.join('app/assets/images/logo1.png'))
    rescue StandardError
      # if logo missing in dev, don't crash mailer
    end

    opts[:subject] = 'Confirm your account'
    @confirmation_link = frontend_url
    @token = token
    @user = record

    mail(to: record.email, subject: opts[:subject])
  end

  # ===== FORGOT PASSWORD / RESET PASSWORD =====
  def reset_password_instructions(record, token, opts = {})
    base_url = Rails.application.credentials[:frontend_url] ||
               ENV['FRONTEND_URL'] ||
               'http://127.0.0.1:5173/' # local React dev URL

    frontend_base = base_url.to_s.end_with?('/') ? base_url : "#{base_url}/"
    reset_url = "#{frontend_base}reset-password?reset_password_token=#{token}"

    begin
      logo_path = Rails.root.join('app/assets/images/logo1.png')
      attachments.inline['logo'] = File.read(logo_path) if File.exist?(logo_path)
    rescue StandardError
      # ignore missing logo
    end

    opts[:subject] = 'BitBridge Global - Reset Your Password'
    @reset_password_link = reset_url
    @reset_password_within = Devise.reset_password_within
    @token = token
    @user = record

    mail(to: record.email, subject: opts[:subject])
  end
end
