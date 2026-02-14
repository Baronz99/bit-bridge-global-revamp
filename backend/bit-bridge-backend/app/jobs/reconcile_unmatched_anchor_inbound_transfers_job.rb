# frozen_string_literal: true

class ReconcileUnmatchedAnchorInboundTransfersJob < ApplicationJob
  queue_as :default

  def perform(limit: 200, lookback_hours: 24)
    scope = InboundBankTransfer
            .where(provider: 'anchor', status: 'unmatched')
            .where('created_at >= ?', lookback_hours.to_i.hours.ago)
            .order(created_at: :asc)
            .limit(limit.to_i)

    scope.each do |inbound|
      payload = inbound.raw_payload
      payload = fallback_payload_for(inbound) unless payload.is_a?(Hash)

      AnchorWebhookProcessor.call(
        payload: payload,
        raw_body: payload.to_json,
        force: true
      )
    rescue StandardError => e
      Rails.logger.error("[AnchorPooledReconcile] failed inbound_id=#{inbound.id} provider_ref=#{inbound.provider_reference} message=#{e.message}")
    end
  end

  private

  def fallback_payload_for(inbound)
    {
      'type' => 'payin.received',
      'attributes' => {
        'payIn' => {
          'id' => inbound.provider_reference,
          'reference' => inbound.provider_reference,
          'amount' => inbound.amount_cents,
          'currency' => inbound.currency,
          'narration' => inbound.narration,
          'senderName' => inbound.sender_name,
          'paidAt' => inbound.received_at&.iso8601
        }
      }
    }
  end
end
