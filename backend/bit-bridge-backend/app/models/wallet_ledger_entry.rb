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
    credit: 5
  }

  validates :amount, presence: true
  validates :bill_order, presence: true, if: :bill_order_required?

  scope :holds, -> { where(entry_type: :hold) }
  scope :releases, -> { where(entry_type: :release) }
  scope :credits, -> { where(entry_type: :credit) }

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

  private

  def bill_order_required?
    entry_type.to_s != 'credit'
  end
end
