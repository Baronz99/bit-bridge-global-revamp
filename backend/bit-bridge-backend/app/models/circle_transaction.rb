# app/models/circle_transaction.rb
class CircleTransaction < ApplicationRecord
  belongs_to :circle
  belongs_to :user

  enum direction: { credit: 0, debit: 1 }

  validates :amount_cents, numericality: { greater_than: 0 }

  before_validation :set_occurred_at, on: :create

  private

  def set_occurred_at
    self.occurred_at ||= Time.current
  end
end
