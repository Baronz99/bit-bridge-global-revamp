# frozen_string_literal: true

# Preview all emails at http://localhost:3000/rails/mailers/send_email_comfirmation_mailer
class SendEmailComfirmationMailerPreview < ActionMailer::Preview
  # Preview this email at http://localhost:3000/rails/mailers/send_email_comfirmation_mailer/welcome_email
  def welcome_email
    SendEmailComfirmationMailer.welcome_email
  end
end
