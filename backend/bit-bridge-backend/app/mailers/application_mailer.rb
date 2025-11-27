# frozen_string_literal: true

class ApplicationMailer < ActionMailer::Base
  default from: 'support@bitbridgeglobal.com'
  layout 'mailer'
end
