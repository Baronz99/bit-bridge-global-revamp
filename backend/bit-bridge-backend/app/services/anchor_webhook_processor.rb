# frozen_string_literal: true

require 'digest'

class AnchorWebhookProcessor
  def self.call(payload:, raw_body: nil)
    new(payload: payload, raw_body: raw_body).call
  end

  def initialize(payload:, raw_body:)
    @payload = payload.is_a?(Hash) ? payload : {}
    @raw_body = raw_body.to_s
  end

  def call
    event_type = @payload['type'].presence || 'unknown'
    reference = extract_reference(@payload, @raw_body)

    record = AnchorWebhookEvent.find_or_initialize_by(event_type: event_type, reference: reference)
    record.payload = @payload
    record.received_at ||= Time.current
    record.status ||= 'received'
    record.save! if record.changed?

    return if record.processed_at.present? && record.status == 'processed'

    process_event!(event_type, @payload)
    record.update!(status: 'processed', processed_at: Time.current, error_message: nil)
  rescue StandardError => e
    record.update!(status: 'failed', error_message: e.message) if record&.persisted?
    raise
  end

  private

  def extract_reference(payload, raw_body)
    transfer_id = payload.dig('relationships', 'transfer', 'data', 'id')
    payment_id = payload.dig('attributes', 'payment', 'paymentId')
    payment_reference = payload.dig('attributes', 'payment', 'paymentReference')
    account_id = payload.dig('relationships', 'customer', 'data', 'id')
    event_id = payload['id']

    reference = transfer_id || payment_id || payment_reference || account_id || event_id
    return reference.to_s if reference.present?

    digest = Digest::SHA256.hexdigest(raw_body.to_s)
    "body:#{digest}"
  end

  def process_event!(event_type, payload)
    service = AnchorService.new

    case event_type
    when 'customer.identification.approved'
      account_id = payload.dig('relationships', 'customer', 'data', 'id')
      handle_kyc_verification(account_id)
    when 'nip.inbound.completed'
      transfer_id = payload.dig('relationships', 'transfer', 'data', 'id')
      service.get_inbound_transfer(transfer_id) if transfer_id.present?
    when 'nip.transfer.successful'
      service.confirm_transfer_withdrawal(payload)
    when 'nip.transfer.failed', 'nip.transfer.reversed', 'nip.transfer.rejected'
      service.fail_transfer_withdrawal(payload)
    when 'payment.settled'
      service.fund_deposit_account(payload)
    else
      if event_type.to_s.include?('transfer') &&
         event_type.to_s.match?(/failed|reversed|rejected/)
        service.fail_transfer_withdrawal(payload)
      end
      # No-op for unhandled event types
    end
  end

  def handle_kyc_verification(account_id)
    return if account_id.blank?

    account = Account.find_by(account_id: account_id)
    account&.update(status: 'verified')
  end
end
