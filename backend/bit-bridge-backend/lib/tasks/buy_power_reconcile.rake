# frozen_string_literal: true

namespace :buy_power do
  desc 'Enqueue reconciliation for stale wallet bill orders'
  task reconcile_stale: :environment do
    cutoff = 10.minutes.ago
    BillOrder.where(payment_method: 'wallet', status: %w[processing pending initialized])
             .where('updated_at < ?', cutoff)
             .find_each do |order|
      BuyPowerReconcileJob.perform_later(order.id)
    end
  end
end
