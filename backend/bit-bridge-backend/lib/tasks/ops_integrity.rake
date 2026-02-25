# frozen_string_literal: true

require 'json'

namespace :ops do
  desc 'Emit one-line ops integrity summary for scheduler/cron ingestion'
  task integrity_summary: :environment do
    payload =
      begin
        Ops::SummaryBuilder.new(window_hours: 24).call
      rescue StandardError => e
        {
          generated_at: Time.current.iso8601,
          window_hours: 24,
          error: {
            message: e.message,
            class: e.class.name
          }
        }
      end

    puts "OPS_SUMMARY=#{JSON.generate(payload)}"
  end
end
