# frozen_string_literal: true

class TransactionSerializer < ActiveModel::Serializer
  attributes :id,
             :reference,
             :status,
             :amount,
             :currency,
             :created_at,
             :address,
             :bonus,
             :transaction_type,
             :coin_type,
             :proof_url,
             :email,
             :bank,
             :wallet_id,
             :bridge_card_id,
             :wallet_type,
             :transfer_reference,
             :transfer_component,
             :lifecycle_state,
             :show_in_primary_feed,
             :balance_snapshot,
             :display_amount,
             :display_total,
             :display_breakdown,
             :display_message

  def wallet_type
    object.wallet&.wallet_type
  end

  def reference
    record = object.transaction_record
    record&.reference || object.transfer_id
  end

  def currency
    value =
      if object.respond_to?(:has_attribute?) && object.has_attribute?(:currency)
        object[:currency]
      end

    value = value.presence || object.wallet&.currency
    return value if value.present?

    return 'USD' if object.wallet&.usd?
    return 'NGN' if object.wallet&.ngn?

    nil
  end

  def transfer_reference
    transfer_meta['transfer_reference']
  end

  def transfer_component
    transfer_meta['subtype']
  end

  def lifecycle_state
    return object.status.to_s unless anchor_transfer_component?

    status_value = object.status.to_s
    return 'completed' if status_value == 'approved'

    if status_value == 'pending'
      return debit_entry_exists? ? 'pending_provider' : 'reserved'
    end

    return status_value unless %w[failed declined].include?(status_value)
    return 'failed_refunded' if refund_entry_exists? || release_entry_exists?
    return 'failed_reversal_pending' if debit_entry_exists?

    'failed_unrecovered'
  end

  def show_in_primary_feed
    return true unless anchor_transfer_component?

    transfer_component != 'fee'
  end

  def display_amount
    return object.amount unless anchor_transfer_component?

    return object.amount if transfer_component == 'reversal'
    return nil if transfer_component == 'fee'

    object.amount
  end

  def display_total
    return nil unless anchor_transfer_component?
    return nil unless transfer_component == 'principal'

    (object.amount.to_d + sibling_fee_amount.to_d).to_f
  rescue StandardError
    nil
  end

  def display_breakdown
    return nil unless anchor_transfer_component?
    return nil unless transfer_component == 'principal'

    {
      principal: object.amount.to_f,
      fee: sibling_fee_amount.to_f,
      total: display_total
    }
  end

  def display_message
    return nil unless anchor_transfer_component?

    case lifecycle_state
    when 'reserved'
      'Transfer initiated. Funds reserved.'
    when 'pending_provider'
      'Transfer submitted. Awaiting provider confirmation.'
    when 'completed'
      'Transfer completed.'
    when 'failed_refunded'
      'Transfer failed. Funds returned.'
    when 'failed_reversal_pending'
      'Transfer failed. Reversal in progress.'
    when 'failed_unrecovered'
      'Transfer failed. Reversal pending.'
    when 'released'
      'Transfer failed. Funds released.'
    when 'failed'
      'Transfer failed.'
    end
  end

  def balance_snapshot
    if anchor_transfer_component? && ledger_snapshot_columns_available?
      entry = relevant_ledger_entry
      if entry
        return {
          entry_type: entry.entry_type,
          before_event_balance: {
            available: entry.before_available_balance&.to_f
          }.compact,
          after_event_balance: {
            available: entry.after_available_balance&.to_f
          }.compact
        }
      end
    end

    return nil unless transaction_snapshot_columns_available?

    {
      entry_type: 'transaction',
      before_event_balance: {
        available: object.before_available_balance&.to_f
      }.compact,
      after_event_balance: {
        available: object.after_available_balance&.to_f
      }.compact
    }
  end

  private

  def transfer_meta
    @transfer_meta ||= object.metadata.is_a?(Hash) ? object.metadata : {}
  end

  def anchor_transfer_component?
    transfer_meta['provider'] == 'anchor' && transfer_meta['transfer_reference'].present?
  end

  def sibling_fee_amount
    return 0.to_d if transfer_reference.blank?

    @sibling_fee_amount ||=
      Transaction
        .where(wallet_id: object.wallet_id)
        .where("metadata ->> 'transfer_reference' = ?", transfer_reference)
        .where("metadata ->> 'subtype' = ?", 'fee')
        .order(created_at: :desc)
        .limit(1)
        .pick(:amount).to_d
  end

  def relevant_ledger_entry
    type = ledger_entry_type_for_snapshot
    return nil if type.blank? || transfer_reference.blank?

    WalletLedgerEntry
      .where(wallet_id: object.wallet_id, entry_type: type)
      .where("metadata ->> 'transfer_reference' = ?", transfer_reference)
      .order(created_at: :desc)
      .first
  end

  def ledger_entry_type_for_snapshot
    return 'release' if transfer_component == 'reversal'
    return nil unless transfer_component == 'principal'

    case lifecycle_state
    when 'reserved'
      'hold'
    when 'pending_provider'
      'debit'
    when 'completed'
      'debit'
    when 'failed_refunded'
      refund_entry_exists? ? 'refund' : 'release'
    when 'failed_reversal_pending'
      'debit'
    when 'released', 'failed', 'failed_unrecovered'
      'release'
    else
      nil
    end
  end

  def debit_entry_exists?
    ledger_entry_exists?('debit')
  end

  def release_entry_exists?
    ledger_entry_exists?('release')
  end

  def refund_entry_exists?
    ledger_entry_exists?('refund')
  end

  def ledger_entry_exists?(entry_type)
    transfer_reference.present? &&
      WalletLedgerEntry
        .where(wallet_id: object.wallet_id, entry_type: entry_type)
        .where("metadata ->> 'transfer_reference' = ?", transfer_reference)
        .exists?
  end

  def ledger_snapshot_columns_available?
    WalletLedgerEntry.column_names.include?('before_available_balance') &&
      WalletLedgerEntry.column_names.include?('after_available_balance')
  end

  def transaction_snapshot_columns_available?
    object.respond_to?(:before_available_balance) &&
      object.respond_to?(:after_available_balance)
  end

  has_one :wallet
end
