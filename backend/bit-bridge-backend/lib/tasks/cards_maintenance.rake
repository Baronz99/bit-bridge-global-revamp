# frozen_string_literal: true

namespace :cards do
  desc 'Charge monthly maintenance fee for active cards'
  task charge_monthly_maintenance: :environment do
    result = Cards::MonthlyMaintenanceCharger.call
    puts "Monthly maintenance charged=#{result[:charged]}"
  end
end
