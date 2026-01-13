# frozen_string_literal: true

class AnchorTransferReconcileJob < ApplicationJob
  queue_as :default

  def perform(limit: nil, min_age_seconds: nil)
    min_age =
      if min_age_seconds.present?
        min_age_seconds.to_i.seconds
      else
        Transfers::AnchorTransferReconciler::DEFAULT_MIN_AGE
      end

    Transfers::AnchorTransferReconciler.call(limit: limit, min_age: min_age)
  end
end
