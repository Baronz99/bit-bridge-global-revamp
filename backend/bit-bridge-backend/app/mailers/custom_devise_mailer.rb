# frozen_string_literal: true

class CustomDeviseMailer < Devise::Mailer
  default from: 'support@bitbridgeglobal.com'

  # ===== EMAIL CONFIRMATION =====
  def confirmation_instructions(record, token, opts = {})
    frontend_url = "#{normalized_frontend_base_url}confirmation?confirmation_token=#{token}"
    recipient = confirmation_recipient_for(record)

    attach_brand_logo

    opts[:subject] = 'Confirm your account'
    @confirmation_link = frontend_url
    @token = token
    @user = record

    mail(to: recipient, subject: opts[:subject])
  end

  # ===== FORGOT PASSWORD / RESET PASSWORD =====
  def reset_password_instructions(record, token, opts = {})
    frontend_base = normalized_frontend_base_url
    reset_url = "#{frontend_base}reset-password?reset_password_token=#{token}"

    attach_brand_logo

    opts[:subject] = 'BitBridge Global - Reset Your Password'
    @reset_password_link = reset_url
    @reset_password_within = Devise.reset_password_within
    @token = token
    @user = record

    mail(to: record.email, subject: opts[:subject])
  end

  private

  def attach_brand_logo
    logo_path = Rails.root.join('app/assets/images/bitbridge-logo.png')
    return unless File.exist?(logo_path)

    attachments.inline['logo'] = File.read(logo_path)
  rescue StandardError => e
    Rails.logger.warn("[CustomDeviseMailer] attach_brand_logo failed: #{e.class} #{e.message}")
  end

  def normalized_frontend_base_url
    raw = Rails.application.credentials[:frontend_url].presence ||
          ENV["FRONTEND_URL"].presence ||
          "http://127.0.0.1:5173/"

    first = raw.to_s.split(",").map(&:strip).reject(&:empty?).first || "http://127.0.0.1:5173/"
    first.end_with?("/") ? first : "#{first}/"
  end

  def confirmation_recipient_for(record)
    if record.respond_to?(:pending_reconfirmation?) &&
       record.pending_reconfirmation? &&
       record.unconfirmed_email.present?
      record.unconfirmed_email
    else
      record.email
    end
  end
end
