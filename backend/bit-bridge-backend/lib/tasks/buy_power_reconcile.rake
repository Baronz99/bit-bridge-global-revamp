# frozen_string_literal: true

namespace :buy_power do
  desc 'Enqueue reconciliation for stale wallet bill orders'
  task reconcile_stale: :environment do
    cutoff = 10.minutes.ago
    scope = BillOrder.where(payment_method: 'wallet', status: %w[processing pending initialized])
                     .where('updated_at < ?', cutoff)
                     .where("COALESCE(provider_response ->> 'source', '') <> ?", 'anchor_transfer')
                     .where.not(biller: 'Anchor', service_type: 'OTHER')
                     .where.not(description: 'Anchor NGN transfer hold')

    scope.find_each do |order|
      BuyPowerReconcileJob.perform_later(order.id)
    end
  end
end
