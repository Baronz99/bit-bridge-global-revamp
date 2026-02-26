# frozen_string_literal: true

module Kyc
  class Tier3StuckMonitorJob < ApplicationJob
    queue_as :default

    def perform(cutoff_minutes: 120, limit: 500)
      summary = Kyc::Tier3StuckSweep
                .new(cutoff: cutoff_minutes.to_i.minutes)
                .call(limit: limit)

      Rails.logger.info("[Tier3StuckMonitor] #{summary.to_json}")
      summary
    end
  end
end
