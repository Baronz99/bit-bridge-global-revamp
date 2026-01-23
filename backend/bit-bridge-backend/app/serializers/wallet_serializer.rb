# frozen_string_literal: true

class WalletSerializer < ActiveModel::Serializer
  attributes :id,
             :wallet_type,
             :currency,
             :balance,
             :balance_cents,
             :available_balance,
             :book_balance,
             :commission,
             :total_bills,
             :withdrawn,
             :total_deposit,
             :active_hold_total,
             :outstanding_hold,
             :wallet_balance,
             :reward_balance,
             :can_use_rewards

  has_one :user
  has_many :transactions

  # -------------------------
  # Backward compatible fields
  # -------------------------

  # balance is what your UI already reads.
  # We'll keep it, but make the meaning explicit via added fields below.
  def balance
    object.balance
  end

  # USD canonical cents; NGN nil (or 0 if you prefer)
  def balance_cents
    return object.balance_cents.to_i if object.usd?
    nil
  end

  # Spendable amount (ledger-aware for NGN, stored for USD)
  def available_balance
    if object.ngn?
      object.ledger_available_balance.to_f
    else
      object.cents_to_money(object.balance_cents).to_f
    end
  end

  # “Book” balance for NGN (legacy computed), equals `balance` today — but this keeps future-proofing.
  def book_balance
    object.balance.to_f
  end

  # Debug/visibility — helps you spot stuck holds instantly
  def active_hold_total
    return object.active_hold_total.to_f if object.respond_to?(:active_hold_total)
    0.0
  end

  def outstanding_hold
    object.ledger_outstanding_hold.to_f
  end

  def wallet_balance
    object.ledger_available_balance.to_f
  end

  def reward_balance
    RewardTransaction.available_sum_for(object.user_id).to_f
  end

  def can_use_rewards
    false
  end
end
