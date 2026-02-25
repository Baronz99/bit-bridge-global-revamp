# frozen_string_literal: true

class WebhookEvent < ApplicationRecord
  PROCESSING_STATUSES = %w[received processing processed failed ignored rejected].freeze

  scope :for_provider, ->(provider_name) {
    where(
      'LOWER(COALESCE(provider, source, ?)) = ?',
      '',
      provider_name.to_s.downcase
    )
  }

  def self.persist_received!(
    provider:,
    event_type:,
    reference: nil,
    provider_event_id: nil,
    headers: nil,
    payload: nil,
    signature_valid: true,
    received_at: Time.current
  )
    attrs = {
      provider: provider.to_s,
      source: provider.to_s,
      event_type: event_type.to_s.presence || 'unknown',
      reference: reference.to_s.presence,
      provider_event_id: provider_event_id.to_s.presence,
      headers: headers,
      payload: payload,
      payload_json: payload,
      received_at: received_at,
      signature_valid: signature_valid,
      processing_status: 'received'
    }

    event = create!(attrs)
    [event, true]
  rescue ActiveRecord::RecordNotUnique
    existing = find_existing_for_idempotency(
      provider: provider,
      event_type: event_type,
      reference: reference,
      provider_event_id: provider_event_id
    )
    [existing, false]
  end

  def mark_processing!
    update_columns(processing_status: 'processing', updated_at: Time.current)
  end

  def mark_processed!
    update_columns(processing_status: 'processed', processed_at: Time.current, processing_error: nil, updated_at: Time.current)
  end

  def mark_ignored!(reason: nil)
    update_columns(
      processing_status: 'ignored',
      processed_at: Time.current,
      processing_error: reason.to_s.presence,
      updated_at: Time.current
    )
  end

  def mark_rejected!(reason: nil)
    update_columns(
      processing_status: 'rejected',
      processed_at: Time.current,
      processing_error: reason.to_s.presence,
      updated_at: Time.current
    )
  end

  def mark_failed!(error_message:)
    update_columns(
      processing_status: 'failed',
      processed_at: Time.current,
      processing_error: error_message.to_s.truncate(500),
      updated_at: Time.current
    )
  end

  def self.find_existing_for_idempotency(provider:, event_type:, reference:, provider_event_id:)
    provider_scope = for_provider(provider)
    by_event_id = provider_scope.find_by(provider_event_id: provider_event_id.to_s) if provider_event_id.to_s.present?
    return by_event_id if by_event_id.present?

    if reference.to_s.present? && event_type.to_s.present?
      provider_scope.find_by(reference: reference.to_s, event_type: event_type.to_s)
    end
  end
end
