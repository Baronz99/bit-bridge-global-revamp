# frozen_string_literal: true

class OrderMailer < ApplicationMailer
  def purchase_confirmation(order)
    @order = order
    attach_brand_logo

    mail(
      to: @order.email,
      subject: subject_for(@order)
    )
  end

  private

  def subject_for(order)
    order_ref = order.transaction_id.presence || order.id
    if order.status.to_s == 'completed'
      "BitBridge Global - Receipt (Order ##{order_ref})"
    else
      "BitBridge Global - Transaction Update (Order ##{order_ref})"
    end
  end
end
