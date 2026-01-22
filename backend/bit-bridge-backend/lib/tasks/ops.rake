# frozen_string_literal: true

namespace :ops do
  desc 'Repair processing bill orders stalled with unprocessable_entity and no ledger entries'
  task repair_stale_unprocessable_bill_orders: :environment do
    cutoff_hours = (ENV['CUTOFF_HOURS'] || 24).to_i
    limit = (ENV['LIMIT'] || 200).to_i
    dry_run = ENV.fetch('DRY_RUN', 'true').to_s.downcase != 'false'
    cutoff_time = cutoff_hours.hours.ago

    service = Ops::RepairStaleUnprocessableBillOrders.new(
      cutoff_time: cutoff_time,
      limit: limit,
      dry_run: dry_run
    ).run

    summary = service.summary
    puts "[ops:repair_stale_unprocessable_bill_orders] dry_run=#{summary[:dry_run]} cutoff_time=#{cutoff_time.iso8601} limit=#{limit}"
    puts "[ops:repair_stale_unprocessable_bill_orders] candidates=#{summary[:candidates]} updated=#{summary[:updated]} skipped=#{summary[:skipped]}"
  end
end
