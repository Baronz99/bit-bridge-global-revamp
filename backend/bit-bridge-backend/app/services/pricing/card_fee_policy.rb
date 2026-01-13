# frozen_string_literal: true

module Pricing
  class CardFeePolicy
    def initialize(setting: FxSetting.current)
      @setting = setting
    end

    def monthly_maintenance_fee_usd
      cents_to_usd(@setting.card_monthly_maintenance_fee_usd_cents)
    end

    def funding_fee_usd(principal_usd)
      fee_from_bps(
        principal_usd,
        @setting.card_funding_fee_bps,
        @setting.card_funding_fee_cap_usd_cents
      )
    end

    def withdrawal_fee_usd(principal_usd)
      fee_from_bps(
        principal_usd,
        @setting.card_withdrawal_fee_bps,
        @setting.card_withdrawal_fee_cap_usd_cents
      )
    end

    private

    def fee_from_bps(principal_usd, bps, cap_cents)
      bps = bps.to_i
      return 0.to_d if bps <= 0

      principal = BigDecimal(principal_usd.to_s)
      fee = usd_round(principal * bps.to_d / 10_000)

      cap = cap_cents.to_i
      if cap.positive?
        cap_usd = cents_to_usd(cap)
        fee = [fee, cap_usd].min
      end

      fee
    rescue ArgumentError
      0.to_d
    end

    def cents_to_usd(cents)
      usd_round(BigDecimal(cents.to_i) / 100)
    end

    def usd_round(value)
      BigDecimal(value.to_s).round(2)
    rescue ArgumentError
      0.to_d
    end
  end
end
