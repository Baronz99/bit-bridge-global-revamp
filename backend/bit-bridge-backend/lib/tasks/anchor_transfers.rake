# frozen_string_literal: true

namespace :anchor do
  desc 'Reconcile pending Anchor transfers (uses provider verify endpoint)'
  task reconcile_transfers: :environment do
    results = Transfers::AnchorTransferReconciler.call
    puts "Anchor reconcile done: #{results.inspect}"
  end
end
