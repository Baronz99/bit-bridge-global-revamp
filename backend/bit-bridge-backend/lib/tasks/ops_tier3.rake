# frozen_string_literal: true

require "json"

namespace :ops do
  desc "Sweep stuck Tier 3 processing records"
  task tier3_sweep_stuck: :environment do
    dry_run = ActiveModel::Type::Boolean.new.cast(ENV.fetch("DRY_RUN", "false"))
    cutoff_minutes = ENV.fetch("CUTOFF_MINUTES", "120").to_i
    limit = ENV.fetch("LIMIT", "500").to_i

    summary = Kyc::Tier3StuckSweep
              .new(cutoff: cutoff_minutes.minutes)
              .call(dry_run: dry_run, limit: limit)

    puts "OPS_TIER3_SWEEP=#{JSON.generate(summary)}"
  rescue StandardError => e
    payload = {
      generated_at: Time.current.iso8601,
      error: {
        class: e.class.name,
        message: e.message
      }
    }
    puts "OPS_TIER3_SWEEP=#{JSON.generate(payload)}"
    raise
  end
end
