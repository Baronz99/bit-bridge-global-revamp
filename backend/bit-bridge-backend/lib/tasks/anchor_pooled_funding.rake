# frozen_string_literal: true

namespace :anchor_pooled_funding do
  desc 'Reconcile unmatched Anchor inbound transfers against funding intents'
  task reconcile_unmatched: :environment do
    limit = (ENV['LIMIT'] || 200).to_i
    lookback_hours = (ENV['LOOKBACK_HOURS'] || 24).to_i

    ReconcileUnmatchedAnchorInboundTransfersJob.perform_now(
      limit: limit,
      lookback_hours: lookback_hours
    )

    remaining = InboundBankTransfer
                .where(provider: 'anchor', status: 'unmatched')
                .where('created_at >= ?', lookback_hours.hours.ago)
                .count

    puts "reconciled_limit=#{limit} lookback_hours=#{lookback_hours} remaining_unmatched=#{remaining}"
  end
end
