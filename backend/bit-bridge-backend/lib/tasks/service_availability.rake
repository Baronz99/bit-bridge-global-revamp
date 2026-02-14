# frozen_string_literal: true

namespace :service_availability do
  desc 'Refresh provider-backed service availability snapshot from recent BillOrder outcomes'
  task refresh: :environment do
    result = ProviderServiceStatusRefreshJob.perform_now

    puts "provider=#{result[:provider]} refreshed=#{result[:refreshed]} window_started_at=#{result[:window_started_at].iso8601} window_ended_at=#{result[:window_ended_at].iso8601}"
  end
end