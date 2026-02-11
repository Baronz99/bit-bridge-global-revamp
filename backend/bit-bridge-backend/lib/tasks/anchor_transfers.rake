# frozen_string_literal: true

namespace :anchor do
  desc 'Reconcile pending Anchor transfers (uses provider verify endpoint)'
  task reconcile_transfers: :environment do
    results = Transfers::AnchorTransferReconciler.call
    puts "Anchor reconcile done: #{results.inspect}"
  end

  desc 'Backfill ledger_hold_reserved on settled Anchor transfer withdrawals to prevent double-debit accounting'
  task reconcile_double_debit: :environment do
    dry_run = ENV.fetch('DRY_RUN', 'true').to_s.downcase != 'false'
    limit = ENV.fetch('LIMIT', Transfers::AnchorDoubleDebitReconciler::DEFAULT_LIMIT.to_s).to_i
    email = ENV['EMAIL']
    from = ENV['FROM']
    to = ENV['TO']

    results = Transfers::AnchorDoubleDebitReconciler.call(
      email: email,
      from: from,
      to: to,
      limit: limit,
      dry_run: dry_run
    )

    puts "Anchor double-debit reconcile done: #{results.inspect}"
  end
end
