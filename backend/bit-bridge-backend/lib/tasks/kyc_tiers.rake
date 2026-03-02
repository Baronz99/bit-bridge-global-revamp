# frozen_string_literal: true

namespace :kyc do
  desc "Recalculate KYC tiers for all users using strict ladder rules"
  task backfill_tiers: :environment do
    before_counts = Hash.new(0)
    after_counts = Hash.new(0)
    updated = 0
    processed = 0

    User.find_in_batches(batch_size: 500) do |batch|
      batch.each do |user|
        processed += 1
        before = user.kyc_level.to_s.presence || "tier_0"
        before_counts[before] += 1

        calculated = Kyc::LevelCalculator.resolve_level(user)
        after_counts[calculated] += 1

        next if before == calculated

        user.update_columns(kyc_level: calculated, updated_at: Time.current)
        updated += 1
      end
    end

    puts "[kyc:backfill_tiers] processed=#{processed} updated=#{updated}"
    puts "[kyc:backfill_tiers] before=#{before_counts.sort.to_h}"
    puts "[kyc:backfill_tiers] after=#{after_counts.sort.to_h}"
  end
end
