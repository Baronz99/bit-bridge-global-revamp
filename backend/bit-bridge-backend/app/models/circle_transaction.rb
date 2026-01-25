# frozen_string_literal: true

class CircleTransaction < ApplicationRecord
  belongs_to :circle
  belongs_to :user
  belongs_to :wallet_transaction, class_name: 'Transaction', optional: true

  # Optional tag to link a transaction to an activity/goal
  belongs_to :circle_activity, optional: true

  has_one :dispute, dependent: :destroy

  has_many :reactions,
           class_name: 'CircleTransactionReaction',
           dependent: :destroy,
           inverse_of: :circle_transaction

  # IMPORTANT:
  # Use _prefix to avoid method collisions like `credit?` / `debit?`
  enum :direction, { credit: 0, debit: 1 }, prefix: true

  validates :amount_cents, numericality: { greater_than: 0 }
  validate :activity_belongs_to_same_circle

  before_validation :set_occurred_at, on: :create

  # ✅ Refresh activity status for create/update/destroy (more robust than create-only)
  after_commit :refresh_linked_activity_status, on: %i[create update destroy]

  private

  def set_occurred_at
    self.occurred_at ||= Time.current
  end

  def activity_belongs_to_same_circle
    return if circle_activity_id.blank?

    # Avoid extra query if association already loaded
    act = circle_activity || CircleActivity.find_by(id: circle_activity_id)
    return if act.nil? # let FK/other validation handle missing

    if act.circle_id != circle_id
      errors.add(:circle_activity_id, 'must belong to the same circle as this transaction')
    end
  end

  def refresh_linked_activity_status
    return unless circle_activity_id.present?
    # If the record was destroyed, circle_activity association might be nil, so lookup safely
    CircleActivity.find_by(id: circle_activity_id)&.refresh_status!
  end
end
