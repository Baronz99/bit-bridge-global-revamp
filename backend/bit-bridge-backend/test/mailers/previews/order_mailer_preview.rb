# frozen_string_literal: true

# Preview all emails at http://localhost:3000/rails/mailers/order_mailer
class OrderMailerPreview < ActionMailer::Preview
  # Preview this email at http://localhost:3000/rails/mailers/order_mailer/purchase_confirmation
  def purchase_confirmation
    OrderMailer.purchase_confirmation
  end
end
