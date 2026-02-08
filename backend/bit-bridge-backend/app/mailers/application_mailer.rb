# frozen_string_literal: true

class ApplicationMailer < ActionMailer::Base
  default from: 'support@bitbridgeglobal.com'
  layout 'mailer'

  private

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
end
