# frozen_string_literal: true

class BillPaymentIntent < ApplicationRecord
  belongs_to :user
  belongs_to :bill_order, optional: true

  enum :status, {
    draft: 0,
    awaiting_funds: 1,
    ready: 2,
    processing: 3,
    completed: 4,
    failed: 5,
    refunded: 6,
    expired: 7
  }

  validates :bill_type, presence: true
  validates :amount, presence: true, numericality: { greater_than: 0 }
  validates :fee, numericality: { greater_than_or_equal_to: 0 }
  validates :total, presence: true, numericality: { greater_than: 0 }

  scope :recent_first, -> { order(created_at: :desc) }

  def self.find_or_create_for_bill_order!(bill_order:, expires_at: 30.minutes.from_now)
    existing = where(bill_order_id: bill_order.id).recent_first.first
    return existing if existing.present?

    create!(
      user: bill_order.user,
      bill_order: bill_order,
      bill_type: bill_order.service_type.to_s,
      amount: bill_order.amount.to_d,
      fee: (bill_order.service_charge || 0).to_d,
      total: (bill_order.total_amount.presence || bill_order.amount).to_d,
      metadata: {
        bill_order_id: bill_order.id,
        service_type: bill_order.service_type,
        biller: bill_order.biller
      },
      expires_at: expires_at
    )
  end
end
