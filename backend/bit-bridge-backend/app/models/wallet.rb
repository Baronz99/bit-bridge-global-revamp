# frozen_string_literal: true

class Wallet < ApplicationRecord
  belongs_to :user
  has_many :transactions, class_name: 'Transaction'

  # Bridge legacy relations (NGN-only behaviour)
  has_many :bill_orders, through: :user
  has_many :order_details, through: :user

  # IMPORTANT:
  # We keep :usdt as a legacy enum value ONLY to avoid breaking existing DB rows.
  # Production tunnel wallet is USD: :usd
  enum :wallet_type, { ngn: 0, usd: 2 }

  validates :wallet_type, presence: true, uniqueness: { scope: :user_id }
  validates :currency, presence: true

  validate :currency_matches_wallet_type

  # -------------------------
  # Bridge (NGN) legacy methods
  # -------------------------
  def total_bills
    bill_orders.where(status: %w[completed timedout disputed], payment_method: 'wallet').sum(:total_amount)
  end

  def total_commission
    bill_orders.where(status: 'completed', payment_method: 'wallet').sum(:commission)
  end

  def net_commission
    bill_orders.where(status: 'completed', payment_method: 'wallet').sum(:commission)
  end

  def total_withdrawal
    transactions.where(transaction_type: 'withdrawal', status: %w[approved pending]).sum(:amount)
  end

  def total_real_withdrawal
    transactions.where(transaction_type: 'withdrawal', status: 'approved').sum(:amount)
  end

  def withdrawn
    transactions.where(transaction_type: 'withdrawal', status: 'approved').sum(:amount)
  end

  def total_deposit
  transactions
    .where(transaction_type: 'deposit', status: 'approved')
    .sum(Arel.sql("amount + COALESCE(bonus, 0)"))
end


  # -------------------------
  # ✅ Unified balance API
  # -------------------------
  # For NGN: computed using legacy logic
  # For USD: stored cents (balance_cents)
  def balance
    if ngn?
      (total_deposit + user.total_sale) - (total_withdrawal + user.user_net_expense + total_bills)
    else
      cents_to_money(balance_cents)
    end
  end

  def real_balance
    if ngn?
      (total_deposit + user.total_sale) - (total_real_withdrawal + user.user_net_expense + total_bills)
    else
      cents_to_money(balance_cents)
    end
  end

  # -------------------------
  # ✅ Stored-balance helpers (USD)
  # -------------------------
  def credit_cents!(cents)
  cents = cents.to_i
  raise ArgumentError, 'Amount must be positive' unless cents.positive?

  with_lock do
    self.balance_cents = balance_cents.to_i + cents
    save!
  end
end

  def debit_cents!(cents)
  cents = cents.to_i
  raise ArgumentError, 'Amount must be positive' unless cents.positive?

  with_lock do
    raise ArgumentError, 'Insufficient balance' if balance_cents.to_i < cents
    self.balance_cents = balance_cents.to_i - cents
    save!
  end
end

  def cents_to_money(cents)
    (cents.to_i / 100.0).round(2)
  end

  def money_to_cents(amount)
    (BigDecimal(amount.to_s) * 100).to_i
  end
end

def currency_matches_wallet_type
  expected = usd? ? 'USD' : 'NGN'
  return if currency.to_s.upcase == expected
  errors.add(:currency, "must be #{expected} for #{wallet_type}")
end