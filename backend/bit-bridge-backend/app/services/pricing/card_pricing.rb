# frozen_string_literal: true

require 'bigdecimal'

module Pricing
  class CardPricing
    PROVIDER_FEE_PERCENT_USD = 0.01
    PROVIDER_FEE_CAP_USD = 10
    PROVIDER_FEE_PERCENT_NON_USD = 0.015

    BITBRIDGE_FEE_PERCENT_USD = 0.01
    BITBRIDGE_FEE_CAP_USD = 5
    BITBRIDGE_FX_MARKUP_PERCENT = 0.012

    class << self
      def quote(payload)
        data = payload.is_a?(Hash) ? payload : {}
        principal_usd = to_usd_amount(data)
        is_non_usd = non_usd_spend?(data)

        provider_fee_usd =
          if is_non_usd
            usd_round(principal_usd * PROVIDER_FEE_PERCENT_NON_USD)
          else
            usd_round([principal_usd * PROVIDER_FEE_PERCENT_USD, PROVIDER_FEE_CAP_USD].min)
          end

        bitbridge_fee_usd =
          if is_non_usd
            0.to_d
          else
            usd_round([principal_usd * BITBRIDGE_FEE_PERCENT_USD, BITBRIDGE_FEE_CAP_USD].min)
          end

        fx_markup_usd =
          if is_non_usd
            usd_round(principal_usd * BITBRIDGE_FX_MARKUP_PERCENT)
          else
            0.to_d
          end

        total_debit_usd = usd_round(principal_usd + provider_fee_usd + bitbridge_fee_usd + fx_markup_usd)

        {
          principal_usd: principal_usd,
          provider_fee_usd: provider_fee_usd,
          bitbridge_fee_usd: bitbridge_fee_usd,
          fx_markup_usd: fx_markup_usd,
          total_debit_usd: total_debit_usd,
          provider_fee_rule: {
            percent: is_non_usd ? PROVIDER_FEE_PERCENT_NON_USD : PROVIDER_FEE_PERCENT_USD,
            cap: is_non_usd ? nil : PROVIDER_FEE_CAP_USD
          },
          bitbridge_fee_rule: {
            percent: is_non_usd ? BITBRIDGE_FX_MARKUP_PERCENT : BITBRIDGE_FEE_PERCENT_USD,
            cap: is_non_usd ? nil : BITBRIDGE_FEE_CAP_USD
          },
          is_non_usd: is_non_usd
        }
      end

      private

      def non_usd_spend?(data)
        tx_currency = data['currency'].presence || data['transaction_currency'].presence
        billing_currency = data['billing_currency'].presence
        settlement_currency = data['settlement_currency'].presence

        [tx_currency, billing_currency, settlement_currency].compact.any? { |cur| cur.to_s.upcase != 'USD' }
      end

      def to_usd_amount(data)
        amount = amount_from_payload(data)
        usd_round(amount)
      end

      def amount_from_payload(data)
        return 0.to_d unless data.is_a?(Hash)

        cents =
          data['amount_cents'] ||
          data['amount_in_cents'] ||
          data['settled_amount_cents'] ||
          data['billing_amount_cents']

        if cents.present?
          return BigDecimal(cents.to_s) / 100
        end

        settlement_currency = data['settlement_currency'].presence
        billing_currency = data['billing_currency'].presence
        tx_currency = data['currency'].presence || data['transaction_currency'].presence

        if settlement_currency&.upcase == 'USD' && data['settled_amount'].present?
          return BigDecimal(data['settled_amount'].to_s)
        end

        if billing_currency&.upcase == 'USD' && data['billing_amount'].present?
          return BigDecimal(data['billing_amount'].to_s)
        end

        if tx_currency&.upcase == 'USD' && data['amount'].present?
          return BigDecimal(data['amount'].to_s)
        end

        if data['amount_usd'].present?
          return BigDecimal(data['amount_usd'].to_s)
        end

        BigDecimal(data['amount'].to_s)
      rescue ArgumentError
        0.to_d
      end

      def usd_round(value)
        BigDecimal(value.to_s).round(2)
      rescue ArgumentError
        0.to_d
      end
    end
  end
end
