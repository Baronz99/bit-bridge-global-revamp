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
      setting = FxSetting.current
      ensure_bridgecard_provider_rate_current!(setting) if bridgecard_base_lock_enabled?

      raw_rate =
        if @base_rate_override.present?
          @base_rate_override
        elsif bridgecard_base_lock_enabled? && bridgecard_provider_usable?(setting)
          setting.provider_usd_ngn_rate
        else
          setting.base_usd_ngn_rate
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

    private

    def ensure_bridgecard_provider_rate_current!(setting)
      return unless realtime_provider_refresh_enabled?
      return if bridgecard_provider_fresh_for_realtime?(setting)

      refresh_window_seconds = provider_refresh_window_seconds
      now = Time.current

      setting.with_lock do
        setting.reload

        return if bridgecard_provider_fresh_for_realtime?(setting)
        return if setting.provider_next_refresh_at.present? && setting.provider_next_refresh_at > now

        setting.update_column(:provider_next_refresh_at, now + refresh_window_seconds.seconds)

        begin
          Bridgecard::FxRateFetcher.call(setting: setting)
          setting.reload
        rescue Bridgecard::FxRateFetcher::Error => e
          Rails.logger.warn("[FxDesk::Pricing] bridgecard_realtime_refresh_failed message=#{e.message}")
        end
      end
    rescue StandardError => e
      Rails.logger.warn("[FxDesk::Pricing] bridgecard_realtime_refresh_error message=#{e.message}")
    end

    def bridgecard_provider_fresh_for_realtime?(setting)
      return false unless bridgecard_provider_usable?(setting)

      setting.provider_updated_at >= provider_refresh_window_seconds.seconds.ago
    end

    def provider_refresh_window_seconds
      value = ENV.fetch('FX_PROVIDER_REALTIME_REFRESH_SECONDS', '20').to_i
      value = 20 if value <= 0
      value
    end

    def realtime_provider_refresh_enabled?
      if ENV.key?('FX_PROVIDER_REALTIME_SYNC')
        ActiveModel::Type::Boolean.new.cast(ENV['FX_PROVIDER_REALTIME_SYNC'])
      else
        !Rails.env.test?
      end
    end

    def bridgecard_base_lock_enabled?
      ENV['FX_BASE_RATE_SOURCE'].to_s.casecmp('bridgecard').zero? ||
        ActiveModel::Type::Boolean.new.cast(ENV['FX_BASE_RATE_BRIDGECARD_LOCK'])
    end

    def bridgecard_provider_usable?(setting)
      return false unless setting.provider_source.to_s.casecmp('bridgecard').zero?
      return false if setting.provider_usd_ngn_rate.blank?
      return false if setting.provider_updated_at.blank?

      max_age_seconds = ENV.fetch('FX_PROVIDER_MAX_AGE_SECONDS', '300').to_i
      max_age_seconds = 300 if max_age_seconds <= 0
      setting.provider_updated_at >= max_age_seconds.seconds.ago
    end
  end
end
