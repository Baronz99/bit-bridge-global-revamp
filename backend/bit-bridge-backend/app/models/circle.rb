# app/models/circle.rb
class Circle < ApplicationRecord
  belongs_to :owner, class_name: 'User'

  has_many :circle_memberships, dependent: :destroy
  has_many :members, through: :circle_memberships, source: :user

  has_many :circle_transactions, dependent: :destroy

  # Optional: if MoneyRails is present, this will give you `balance` as a Money object
  monetize :balance_cents, with_model_currency: :currency, allow_nil: true if defined?(MoneyRails)

  # Mini-wallet helper: apply a credit or debit and keep balance in sync
  #
  # Usage (example):
  #   circle.apply_transaction!(
  #     amount_cents: 50000,
  #     direction: 'credit',
  #     user: current_user,
  #     kind: 'manual_top_up',
  #     description: 'Initial funding'
  #   )
  #
  def apply_transaction!(amount_cents:, direction:, user:, kind: 'manual', description: nil, reference: nil, metadata: {})
    Circle.transaction do
      tx = circle_transactions.create!(
        user: user,
        amount_cents: amount_cents,
        direction: direction,   # "credit" or "debit"
        kind: kind,
        description: description,
        reference: reference,
        metadata: metadata
      )

      if tx.credit?
        increment!(:balance_cents, amount_cents)
      else
        decrement!(:balance_cents, amount_cents)
      end

      tx
    end
  end
end
