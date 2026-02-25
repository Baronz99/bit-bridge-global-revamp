# frozen_string_literal: true

class RefundRequest < ApplicationRecord
  enum :status, {
    received: 0,
    investigating: 1,
    approved: 2,
    rejected: 3,
    refunded: 4
  }

  belongs_to :user, optional: true
  belongs_to :handled_by_admin, class_name: 'User', optional: true

  validates :transaction_reference, presence: true
  validates :reason, presence: true
  validates :requested_at, presence: true

  STATUS_TRANSITIONS = {
    received: %w[investigating approved rejected refunded],
    investigating: %w[approved rejected refunded],
    approved: %w[refunded],
    rejected: [],
    refunded: []
  }.freeze

  def can_transition_to?(new_status)
    target = new_status.to_s
    STATUS_TRANSITIONS.fetch(status.to_sym, []).include?(target)
  end
end
