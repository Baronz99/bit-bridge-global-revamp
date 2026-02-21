# frozen_string_literal: true

class AnchorFailedDebitRefundReconcileJob < ApplicationJob
  queue_as :default

  def perform(email: nil, from: nil, to: nil, limit: nil, dry_run: true)
    Transfers::AnchorFailedDebitRefundReconciler.call(
      email: email,
      from: from,
      to: to,
      limit: limit,
      dry_run: dry_run
    )
  end
end
