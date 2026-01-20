# frozen_string_literal: true

class WalletLedgerEntry < ApplicationRecord
  belongs_to :wallet
  belongs_to :bill_order

  enum :entry_type, {
    hold: 0,
    release: 1,
    debit: 2,
    refund: 3,
    commission: 4
  }

  validates :amount, presence: true

  scope :holds, -> { where(entry_type: :hold) }
  scope :releases, -> { where(entry_type: :release) }

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
    find_or_create_by!(wallet: wallet, bill_order: bill_order, entry_type: :release) do |entry|
      entry.amount = amount
      entry.reference = reference
      entry.metadata = metadata
    end
  rescue ActiveRecord::RecordNotUnique
    find_by!(wallet: wallet, bill_order: bill_order, entry_type: :release)
  end

  def self.record_debit!(wallet:, bill_order:, amount:, reference: nil, metadata: {})
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
end
