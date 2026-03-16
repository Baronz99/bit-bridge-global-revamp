# frozen_string_literal: true

module Transfers
  class NgnTransferDailyLimit
    BUSINESS_TIMEZONE = 'Africa/Lagos'
    TIER_2_DAILY_LIMIT = 500_000.to_d
    TIER_3_DAILY_LIMIT = 3_000_000.to_d
    TIER_4_DAILY_LIMIT = 5_000_000.to_d
    TRANSFER_SUBTYPES = %w[principal fee].freeze

    def self.limit_for(user)
      return TIER_4_DAILY_LIMIT if user&.kyc_at_least?('tier_4')
      return TIER_3_DAILY_LIMIT if user&.kyc_at_least?('tier_3')
      return TIER_2_DAILY_LIMIT if user&.kyc_at_least?('tier_2')

      0.to_d
    end

    def self.business_time_zone
      Time.find_zone!(BUSINESS_TIMEZONE)
    end

    def self.business_now
      business_time_zone.now
    end

    def self.day_range(now: business_now)
      [now.beginning_of_day, now.end_of_day]
    end

    def self.daily_spent_for(user:, now: business_now)
      day_start, day_end = day_range(now: now)

      user
        .ngn_wallet
        .transactions
        .where(transaction_type: :withdrawal, status: :approved, coin_type: :bank)
        .where(created_at: day_start..day_end)
        .where("metadata ->> 'provider' = ?", 'anchor')
        .where("metadata ->> 'subtype' IN (?)", TRANSFER_SUBTYPES)
        .sum(:amount)
        .to_d
    end

    def self.summary(user:, now: business_now)
      limit = limit_for(user)
      spent = daily_spent_for(user: user, now: now)
      day_start, day_end = day_range(now: now)
      remaining = [limit - spent, 0.to_d].max

      {
        business_timezone: BUSINESS_TIMEZONE,
        day_start: day_start,
        day_end: day_end,
        daily_limit: limit,
        daily_spent: spent,
        daily_remaining: remaining,
        as_of: now
      }
    end

    def self.snapshot(user:, attempted_amount:, now: business_now)
      state = summary(user: user, now: now)
      attempted = attempted_amount.to_d
      limit = state[:daily_limit]
      spent = state[:daily_spent]
      remaining = [limit - spent, 0.to_d].max
      exceeded = (spent + attempted) > limit

      state.merge(
        attempted_amount: attempted,
        exceeded: exceeded
      )
    end
  end
end
