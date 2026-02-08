# frozen_string_literal: true

class OrderMailer < ApplicationMailer
  def purchase_confirmation(order)
    @order = order
    logo_path = Rails.root.join('app/assets/images/logo1.png')
    attachments.inline['logo'] = File.read(logo_path) if File.exist?(logo_path)

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
