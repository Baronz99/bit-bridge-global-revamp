# frozen_string_literal: true

class Card < ApplicationRecord
  belongs_to :user

  STATUS_MAP = {
    'active' => 'active',
    'activated' => 'active',
    'enabled' => 'active',
    'frozen' => 'frozen',
    'blocked' => 'frozen',
    'disabled' => 'frozen',
    'inactive' => 'frozen',
    'pending' => 'pending',
    'created' => 'pending'
  }.freeze

  def apply_provider_status!(provider_status, livemode: nil)
    return if provider_status.blank?

    normalized = provider_status.to_s.downcase
    mapped = STATUS_MAP[normalized]

    payload = { provider_status: normalized, provider_updated_at: Time.current }
    payload[:provider_livemode] = livemode unless livemode.nil?

    if mapped.present?
      payload[:status] = mapped
    end

    meta = meta_data.is_a?(Hash) ? meta_data.dup : {}
    meta['provider_status_raw'] = provider_status
    payload[:meta_data] = meta

    update!(payload)
  end

  def apply_provider_state!(provider_data)
    data = provider_data.is_a?(Hash) ? provider_data : {}
    provider_status = data[:provider_status].presence || data['provider_status']
    is_active = data.key?(:is_active) ? data[:is_active] : data['is_active']
    livemode =
      if data.key?(:livemode)
        data[:livemode]
      elsif data.key?('livemode')
        data['livemode']
      end
    currency = data[:currency].presence || data['currency']
    balance = data[:balance].presence || data['balance']

    next_status =
      if is_active == true
        'active'
      elsif is_active == false
        'frozen'
      elsif provider_status.present?
        STATUS_MAP[provider_status.to_s.downcase]
      end

    if next_status.blank?
      recent_success =
        CardEvent.where(card_id: card_id)
                 .where(event_name: %w[card_debit_event card_credit_event])
                 .where(status: %w[successful notification])
                 .exists?
      next_status = 'active' if recent_success
    end

    payload = {
      provider_status: provider_status&.to_s&.downcase,
      provider_updated_at: Time.current
    }
    payload[:provider_livemode] = livemode unless livemode.nil?
    payload[:status] = next_status if next_status.present?

    meta = meta_data.is_a?(Hash) ? meta_data.dup : {}
    meta['provider_status_raw'] = provider_status if provider_status.present?
    meta['provider_currency'] = currency if currency.present?
    meta['provider_balance'] = balance if balance.present?
    meta['status_last_refreshed_at'] = Time.current.iso8601
    payload[:meta_data] = meta

    update!(payload)
  end
end
