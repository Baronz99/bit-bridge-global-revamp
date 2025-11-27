# frozen_string_literal: true

class OrderMailer < ApplicationMailer
  def purchase_confirmation(order)
    @order = order
    attachments.inline['logo'] = File.read(Rails.root.join('app/assets/images/logo1.png'))

    mail(
      to: @order.email,
      subject: "BitBridge Global - Purchase Confirmation (Order ##{@order.transaction_id})"
    )
  end
end
