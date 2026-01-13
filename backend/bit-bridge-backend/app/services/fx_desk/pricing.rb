# frozen_string_literal: true

module FxDesk
  class Pricing
    FEE_RATE = BigDecimal('0.01')
    PERCENT_FLOOR_RATE = BigDecimal('0.008')
    MARKUP_MIN = BigDecimal('45')
    TIER_LOW_ADD = BigDecimal('30')
    TIER_MID_ADD = BigDecimal('15')

    def initialize(base_rate: nil)
      @base_rate_override = base_rate
    end

    def base_rate
      raw_rate =
        if @base_rate_override.present?
          @base_rate_override
        else
          FxSetting.current.base_usd_ngn_rate
        end

      raw_rate.to_d.round(46)
    end

    def markup_for_usd_notional(usd_notional)
      notional = usd_notional.to_d
      percent_floor = base_rate * PERCENT_FLOOR_RATE
      markup_floor = [MARKUP_MIN, percent_floor].max
      tier_add =
        if notional < 50
          TIER_LOW_ADD
        elsif notional < 200
          TIER_MID_ADD
        else
          0.to_d
        end

      (markup_floor + tier_add).round(0)
    end

    def ask_rate(usd_notional)
      base_rate + markup_for_usd_notional(usd_notional)
    end

    def bid_rate(usd_notional)
      base_rate - markup_for_usd_notional(usd_notional)
    end

    def quote_ngn_to_usd(amount_ngn)
      amount_in_raw = amount_ngn.to_d
      amount_in = Money.ngn(amount_in_raw)
      fee_raw = amount_in * FEE_RATE
      fee_amount = Money.ngn(fee_raw)
      amount_after_fee_raw = amount_in - fee_raw
      amount_after_fee = Money.ngn(amount_after_fee_raw)
      usd_notional = amount_in / base_rate
      execution_rate_raw = ask_rate(usd_notional).round(46)
      execution_rate = Money.rate(execution_rate_raw)
      amount_out_raw = amount_after_fee_raw / execution_rate_raw
      amount_out = Money.usd(amount_out_raw)

      markup_value = markup_for_usd_notional(usd_notional)

      {
        from: 'NGN',
        to: 'USD',
        base_rate: Money.rate(base_rate),
        base_rate_raw: base_rate,
        markup: markup_value,
        markup_raw: markup_value,
        execution_rate: execution_rate,
        execution_rate_raw: execution_rate_raw,
        fee_amount: fee_amount,
        fee_amount_raw: fee_raw,
        fee_currency: 'NGN',
        amount_in: amount_in,
        amount_in_raw: amount_in_raw,
        amount_after_fee: amount_after_fee,
        amount_after_fee_raw: amount_after_fee_raw,
        amount_out: amount_out,
        amount_out_raw: amount_out_raw,
        as_of: Time.current
      }
    end

    def quote_usd_to_ngn(amount_usd)
      amount_in_raw = amount_usd.to_d
      amount_in = Money.usd(amount_in_raw)
      fee_raw = amount_in * FEE_RATE
      fee_amount = Money.usd(fee_raw)
      amount_after_fee_raw = amount_in - fee_raw
      amount_after_fee = Money.usd(amount_after_fee_raw)
      usd_notional = amount_in
      execution_rate_raw = bid_rate(usd_notional).round(46)
      execution_rate = Money.rate(execution_rate_raw)
      amount_out_raw = amount_after_fee_raw * execution_rate_raw
      amount_out = Money.ngn(amount_out_raw)

      markup_value = markup_for_usd_notional(usd_notional)

      {
        from: 'USD',
        to: 'NGN',
        base_rate: Money.rate(base_rate),
        base_rate_raw: base_rate,
        markup: markup_value,
        markup_raw: markup_value,
        execution_rate: execution_rate,
        execution_rate_raw: execution_rate_raw,
        fee_amount: fee_amount,
        fee_amount_raw: fee_raw,
        fee_currency: 'USD',
        amount_in: amount_in,
        amount_in_raw: amount_in_raw,
        amount_after_fee: amount_after_fee,
        amount_after_fee_raw: amount_after_fee_raw,
        amount_out: amount_out,
        amount_out_raw: amount_out_raw,
        as_of: Time.current
      }
    end
  end
end
