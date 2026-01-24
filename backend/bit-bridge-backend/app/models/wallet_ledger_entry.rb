# frozen_string_literal: true

class WalletLedgerEntry < ApplicationRecord
  belongs_to :wallet
  belongs_to :bill_order, optional: true

  enum :entry_type, {
    hold: 0,
    release: 1,
    debit: 2,
    refund: 3,
    commission: 4,
    credit: 5,
    adjustment: 6
  }

  validates :amount, presence: true
  validates :bill_order, presence: true, if: :bill_order_required?
  validate :validate_money_scale

  before_save :normalize_money_fields
  after_commit :warn_missing_amount_cents, on: :create

  scope :holds, -> { where(entry_type: :hold) }
  scope :releases, -> { where(entry_type: :release) }
  scope :credits, -> { where(entry_type: :credit) }
  scope :adjustments, -> { where(entry_type: :adjustment) }

  def self.active_hold_total(wallet_id)
    hold_sum = holds.where(wallet_id: wallet_id).sum(:amount)
    release_sum = releases.where(wallet_id: wallet_id).sum(:amount)
    hold_sum - release_sum
  end

  def self.ensure_hold!(wallet:, bill_order:, amount:, reference: nil, metadata: {})
    find_or_create_by!(wallet: wallet, bill_order: bill_order, entry_type: :hold) do |entry|
      entry.amount = amount
      entry.reference = reference
      entry.metadata = metadata
    end
  rescue ActiveRecord::RecordNotUnique
    find_by!(wallet: wallet, bill_order: bill_order, entry_type: :hold)
  end

  def self.release_hold!(wallet:, bill_order:, amount:, reference: nil, metadata: {})
    existing = find_by(wallet: wallet, bill_order: bill_order, entry_type: :release)
    return existing if existing.present?
    if debit_exists?(wallet: wallet, bill_order: bill_order)
      raise_invariant_violation!(wallet: wallet, bill_order: bill_order, message: 'Cannot release hold after debit has been recorded')
    end

    find_or_create_by!(wallet: wallet, bill_order: bill_order, entry_type: :release) do |entry|
      entry.amount = amount
      entry.reference = reference
      entry.metadata = metadata
    end
  rescue ActiveRecord::RecordNotUnique
    find_by!(wallet: wallet, bill_order: bill_order, entry_type: :release)
  end

  def self.record_debit!(wallet:, bill_order:, amount:, reference: nil, metadata: {})
    existing = find_by(wallet: wallet, bill_order: bill_order, entry_type: :debit)
    return existing if existing.present?

    if release_exists?(wallet: wallet, bill_order: bill_order)
      raise_invariant_violation!(wallet: wallet, bill_order: bill_order, message: 'Cannot record debit after hold was released')
    end

    amount = amount.to_d
    totals = ledger_totals(wallet: wallet, bill_order: bill_order)
    hold_total = totals[:hold]
    release_total = totals[:release]
    debit_total = totals[:debit]
    if hold_total.positive?
      outstanding = hold_total - release_total - debit_total
      if outstanding <= 0
        raise_invariant_violation!(wallet: wallet, bill_order: bill_order, message: 'Cannot record debit without an outstanding hold')
      end
      if amount > outstanding
        raise_invariant_violation!(wallet: wallet, bill_order: bill_order, message: 'Debit amount exceeds outstanding hold')
      end
    end
    if wallet.respond_to?(:ledger_raw_balance) && wallet.ledger_raw_balance < amount
      raise_invariant_violation!(wallet: wallet, bill_order: bill_order, message: 'Insufficient ledger balance for debit')
    end

    find_or_create_by!(wallet: wallet, bill_order: bill_order, entry_type: :debit) do |entry|
      entry.amount = amount
      entry.reference = reference
      entry.metadata = metadata
    end
  rescue ActiveRecord::RecordNotUnique
    find_by!(wallet: wallet, bill_order: bill_order, entry_type: :debit)
  end

  def self.record_refund!(wallet:, bill_order:, amount:, reference: nil, metadata: {})
    find_or_create_by!(wallet: wallet, bill_order: bill_order, entry_type: :refund) do |entry|
      entry.amount = amount
      entry.reference = reference
      entry.metadata = metadata
    end
  rescue ActiveRecord::RecordNotUnique
    find_by!(wallet: wallet, bill_order: bill_order, entry_type: :refund)
  end

  def self.record_credit!(wallet:, bill_order:, amount:, reference: nil, metadata: {})
    return nil if amount.to_d <= 0
    find_or_create_by!(wallet: wallet, bill_order: bill_order, entry_type: :credit, reference: reference) do |entry|
      entry.amount = amount
      entry.metadata = metadata
    end
  rescue ActiveRecord::RecordNotUnique
    find_by!(wallet: wallet, bill_order: bill_order, entry_type: :credit, reference: reference)
  end

  def self.record_adjustment!(wallet:, amount:, reference:, metadata: {})
    raise ArgumentError, 'reference is required' if reference.to_s.strip.empty?
    amount = amount.to_d
    find_or_create_by!(wallet: wallet, entry_type: :adjustment, reference: reference) do |entry|
      entry.amount = amount
      entry.metadata = metadata
    end
  rescue ActiveRecord::RecordNotUnique
    find_by!(wallet: wallet, entry_type: :adjustment, reference: reference)
  end

  def self.debit_exists?(wallet:, bill_order:)
    exists?(wallet: wallet, bill_order: bill_order, entry_type: :debit)
  end

  def self.release_exists?(wallet:, bill_order:)
    exists?(wallet: wallet, bill_order: bill_order, entry_type: :release)
  end

  def self.raise_invariant_violation!(wallet:, bill_order:, message:)
    entry = new(wallet: wallet, bill_order: bill_order)
    entry.errors.add(:base, message)
    raise ActiveRecord::RecordInvalid, entry
  end

  def self.ledger_totals(wallet:, bill_order:)
    totals = where(wallet: wallet, bill_order: bill_order).group(:entry_type).sum(:amount)
    {
      hold: BigDecimal((totals['hold'] || 0).to_s),
      release: BigDecimal((totals['release'] || 0).to_s),
      debit: BigDecimal((totals['debit'] || 0).to_s)
    }
  end

  private

  def bill_order_required?
    !%w[credit adjustment].include?(entry_type.to_s)
  end

  def normalize_money_fields
    self.amount = MoneyScale.normalize(amount)
    self.amount_cents = Money.to_cents(amount, wallet&.currency)
  end

  def validate_money_scale
    raw_value = read_attribute_before_type_cast(:amount)
    check_value = raw_value.nil? ? amount : raw_value
    return if MoneyScale.valid_scale?(check_value)

    errors.add(:amount, 'must have at most 2 decimal places')
  end

  def warn_missing_amount_cents
    return unless ENV.fetch('USE_NGN_CENTS_LEDGER', '0') == '1'
    return unless wallet&.currency.to_s.upcase == 'NGN'
    return if amount_cents.present?

    Rails.logger.warn("WalletLedgerEntry missing amount_cents id=#{id} wallet_id=#{wallet_id} entry_type=#{entry_type}")
  end
end
