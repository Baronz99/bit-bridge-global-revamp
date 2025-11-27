# frozen_string_literal: true

class CardToken < ApplicationRecord
  belongs_to :order_item

  has_one :order_detail, through: :order_item
  # after_update  :send_gift_card_token, if: :is_token_changed?
  after_create  :send_gift_card_token

  default_scope { order(created_at: :desc) }


  def is_token_changed?
    saved_change_to_token?
  end

  def send_gift_card_token
    UserActivityMailer.send_gift_token(order_detail.user.email, order_item.provision.name, token).deliver_later
  end
end
