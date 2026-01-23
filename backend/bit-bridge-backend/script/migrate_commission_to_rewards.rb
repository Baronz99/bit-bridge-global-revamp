#!/usr/bin/env ruby
# frozen_string_literal: true

# DRY_RUN=1 rails runner script/migrate_commission_to_rewards.rb

dry_run = ENV.fetch('DRY_RUN', '1') != '0'

stats = { scanned: 0, migrated: 0, skipped_existing: 0, non_positive: 0, errors: 0 }

Wallet.find_each(batch_size: 200) do |wallet|
  stats[:scanned] += 1
  commission = wallet.commission.to_d
  next if commission <= 0
  stats[:non_positive] += 1 and next if commission <= 0

  user_id = wallet.user_id
  migration_key = "wallet-#{wallet.id}-commission"

  existing = RewardTransaction.where(
    user_id: user_id,
    status: :earned,
    metadata: { 'source' => 'legacy_wallet_commission', 'migration_key' => migration_key }
  ).exists?
  if existing
    stats[:skipped_existing] += 1
    next
  end

  unless dry_run
    RewardTransaction.create!(
      user_id: user_id,
      bill_order_id: nil,
      amount: commission,
      source_amount: commission,
      reward_rate: 0,
      currency: 'NGN',
      service_type: 'legacy',
      source_label: 'legacy_commission',
      status: :earned,
      earned_at: Time.current,
      metadata: {
        source: 'legacy_wallet_commission',
        wallet_id: wallet.id,
        migration_key: migration_key
      }
    )
  end
  stats[:migrated] += 1
end

puts stats.inspect
