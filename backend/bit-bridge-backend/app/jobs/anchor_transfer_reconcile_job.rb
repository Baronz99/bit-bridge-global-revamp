# frozen_string_literal: true

class AnchorTransferReconcileJob < ApplicationJob
  queue_as :default

  DEFAULT_SCHEDULE_DELAY = 2.minutes
  LOCK_KEY = 'jobs:anchor_transfer_reconcile:scheduled'
  LOCK_FALLBACK_CACHE_KEY = 'jobs:anchor_transfer_reconcile:scheduled:fallback'

  def self.enqueue_debounced!(delay: DEFAULT_SCHEDULE_DELAY, limit: nil, min_age_seconds: nil, reason: nil)
    ttl = [delay.to_i, 30].max
    return false unless acquire_schedule_lock!(ttl: ttl)

    set(wait: delay).perform_later(limit: limit, min_age_seconds: min_age_seconds, reason: reason)
    true
  end

  def self.acquire_schedule_lock!(ttl:)
    Sidekiq.redis do |redis|
      redis.set(LOCK_KEY, Time.current.to_i, nx: true, ex: ttl)
    end
  rescue StandardError
    Rails.cache.write(LOCK_FALLBACK_CACHE_KEY, Time.current.to_i, expires_in: ttl, unless_exist: true)
  end

  def self.release_schedule_lock!
    Sidekiq.redis { |redis| redis.del(LOCK_KEY) }
  rescue StandardError
    Rails.cache.delete(LOCK_FALLBACK_CACHE_KEY)
  end

  def perform(limit: nil, min_age_seconds: nil, reason: nil)
    should_reschedule = false
    min_age =
      if min_age_seconds.present?
        min_age_seconds.to_i.seconds
      else
        Transfers::AnchorTransferReconciler::DEFAULT_MIN_AGE
      end

    results = Transfers::AnchorTransferReconciler.call(limit: limit, min_age: min_age)
    should_reschedule = pending_transfers_exist?(min_age: min_age)
    results
  ensure
    self.class.release_schedule_lock!
    if should_reschedule
      self.class.enqueue_debounced!(delay: DEFAULT_SCHEDULE_DELAY, min_age_seconds: min_age_seconds, reason: 'pending_remaining')
    end
  end

  private

  def pending_transfers_exist?(min_age:)
    Transaction
      .where(status: 'pending', transaction_type: 'withdrawal')
      .where.not(transfer_id: [nil, ''])
      .where("metadata ->> 'provider' = ?", 'anchor')
      .where("metadata ->> 'subtype' = ?", 'principal')
      .where('created_at < ?', Time.current - min_age)
      .exists?
  end
end
