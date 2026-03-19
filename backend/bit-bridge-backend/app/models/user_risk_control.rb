# frozen_string_literal: true

class UserRiskControl < ApplicationRecord
  belongs_to :user
  belongs_to :set_by_admin, class_name: 'User', optional: true
  belongs_to :released_by_admin, class_name: 'User', optional: true

  validates :single_txn_limit_cents, :daily_limit_cents, :weekly_limit_cents,
            numericality: { greater_than_or_equal_to: 0, allow_nil: true }
  validates :provider_freeze_status,
            inclusion: { in: %w[pending frozen failed released], allow_blank: true }
  validate :auto_lock_requires_monitoring

  def restrict!(reason:, admin:)
    update!(
      restricted: true,
      restriction_reason: reason,
      set_by_admin: admin,
      released_by_admin: nil,
      released_at: nil
    )
  end

  def release!(admin:)
    update!(
      restricted: false,
      released_by_admin: admin,
      released_at: Time.current
    )
  end

  private

  def auto_lock_requires_monitoring
    return unless auto_lock_enabled? && !monitoring_enabled?

    errors.add(:auto_lock_enabled, 'requires monitoring to be enabled')
  end
end
