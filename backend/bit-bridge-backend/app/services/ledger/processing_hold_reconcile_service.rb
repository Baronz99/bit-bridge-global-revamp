# frozen_string_literal: true

module Ledger
  class ProcessingHoldReconcileService
    SUCCESS_STATUSES = %w[success successful completed paid].freeze
    FAILURE_STATUSES = %w[failed refund refunded reversed cancelled declined].freeze

    attr_reader :commit, :actions

    def initialize(commit: false, scope: default_scope, provider_client: BuyPowerPaymentService.new)
      @commit = commit
      @scope = scope
      @provider_client = provider_client
      @actions = {
        reconciled_success: [],
        reconciled_failed: [],
        pending: []
      }
    end

    def run
      @scope.find_each do |order|
        next if order.metadata&.[]('source') == 'anchor_transfer'
        wallet = order.user&.wallet
        next unless wallet

        hold, release, debit = ledger_sums(order)
        next if hold.zero?

        status = provider_status(order)
        outstanding = hold - release - debit
        next if outstanding <= 0

        case status
        when :success
          handle_success(wallet, order, outstanding)
        when :failed
          handle_failed(wallet, order, outstanding)
        else
          actions[:pending] << { bill_order_id: order.id, status: status }
        end
      end

      self
    end

    private

    def default_scope
      BillOrder.where(status: %w[processing initialized], payment_method: :wallet)
    end

    def provider_status(order)
      reference = order.provider_reference.presence || order.id
      response = @provider_client.re_query(reference)
      return :pending unless response[:status] == :ok

      data = response[:response]&.dig('result', 'data') || response[:response]&.dig('data') || {}
      provider_status = data['status'].to_s.downcase
      return :success if SUCCESS_STATUSES.include?(provider_status)
      return :failed if FAILURE_STATUSES.include?(provider_status)

      :pending
    rescue StandardError => e
      Rails.logger.error("[processing_hold_reconcile] order=#{order.id} requery_error=#{e.class}: #{e.message}")
      :pending
    end

    def ledger_sums(bill_order)
      totals = WalletLedgerEntry
               .where(bill_order: bill_order)
               .group(:entry_type)
               .sum(:amount)

      [
        totals['hold'] || 0,
        totals['release'] || 0,
        totals['debit'] || 0
      ].map { |value| BigDecimal(value.to_s) }
    end

    def handle_success(wallet, bill_order, amount)
      return if WalletLedgerEntry.debit_exists?(wallet: wallet, bill_order: bill_order)
      return if WalletLedgerEntry.release_exists?(wallet: wallet, bill_order: bill_order)

      reference = "reconcile/debit/#{bill_order.id}"
      created_entry = nil
      if commit
        created_entry = WalletLedgerEntry.record_debit!(
          wallet: wallet,
          bill_order: bill_order,
          amount: amount,
          reference: reference,
          metadata: { 'source' => 'ledger_repair', 'subtype' => 'hold_invariant', 'kind' => 'reconcile_processing' }
        )
      end
      actions[:reconciled_success] << { bill_order_id: bill_order.id, amount: amount.to_d, created: commit && created_entry.present? }
    end

    def handle_failed(wallet, bill_order, amount)
      return if WalletLedgerEntry.debit_exists?(wallet: wallet, bill_order: bill_order)
      return if WalletLedgerEntry.release_exists?(wallet: wallet, bill_order: bill_order)

      reference = "reconcile/release/#{bill_order.id}"
      created_entry = nil
      if commit
        created_entry = WalletLedgerEntry.release_hold!(
          wallet: wallet,
          bill_order: bill_order,
          amount: amount,
          reference: reference,
          metadata: { 'source' => 'ledger_repair', 'subtype' => 'hold_invariant', 'kind' => 'reconcile_processing' }
        )
      end
      actions[:reconciled_failed] << { bill_order_id: bill_order.id, amount: amount.to_d, created: commit && created_entry.present? }
    end
  end
end
