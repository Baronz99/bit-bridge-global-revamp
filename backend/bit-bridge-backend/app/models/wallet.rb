# frozen_string_literal: true

class Wallet < ApplicationRecord
  belongs_to :user
  has_many :transactions, class_name: 'Transaction'
  has_many :wallet_ledger_entries, dependent: :destroy

  # Bridge legacy relations (NGN-only behaviour)
  has_many :bill_orders, through: :user
  has_many :order_details, through: :user

  enum :wallet_type, { ngn: 0, usd: 2 }

  validates :wallet_type, presence: true, uniqueness: { scope: :user_id }
  validates :currency, presence: true
  validate :currency_matches_wallet_type

  scope :for_api, -> { includes(:user, transactions: { proof_attachment: :blob }) }

  # -------------------------
  # Bridge (NGN) legacy methods
  # -------------------------
  def total_bills
    bill_orders.where(status: %w[completed timedout disputed], payment_method: 'wallet').sum(:total_amount)
  end

  def active_hold_total
    WalletLedgerEntry.active_hold_total(id)
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
  # ✅ Ledger-based NGN balance (stable truth)
  # -------------------------
  def ledger_deposits_total
    transactions
      .where(transaction_type: :deposit, status: :approved)
      .sum(Arel.sql('amount + COALESCE(bonus, 0)'))
      .to_d
  end

  # Pending withdrawals reduce *available* funds (keep as you had)
  def ledger_withdrawals_total
    transactions
      .where(transaction_type: :withdrawal, status: %i[pending approved])
      .sum(:amount)
      .to_d
  end

  def ledger_holds_total
    wallet_ledger_entries.holds.sum(:amount).to_d
  end

  def ledger_releases_total
    wallet_ledger_entries.releases.sum(:amount).to_d
  end

  def ledger_debits_total
    wallet_ledger_entries.where(entry_type: :debit).sum(:amount).to_d
  end

  def ledger_refunds_total
    wallet_ledger_entries.where(entry_type: :refund).sum(:amount).to_d
  end

  # ✅ Active holds are purely reservation, never include debits
  def ledger_active_hold
    active = ledger_holds_total - ledger_releases_total
    active.positive? ? active : BigDecimal('0')
  end

  def ledger_outstanding_hold
    outstanding = ledger_holds_total - ledger_releases_total - ledger_debits_total
    outstanding.positive? ? outstanding : BigDecimal('0')
  end

  # ✅ Correct available balance
  # deposits - withdrawals - debits + refunds - active_hold
  def ledger_available_balance
    available =
      ledger_deposits_total -
      ledger_withdrawals_total -
      ledger_debits_total +
      ledger_refunds_total -
      ledger_active_hold

    available.negative? ? BigDecimal('0') : available
  end

  # -------------------------
  # ✅ Unified balance API
  # -------------------------
  # NGN: ledger-derived stable balance
  # USD: stored cents
  def balance
    if ngn?
      ledger_available_balance
    else
      cents_to_money(balance_cents)
    end
  end

  # If you still want an "accounting view" that ignores holds/pending withdrawals:
  def real_balance
    if ngn?
      ledger_available_balance
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

  private

  def currency_matches_wallet_type
    expected = usd? ? 'USD' : 'NGN'
    return if currency.to_s.upcase == expected
    errors.add(:currency, "must be #{expected} for #{wallet_type}")
  end
end
