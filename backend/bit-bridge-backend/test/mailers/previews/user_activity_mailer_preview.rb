# frozen_string_literal: true

# Preview all emails at http://localhost:3000/rails/mailers/user_activity_mailer
class UserActivityMailerPreview < ActionMailer::Preview
  # Preview this email at http://localhost:3000/rails/mailers/user_activity_mailer/send_gift_token
  def send_gift_token
    UserActivityMailer.send_gift_token
  end
end
