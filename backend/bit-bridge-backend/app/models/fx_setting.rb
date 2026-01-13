# frozen_string_literal: true

class FxSetting < ApplicationRecord
  validates :base_usd_ngn_rate, presence: true, numericality: { greater_than: 0 }
  validates :provider_fx_divisor, numericality: { greater_than: 0 }, allow_nil: true
  validates :card_monthly_maintenance_fee_usd_cents, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :card_creation_fee_usd_cents, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :card_funding_fee_bps, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :card_funding_fee_cap_usd_cents, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :card_withdrawal_fee_bps, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :card_withdrawal_fee_cap_usd_cents, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true

  def self.current
    first_or_create!(base_usd_ngn_rate: 1490)
  end
end
