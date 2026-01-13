# frozen_string_literal: true

module Transfers
  class AnchorTransferReconciler
    DEFAULT_LIMIT = 50
    DEFAULT_MIN_AGE = 2.minutes

    def self.call(limit: DEFAULT_LIMIT, min_age: DEFAULT_MIN_AGE)
      new(limit: limit, min_age: min_age).call
    end

    def initialize(limit:, min_age:)
      @limit = limit.to_i.positive? ? limit.to_i : DEFAULT_LIMIT
      @min_age = min_age || DEFAULT_MIN_AGE
    end

    def call
      results = {
        checked: 0,
        approved: 0,
        failed: 0,
        skipped: 0,
        errors: 0
      }

      service = AnchorService.new
      pending_transfers.each do |transaction|
        results[:checked] += 1

        response = service.verify_transfer_request(transaction.transfer_id)
        if response[:status] != :ok
          results[:errors] += 1
          next
        end

        provider_status = extract_status(response[:data])
        case provider_status
        when 'successful', 'success', 'completed', 'approved'
          approve_transfer!(transaction, provider_status)
          results[:approved] += 1
        when 'failed', 'reversed', 'rejected', 'cancelled'
          Transfers::AnchorNgnTransferService.reverse_transfer!(
            transaction,
            reason: "Provider status #{provider_status}",
            provider_status: provider_status
          )
          results[:failed] += 1
        else
          results[:skipped] += 1
        end
      rescue StandardError
        results[:errors] += 1
      end

      results
    end

    private

    def pending_transfers
      Transaction
        .where(status: 'pending', transaction_type: 'withdrawal')
        .where.not(transfer_id: [nil, ''])
        .where("metadata ->> 'provider' = ?", 'anchor')
        .where("metadata ->> 'subtype' = ?", 'principal')
        .where('created_at < ?', Time.current - @min_age)
        .order(created_at: :asc)
        .limit(@limit)
    end

    def extract_status(data)
      raw =
        data.is_a?(Hash) &&
        (data['status'] || data.dig('attributes', 'status') || data.dig(:attributes, :status))
      raw.to_s.downcase
    end

    def approve_transfer!(principal_tx, provider_status)
      meta = principal_tx.metadata.is_a?(Hash) ? principal_tx.metadata.dup : {}
      meta['provider_status'] = provider_status
      principal_tx.update!(status: 'approved', metadata: meta)

      fee_tx = fee_transaction(principal_tx)
      return unless fee_tx

      fee_meta = fee_tx.metadata.is_a?(Hash) ? fee_tx.metadata.dup : {}
      fee_meta['provider_status'] = provider_status
      fee_tx.update!(status: 'approved', metadata: fee_meta)
    end

    def fee_transaction(principal_tx)
      reference =
        principal_tx.metadata.is_a?(Hash) ? principal_tx.metadata['transfer_reference'] : nil
      return nil if reference.blank?

      Transaction
        .where(wallet_id: principal_tx.wallet_id)
        .where("metadata ->> 'transfer_reference' = ?", reference)
        .where("metadata ->> 'subtype' = ?", 'fee')
        .order(created_at: :desc)
        .first
    end
  end
end
