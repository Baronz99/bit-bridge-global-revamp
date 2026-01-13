# frozen_string_literal: true

module Bridgecard
  class CardStatusRefresher
    def self.call(card:)
      new(card: card).call
    end

    def initialize(card:)
      @card = card
      @service = BridgeCardService.new
    end

    def call
      return { status: :unprocessable_entity, message: 'card_id not available' } if @card&.card_id.blank?

      response = @service.fetch_card_details(card_id: @card.card_id)
      return response unless response[:ok]

      data = response[:data].is_a?(Hash) ? response[:data] : {}
      meta_currency = @card.meta_data.is_a?(Hash) ? @card.meta_data['provider_currency'] : nil
      currency = data[:currency].presence || @card.card_currency || meta_currency
      balance = normalize_provider_balance(data[:balance], currency)
      data = data.merge(currency: currency, balance: balance)

      @card.apply_provider_state!(data)
      raw = data[:raw].is_a?(Hash) ? data[:raw] : {}

      {
        status: :ok,
        data: {
          provider_status: @card.provider_status,
          provider_livemode: @card.provider_livemode,
          currency: currency,
          balance: balance,
          raw: raw
        }
      }
    rescue StandardError => e
      @card.update_columns(last_provider_sync_error: e.message) if @card&.persisted?
      { status: :unprocessable_entity, message: e.message }
    end

    private

    def normalize_provider_balance(value, currency)
      return nil if value.nil?

      amount = BigDecimal(value.to_s)
      code = currency.to_s.upcase

      if amount.frac.zero?
        int_val = amount.to_i
        if int_val >= 1000 && (int_val % 100).zero?
          return (amount / 100).round(2).to_f if code.blank? || code == 'USD'
        end
      end

      amount.round(2).to_f
    rescue StandardError
      nil
    end
  end
end
