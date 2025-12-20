# frozen_string_literal: true

class CircleActivity < ApplicationRecord
  belongs_to :circle
  belongs_to :created_by, class_name: 'User'

  has_many :circle_transactions, dependent: :nullify

  enum :contribution_frequency, { one_time: 0, weekly: 1, monthly: 2 }
  enum :status, { active: 0, completed: 1, cancelled: 2, expired: 3 }

  validates :name, presence: true
  validates :target_amount_cents, numericality: { greater_than: 0 }
  validates :deadline_at, presence: true

  scope :recent_first, -> { order(created_at: :desc) }

  # ✅ This is the method your controller is calling in as_json(methods: ...)
  def raised_amount_cents
    circle_transactions.where(direction: CircleTransaction.directions[:credit]).sum(:amount_cents)
  end

  def refresh_status!
    return if cancelled?

    now = Time.current

    if deadline_at.present? && deadline_at < now && !completed?
      update!(status: :expired)
      return
    end

    if raised_amount_cents >= target_amount_cents && !completed?
      update!(status: :completed)
    elsif completed? && raised_amount_cents < target_amount_cents
      update!(status: :active)
    end
  end
end
