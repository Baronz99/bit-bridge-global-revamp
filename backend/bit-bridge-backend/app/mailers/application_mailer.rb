# frozen_string_literal: true

class ApplicationMailer < ActionMailer::Base
  default from: 'support@bitbridgeglobal.com'
  layout 'mailer'

  private

  def recipient_display_name(user: nil, order: nil)
    profile = user&.user_profile
    full_name = [profile&.first_name, profile&.last_name].map { |v| normalize_candidate(v) }.compact.join(' ').strip
    return full_name if full_name.present?

    first_name = normalize_candidate(profile&.first_name)
    return first_name if first_name.present?

    order_name = normalize_candidate(order&.name)
    return order_name if order_name.present? && !phone_like?(order_name)

    'Customer'
  end

  def attach_brand_logo
    candidates = %w[
      app/assets/images/bitbridge-logo-clear.png
      app/assets/images/logo1.png
      app/assets/images/logo.png
    ]

    logo_path = candidates.map { |p| Rails.root.join(p) }.find { |p| File.exist?(p) }
    return if logo_path.nil?

    attachments.inline['logo'] = File.read(logo_path)
  rescue StandardError
    nil
  end

  def normalize_candidate(value)
    cleaned = value.to_s.gsub(/\s+/, ' ').strip
    cleaned.presence
  end

  def phone_like?(value)
    value.to_s.gsub(/\D/, '').length >= 8
  end
end
