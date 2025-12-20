# frozen_string_literal: true

class Circle < ApplicationRecord
  belongs_to :owner, class_name: 'User'

  has_many :circle_memberships, dependent: :destroy
  has_many :members, through: :circle_memberships, source: :user

  has_many :circle_activities, dependent: :destroy
  has_many :circle_transactions, dependent: :destroy

  monetize :balance_cents, with_model_currency: :currency, allow_nil: true if defined?(MoneyRails)

  # Mini-wallet helper: apply a credit or debit and keep balance in sync
  #
  # NEW: circle_activity can be passed to tag tx for progress reporting.
  def apply_transaction!(
    amount_cents:,
    direction:,
    user:,
    kind: 'manual',
    description: nil,
    reference: nil,
    metadata: {},
    circle_activity: nil
  )
    raise ArgumentError, 'amount_cents must be > 0' unless amount_cents.to_i > 0

    Circle.transaction do
      with_lock do
        self.balance_cents = balance_cents.to_i

        tx = circle_transactions.create!(
          user: user,
          amount_cents: amount_cents,
          direction: direction,
          kind: kind,
          description: description,
          reference: reference,
          metadata: metadata,
          circle_activity: circle_activity
        )

        if tx.direction_credit?
          update!(balance_cents: balance_cents + amount_cents)
        else
          new_balance = balance_cents - amount_cents
          raise ActiveRecord::Rollback, 'Insufficient circle balance' if new_balance.negative?
          update!(balance_cents: new_balance)
        end

        tx
      end
    end
  end
end
