# frozen_string_literal: true

namespace :rewards do
  desc 'Backfill legacy transaction bonuses into reward_transactions (earned). DRY_RUN=1'
  task backfill_legacy_bonuses: :environment do
    dry_run = ENV.fetch('DRY_RUN', '1') != '0'
    stats = { scanned: 0, created: 0, skipped_existing: 0, errors: 0 }

    Transaction.where('bonus > 0')
               .includes(:wallet)
               .find_each(batch_size: 500) do |tx|
      stats[:scanned] += 1
      reference = "legacy_bonus/tx/#{tx.id}"
      exists = RewardTransaction.where(
        user_id: tx.wallet.user_id,
        bill_order_id: nil,
        status: :earned,
        service_type: 'legacy_bonus',
        source_label: reference
      ).exists?
      if exists
        stats[:skipped_existing] += 1
        next
      end

      unless dry_run
        RewardTransaction.create!(
          user_id: tx.wallet.user_id,
          bill_order_id: nil,
          amount: tx.bonus.to_d,
          source_amount: tx.amount.to_d,
          reward_rate: 0,
          currency: tx.wallet.currency,
          service_type: 'legacy_bonus',
          source_label: reference,
          status: :earned,
          earned_at: tx.created_at,
          created_at: Time.current,
          updated_at: Time.current
        )
        stats[:created] += 1
      end
    rescue StandardError => e
      stats[:errors] += 1
      Rails.logger.error("[rewards:backfill_legacy_bonuses] tx=#{tx.id} #{e.class}: #{e.message}")
    end

    puts stats.inspect
  end
end
