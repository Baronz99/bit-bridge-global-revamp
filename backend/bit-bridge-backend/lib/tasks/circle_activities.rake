# frozen_string_literal: true

namespace :circle_activities do
  desc "Refresh statuses for all circle activities (complete/expire as needed)"
  task refresh_statuses: :environment do
    count = 0

    CircleActivity.find_each do |act|
      begin
        act.refresh_status!
        count += 1
      rescue StandardError => e
        Rails.logger.error("[circle_activities:refresh_statuses] #{act.id} #{e.class}: #{e.message}")
      end
    end

    puts "Refreshed #{count} circle activities"
  end
end
