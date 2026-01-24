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
  validate :validate_money_scale

  before_validation :normalize_currency
  before_save :normalize_money_fields

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
    sum_money(
      transactions.where(transaction_type: :deposit, status: :approved),
      cents_column: :amount_cents,
      decimal_column: :amount
    )
  end

  # Pending withdrawals reduce *available* funds (keep as you had)
  def ledger_withdrawals_total
    sum_money(
      transactions.where(transaction_type: :withdrawal, status: %i[pending approved]),
      cents_column: :amount_cents,
      decimal_column: :amount
    )
  end

  def ledger_holds_total
    sum_money(wallet_ledger_entries.holds, cents_column: :amount_cents, decimal_column: :amount)
  end

  def ledger_releases_total
    sum_money(wallet_ledger_entries.releases, cents_column: :amount_cents, decimal_column: :amount)
  end

  def ledger_debits_total
    sum_money(wallet_ledger_entries.where(entry_type: :debit), cents_column: :amount_cents, decimal_column: :amount)
  end

  def ledger_refunds_total
    sum_money(wallet_ledger_entries.where(entry_type: :refund), cents_column: :amount_cents, decimal_column: :amount)
  end

  def ledger_adjustments_total
    sum_money(wallet_ledger_entries.where(entry_type: :adjustment), cents_column: :amount_cents, decimal_column: :amount)
  end

  # deposits + refunds - withdrawals - debits (no hold clamp)
  def ledger_raw_balance
    ledger_deposits_total +
      ledger_refunds_total +
      ledger_adjustments_total -
      ledger_withdrawals_total -
      ledger_debits_total
  end

  def ledger_real_credit_entries_total
    sum_money(
      wallet_ledger_entries
        .credits
        .where("metadata ->> 'source' IS NULL OR metadata ->> 'source' != ?", 'ledger_repair'),
      cents_column: :amount_cents,
      decimal_column: :amount
    )
  end

  # ✅ Active holds are purely reservation, never include debits
  def ledger_active_hold
    ledger_outstanding_hold
  end

  def ledger_outstanding_hold
    totals = ledger_bill_hold_totals
    outstanding = totals.values.sum do |value|
      delta = value[:hold] - value[:release] - value[:debit]
      delta.positive? ? delta : BigDecimal('0')
    end

    outstanding.to_d
  end

  # ✅ Correct available balance
  # deposits + refunds - withdrawals - debits - active_hold
  def ledger_available_balance
    available =
      ledger_deposits_total +
      ledger_refunds_total +
      ledger_adjustments_total -
      ledger_withdrawals_total -
      ledger_debits_total -
      ledger_outstanding_hold
    available.negative? ? BigDecimal('0') : available
  end

  def ledger_bill_entry_sums
    if ngn_cents_ledger_enabled?
      wallet_ledger_entries
        .where.not(bill_order_id: nil)
        .group(:bill_order_id, :entry_type)
        .sum(Arel.sql("COALESCE(amount_cents, (ROUND(amount, 2) * 100)::bigint)"))
        .transform_values { |cents| Money.from_cents(cents, currency).to_d }
    else
      wallet_ledger_entries
        .where.not(bill_order_id: nil)
        .group(:bill_order_id, :entry_type)
        .sum(:amount)
    end
  end

  def ledger_bill_hold_totals
    ledger_bill_entry_sums.each_with_object(Hash.new { |memo, key| memo[key] = { hold: BigDecimal('0'), release: BigDecimal('0'), debit: BigDecimal('0') } }) do |((bill_order_id, entry_type), amount), memo|
      type =
        if entry_type.is_a?(String)
          entry_type.to_sym
        else
          WalletLedgerEntry.entry_types.key(entry_type)&.to_sym
        end
      next unless %i[hold release debit].include?(type)
      memo[bill_order_id][type] = amount.to_d
    end
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

  def normalize_currency
    return unless currency.present?

    self.currency = currency.to_s.strip.upcase
  end

  def normalize_money_fields
    self.commission = MoneyScale.normalize(commission)
    self.commission_cents = Money.to_cents(commission, currency)
  end

  def validate_money_scale
    raw_value = read_attribute_before_type_cast(:commission)
    check_value = raw_value.nil? ? commission : raw_value
    return if MoneyScale.valid_scale?(check_value)

    errors.add(:commission, 'must have at most 2 decimal places')
  end

  def ngn_cents_ledger_enabled?
    ngn? && ENV.fetch('USE_NGN_CENTS_LEDGER', '0') == '1'
  end

  def sum_money(scope, cents_column:, decimal_column:)
    return scope.sum(decimal_column).to_d unless ngn_cents_ledger_enabled?

    cents = scope.sum(
      Arel.sql("COALESCE(#{cents_column}, (ROUND(#{decimal_column}, 2) * 100)::bigint)")
    )
    Money.from_cents(cents, currency).to_d
  end
end
