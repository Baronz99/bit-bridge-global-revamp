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
          Transfers::AnchorNgnTransferService.mark_success!(
            transaction,
            provider_status: provider_status,
            provider_transfer_id: transaction.transfer_id
          )
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

  end
end
