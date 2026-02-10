# frozen_string_literal: true

module Transfers
  class AnchorNgnTransferService
    MIN_AMOUNT = Pricing::Engine::MIN_TRANSFER_AMOUNT_NGN

    def self.call(user:, sender_wallet:, amount_ngn:, bank_payload:, narration:, transfer_reference: nil)
      new(
        user: user,
        sender_wallet: sender_wallet,
        amount_ngn: amount_ngn,
        bank_payload: bank_payload,
        narration: narration,
        transfer_reference: transfer_reference
      ).call
    end

    def initialize(user:, sender_wallet:, amount_ngn:, bank_payload:, narration:, transfer_reference: nil)
      @user = user
      @sender_wallet = sender_wallet
      @amount_ngn = parse_amount(amount_ngn)
      @bank_payload = bank_payload
      @narration = narration
      @transfer_reference = transfer_reference
    end

    def call
      return invalid_amount_error if @amount_ngn.nil? || @amount_ngn <= 0
      return min_amount_error if @amount_ngn < MIN_AMOUNT

      transfer_reference = @transfer_reference.presence || SecureRandom.uuid
      fee_breakdown = Pricing::Engine.transfer_fee_breakdown_ngn(@amount_ngn)
      total_fee = fee_breakdown.fetch(:total_fee)
      total_debit = @amount_ngn + total_fee
      transfer_order = ensure_transfer_bill_order(transfer_reference, total_debit)

      existing_principal = find_transfer_tx(transfer_reference, 'principal')
      existing_fee = find_transfer_tx(transfer_reference, 'fee')
      return existing_transfer_response(transfer_reference) if existing_principal.present? || existing_fee.present?

      return existing_transfer_response(transfer_reference) if transfer_hold_exists?(transfer_order)

      available_balance = @sender_wallet.ledger_available_balance
      if available_balance < total_debit
        return insufficient_funds_error(total_fee, total_debit, available_balance, fee_breakdown)
      end

      hold_entry = nil
      begin
        hold_entry = WalletLedgerEntry.ensure_hold!(
          wallet: @sender_wallet,
          bill_order: transfer_order,
          amount: total_debit,
          reference: "anchor-transfer-hold/#{transfer_reference}",
          metadata: { transfer_reference: transfer_reference }
        )
      rescue ActiveRecord::RecordInvalid
        available_balance = @sender_wallet.ledger_available_balance
        return insufficient_funds_error(total_fee, total_debit, available_balance, fee_breakdown)
      end

      principal_tx = nil
      fee_tx = nil

      ActiveRecord::Base.transaction do
        principal_tx = create_pending_principal!(transfer_reference)
        fee_tx = create_pending_fee!(transfer_reference, fee_breakdown)
        create_transaction_record!(principal_tx, transfer_reference)
      end

      anchor_response = AnchorService.new.initiate_transfer(anchor_request_payload(transfer_reference))

      if anchor_response[:status] == :ok
        finalize_success!(
          principal_tx,
          fee_tx,
          anchor_response,
          transfer_reference,
          transfer_order,
          total_debit,
          hold_entry: hold_entry
        )
      else
        release_entry = release_hold!(transfer_reference, total_debit, transfer_order)
        finalize_failure!(
          principal_tx,
          fee_tx,
          anchor_response[:message],
          transfer_reference,
          hold_entry: hold_entry,
          release_entry: release_entry
        )
      end
    rescue ActiveRecord::RecordInvalid => e
      release_hold!(transfer_reference, total_debit, transfer_order)
      { status: :unprocessable_entity, body: { message: e.record.errors.full_messages.to_sentence } }
    end

    def self.reverse_transfer!(principal_tx, reason: nil, provider_status: nil)
      return if principal_tx.blank?

      wallet = principal_tx.wallet
      return if wallet.blank?

      metadata = principal_tx.metadata.is_a?(Hash) ? principal_tx.metadata : {}
      transfer_reference =
        metadata['transfer_reference'] ||
        principal_tx.transaction_record&.reference
      return if transfer_reference.blank?

      fee_tx = wallet.transactions
                      .where("metadata ->> 'transfer_reference' = ?", transfer_reference)
                      .where("metadata ->> 'subtype' = ?", 'fee')
                      .order(created_at: :desc)
                      .first

      update_failed!(principal_tx, reason: reason, provider_status: provider_status)
      update_failed!(fee_tx, reason: reason, provider_status: provider_status) if fee_tx

      return if reversal_exists_for?(wallet, transfer_reference)

      ActiveRecord::Base.transaction do
        create_reversal_tx!(wallet, transfer_reference, principal_tx, 'principal')
        create_reversal_tx!(wallet, transfer_reference, fee_tx, 'fee') if fee_tx
      end
    end

    def self.mark_success!(principal_tx, provider_status:, provider_transfer_id: nil)
      return if principal_tx.blank?

      transfer_reference =
        principal_tx.metadata.is_a?(Hash) ? principal_tx.metadata['transfer_reference'] : nil

      ActiveRecord::Base.transaction do
        principal_meta = principal_tx.metadata.is_a?(Hash) ? principal_tx.metadata.dup : {}
        principal_meta['provider_status'] = provider_status if provider_status.present?
        principal_meta['provider_transfer_id'] = provider_transfer_id if provider_transfer_id.present?
        principal_tx.update!(
          status: 'approved',
          transfer_id: provider_transfer_id.presence || principal_tx.transfer_id,
          metadata: principal_meta
        )

        fee_tx =
          if transfer_reference.present?
            Transaction
              .where(wallet_id: principal_tx.wallet_id)
              .where("metadata ->> 'transfer_reference' = ?", transfer_reference)
              .where("metadata ->> 'subtype' = ?", 'fee')
              .order(created_at: :desc)
              .first
          end

        if fee_tx
          fee_meta = fee_tx.metadata.is_a?(Hash) ? fee_tx.metadata.dup : {}
          fee_meta['provider_status'] = provider_status if provider_status.present?
          fee_meta['provider_transfer_id'] = provider_transfer_id if provider_transfer_id.present?
          fee_tx.update!(status: 'approved', metadata: fee_meta)
        end

        record =
          principal_tx.transaction_record ||
          (transfer_reference.present? ? TransactionRecord.find_by(reference: transfer_reference) : nil)

        if record
          updates = { status: 'approved' }
          updates[:transaction_id] = provider_transfer_id if provider_transfer_id.present? && record.transaction_id.blank?
          record.update!(updates)

          bill_order =
            record.bill_order ||
            (
              transfer_reference.present? ?
                BillOrder.find_by(user_id: principal_tx.wallet.user_id, meter_number: transfer_reference) :
                nil
            )
          if bill_order.present? && !BillOrder::TERMINAL_STATUSES.include?(bill_order.status.to_s)
            bill_order.update!(status: 'completed')
          end
        end
      end
    end

    private

    def min_amount_error
      {
        status: :unprocessable_entity,
        body: { message: 'Minimum transfer amount is 150.', min_amount: MIN_AMOUNT }
      }
    end

    def invalid_amount_error
      {
        status: :unprocessable_entity,
        body: { message: 'Invalid transfer amount.' }
      }
    end

    def insufficient_funds_error(total_fee, total_debit, available_balance, fee_breakdown)
      formatted_amount = format_ngn_amount(@amount_ngn)
      formatted_fee = format_ngn_fee(total_fee)
      formatted_total = format_ngn_total(total_debit)

      {
        status: :unprocessable_entity,
        body: {
          message: "Insufficient balance. You need #{formatted_total} (#{formatted_amount} + #{formatted_fee} fee) to complete this transfer.",
          required_total: format_ngn(total_debit, decimals: 2).to_f,
          available_balance: available_balance.to_f,
          amount: format_ngn(@amount_ngn, decimals: 0).to_i,
          fee: format_ngn(total_fee, decimals: 2).to_f,
          fee_breakdown: serialize_fee_breakdown(fee_breakdown).stringify_keys
        }
      }
    end

    def existing_transfer_response(transfer_reference)
      principal_tx = find_transfer_tx(transfer_reference, 'principal')
      return nil unless principal_tx

      fee_tx = find_transfer_tx(transfer_reference, 'fee')
      fee_breakdown = fee_tx&.metadata&.dig('fee_breakdown') || {}
      total_fee = fee_tx&.amount.to_d || 0.to_d
      total_debit = principal_tx.amount.to_d + total_fee

      status =
        if principal_tx.status == 'approved'
          'approved'
        elsif principal_tx.status == 'failed'
          'failed'
        else
          'pending'
        end

      {
        status: :ok,
        body: {
          message: 'Transfer already processed',
          transfer_reference: transfer_reference,
          amount: principal_tx.amount.to_i,
          fee: format_ngn(total_fee, decimals: 2).to_f,
          total_debit: format_ngn(total_debit, decimals: 2).to_f,
          fee_breakdown: fee_breakdown,
          status: status,
          provider: 'anchor',
          balance_snapshot: {
            reserve: ledger_snapshot_hash(find_ledger_entry(transfer_reference, :hold)),
            settle: ledger_snapshot_hash(find_ledger_entry(transfer_reference, :debit)),
            release: ledger_snapshot_hash(find_ledger_entry(transfer_reference, :release))
          }
        }
      }
    end

    def create_pending_principal!(transfer_reference)
      @sender_wallet.transactions.create!(
        transaction_type: 'withdrawal',
        status: 'pending',
        amount: @amount_ngn,
        coin_type: 'bank',
        address: @narration,
        unique_transaction_id: "#{transfer_reference}:principal",
        metadata: {
          subtype: 'principal',
          provider: 'anchor',
          transfer_reference: transfer_reference,
          ledger_hold_reserved: true
        }
      )
    end

    def create_pending_fee!(transfer_reference, fee_breakdown)
      @sender_wallet.transactions.create!(
        transaction_type: 'withdrawal',
        status: 'pending',
        amount: fee_breakdown.fetch(:total_fee),
        coin_type: 'bank',
        address: "Anchor transfer fee (#{transfer_reference})",
        unique_transaction_id: "#{transfer_reference}:fee",
        metadata: {
          subtype: 'fee',
          provider: 'anchor',
          transfer_reference: transfer_reference,
          fee_breakdown: serialize_fee_breakdown(fee_breakdown),
          ledger_hold_reserved: true
        }
      )
    end

    def create_transaction_record!(transaction, transfer_reference)
      transaction.create_transaction_record!(
        status: 'pending',
        description: @bank_payload[:description].presence || @narration,
        customer_name: @bank_payload[:account_name],
        reference: transfer_reference,
        account_number: @bank_payload[:account_number],
        bank_code: @bank_payload[:bank_code],
        bank: @bank_payload[:bank],
        amount: @amount_ngn,
        event_type: 'anchor.transfer.create'
      )
    end

    def anchor_request_payload(transfer_reference)
      @bank_payload.merge(
        amount: @amount_ngn.to_f,
        description: @bank_payload[:description].presence || @narration,
        reference: transfer_reference
      )
    end

    def finalize_success!(principal_tx, fee_tx, anchor_response, transfer_reference, transfer_order, total_debit, hold_entry: nil)
      provider_reference = anchor_response.dig(:data, :transfer_id)
      provider_status = anchor_response.dig(:data, :status).to_s.downcase
      status = provider_status == 'pending' ? 'pending' : 'approved'

      principal_tx.update!(
        status: status,
        transfer_id: provider_reference,
        metadata: principal_tx.metadata.merge(
          provider_transfer_id: provider_reference,
          provider_status: provider_status
        )
      )

      fee_tx.update!(
        status: status,
        metadata: fee_tx.metadata.merge(
          provider_transfer_id: provider_reference,
          provider_status: provider_status
        )
      )

      total_fee = fee_tx.amount.to_d
      total_debit = total_debit.to_d

      debit_entry = nil
      if transfer_order.present?
        debit_entry = WalletLedgerEntry.record_debit!(
          wallet: @sender_wallet,
          bill_order: transfer_order,
          amount: total_debit,
          reference: "anchor-transfer-debit/#{transfer_reference}",
          metadata: { 'source' => 'anchor_transfer', 'transfer_reference' => transfer_reference }
        )
      end

      {
        status: :ok,
        body: {
          message: 'Fund has been sent',
          transfer_reference: transfer_reference,
          amount: principal_tx.amount.to_i,
          fee: format_ngn(total_fee, decimals: 2).to_f,
          total_debit: format_ngn(total_debit, decimals: 2).to_f,
          fee_breakdown: fee_tx.metadata.fetch('fee_breakdown', {}),
          status: status,
          provider: 'anchor',
          balance_snapshot: {
            reserve: ledger_snapshot_hash(hold_entry || find_ledger_entry(transfer_reference, :hold)),
            settle: ledger_snapshot_hash(debit_entry || find_ledger_entry(transfer_reference, :debit))
          }
        }
      }
    end

    def finalize_failure!(principal_tx, fee_tx, error_message, transfer_reference, hold_entry: nil, release_entry: nil)
      principal_tx.update!(
        status: 'failed',
        metadata: principal_tx.metadata.merge(provider_status: 'failed', provider_error: error_message)
      )

      fee_tx.update!(
        status: 'failed',
        metadata: fee_tx.metadata.merge(provider_status: 'failed', provider_error: error_message)
      )

      create_reversal_if_needed!(transfer_reference, principal_tx, fee_tx)

      {
        status: :bad_gateway,
        body: {
          message: error_message.presence || 'Transfer failed',
          transfer_reference: transfer_reference,
          status: 'failed',
          provider: 'anchor',
          balance_snapshot: {
            reserve: ledger_snapshot_hash(hold_entry || find_ledger_entry(transfer_reference, :hold)),
            release: ledger_snapshot_hash(release_entry || find_ledger_entry(transfer_reference, :release))
          }
        }
      }
    end

    def create_reversal_if_needed!(transfer_reference, principal_tx, fee_tx)
      return if reversal_exists?(transfer_reference)

      ActiveRecord::Base.transaction do
        create_reversal_tx!(transfer_reference, principal_tx, 'principal')
        create_reversal_tx!(transfer_reference, fee_tx, 'fee')
      end
    end

    def create_reversal_tx!(transfer_reference, original_tx, reversal_for)
      @sender_wallet.transactions.create!(
        transaction_type: 'deposit',
        status: 'approved',
        amount: original_tx.amount,
        coin_type: 'bank',
        address: "Anchor transfer reversal (#{transfer_reference})",
        unique_transaction_id: "#{transfer_reference}:reversal:#{reversal_for}",
        metadata: {
          subtype: 'reversal',
          reversal_for: reversal_for,
          provider: 'anchor',
          transfer_reference: transfer_reference,
          reversed_transaction_id: original_tx.id
        }
      )
    end

    def reversal_exists?(transfer_reference)
      @sender_wallet.transactions
                    .where("metadata ->> 'transfer_reference' = ?", transfer_reference)
                    .where("metadata ->> 'subtype' = ?", 'reversal')
                    .exists?
    end

    def transfer_hold_exists?(bill_order)
      return false if bill_order.blank?

      WalletLedgerEntry.holds
                        .where(wallet_id: @sender_wallet.id, bill_order_id: bill_order.id)
                        .exists?
    end

    def ensure_transfer_bill_order(transfer_reference, total_debit)
      BillOrder.find_or_create_by!(user: @user, meter_number: transfer_reference) do |order|
        order.meter_type = 'PREPAID'
        order.address = 'Anchor transfer hold'
        order.name = 'Anchor transfer'
        order.tariff_class = 'A'
        order.service_type = 'OTHER'
        order.email = @user.email
        order.amount = total_debit
        order.phone = '0000000000'
        order.biller = 'Anchor'
        order.description = 'Anchor NGN transfer hold'
        order.payment_type = 'online'
        order.payment_method = 'wallet'
        order.status = 'processing'
      end.tap do |order|
        order.update!(amount: total_debit) if order.amount != total_debit
        metadata = (order.metadata.is_a?(Hash) ? order.metadata.dup : {})
        metadata['source'] = 'anchor_transfer'
        metadata['transfer_reference'] = transfer_reference
        order.update!(metadata: metadata) if metadata != order.metadata
      end
    end

    def release_hold!(transfer_reference, amount, bill_order = nil)
      order = bill_order.presence || BillOrder.find_by(user: @user, meter_number: transfer_reference)
      return if order.blank? || !transfer_hold_exists?(order)
      return if WalletLedgerEntry.debit_exists?(wallet: @sender_wallet, bill_order: order)
      if WalletLedgerEntry.release_exists?(wallet: @sender_wallet, bill_order: order)
        return WalletLedgerEntry.find_by(wallet: @sender_wallet, bill_order: order, entry_type: :release)
      end

      WalletLedgerEntry.release_hold!(
        wallet: @sender_wallet,
        bill_order: order,
        amount: amount,
        reference: "anchor-transfer-release/#{transfer_reference}",
        metadata: { transfer_reference: transfer_reference }
      )
    end

    def find_transfer_tx(transfer_reference, subtype)
      @sender_wallet.transactions
                    .where("metadata ->> 'transfer_reference' = ?", transfer_reference)
                    .where("metadata ->> 'subtype' = ?", subtype)
                    .order(created_at: :desc)
                    .first
    end

    def find_ledger_entry(transfer_reference, entry_type)
      return nil if transfer_reference.blank?

      @sender_wallet.wallet_ledger_entries
                    .where(entry_type: entry_type)
                    .where("metadata ->> 'transfer_reference' = ?", transfer_reference)
                    .order(created_at: :desc)
                    .first
    end

    def ledger_snapshot_hash(entry)
      return nil if entry.blank?
      return nil unless entry.respond_to?(:before_book_balance) && entry.respond_to?(:after_book_balance)

      {
        entry_type: entry.entry_type,
        before_event_balance: {
          book: entry.before_book_balance&.to_f,
          available: entry.before_available_balance&.to_f
        }.compact,
        after_event_balance: {
          book: entry.after_book_balance&.to_f,
          available: entry.after_available_balance&.to_f
        }.compact
      }
    end

    def self.update_failed!(transaction, reason:, provider_status:)
      return if transaction.blank?

      meta = transaction.metadata.is_a?(Hash) ? transaction.metadata.dup : {}
      meta['provider_status'] = provider_status if provider_status.present?
      meta['provider_error'] = reason if reason.present?
      transaction.update!(status: 'failed', metadata: meta)
    end

    def self.reversal_exists_for?(wallet, transfer_reference)
      wallet.transactions
            .where("metadata ->> 'transfer_reference' = ?", transfer_reference)
            .where("metadata ->> 'subtype' = ?", 'reversal')
            .exists?
    end

    def self.create_reversal_tx!(wallet, transfer_reference, original_tx, reversal_for)
      return if original_tx.blank?

      wallet.transactions.create!(
        transaction_type: 'deposit',
        status: 'approved',
        amount: original_tx.amount,
        coin_type: 'bank',
        address: "Anchor transfer reversal (#{transfer_reference})",
        unique_transaction_id: "#{transfer_reference}:reversal:#{reversal_for}",
        metadata: {
          subtype: 'reversal',
          reversal_for: reversal_for,
          provider: 'anchor',
          transfer_reference: transfer_reference,
          reversed_transaction_id: original_tx.id
        }
      )
    end

    def serialize_fee_breakdown(fee_breakdown)
      {
        platform_fee: format_ngn(fee_breakdown.fetch(:platform_fee), decimals: 2).to_f,
        stamp_duty_fee: format_ngn(fee_breakdown.fetch(:stamp_duty_fee), decimals: 2).to_f,
        total_fee: format_ngn(fee_breakdown.fetch(:total_fee), decimals: 2).to_f
      }
    end

    def format_ngn(amount, decimals:)
      BigDecimal(amount.to_s).round(decimals)
    end

    def format_ngn_amount(amount)
      value = format_ngn(amount, decimals: 0).to_i
      format_with_delimiter(value.to_s)
    end

    def format_ngn_fee(amount)
      value = format('%.2f', format_ngn(amount, decimals: 2))
      format_with_delimiter(value)
    end

    def format_ngn_total(amount)
      value = format('%.2f', format_ngn(amount, decimals: 2))
      format_with_delimiter(value)
    end

    def format_with_delimiter(value)
      whole, decimal = value.split('.', 2)
      delimited = whole.to_s.reverse.gsub(/(\d{3})(?=\d)/, '\\1,').reverse
      decimal ? "#{delimited}.#{decimal}" : delimited
    end

    def parse_amount(amount)
      BigDecimal(amount.to_s)
    rescue ArgumentError, TypeError
      nil
    end
  end
end
