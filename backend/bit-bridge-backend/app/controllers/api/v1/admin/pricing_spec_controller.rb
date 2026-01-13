# frozen_string_literal: true

module Api
  module V1
    module Admin
      class PricingSpecController < ApplicationController
        before_action :authenticate_user!
        before_action :ensure_super_admin!

        def show
          setting = FxSetting.current
          card_fee_policy = Pricing::CardFeePolicy.new(setting: setting)

          render json: {
            message: 'ok',
            data: {
              tunnel: {
                conversion_fee_pct: FxDesk::Pricing::FEE_RATE.to_f * 100,
                markup_rules: {
                  percent_floor_rate: FxDesk::Pricing::PERCENT_FLOOR_RATE.to_f,
                  markup_min: FxDesk::Pricing::MARKUP_MIN.to_f,
                  tier_add: {
                    lt_50: FxDesk::Pricing::TIER_LOW_ADD.to_f,
                    lt_200: FxDesk::Pricing::TIER_MID_ADD.to_f,
                    gte_200: 0
                  }
                },
                base_rate_usd_ngn: setting.base_usd_ngn_rate.to_f
              },
              cards: {
                creation_fee_usd: (setting.card_creation_fee_usd_cents.to_i / 100.0).round(2),
                spend_fees: {
                  provider_fee_percent_usd: Pricing::CardPricing::PROVIDER_FEE_PERCENT_USD,
                  provider_fee_cap_usd: Pricing::CardPricing::PROVIDER_FEE_CAP_USD,
                  provider_fee_percent_non_usd: Pricing::CardPricing::PROVIDER_FEE_PERCENT_NON_USD,
                  bitbridge_fee_percent_usd: Pricing::CardPricing::BITBRIDGE_FEE_PERCENT_USD,
                  bitbridge_fee_cap_usd: Pricing::CardPricing::BITBRIDGE_FEE_CAP_USD,
                  bitbridge_fx_markup_percent: Pricing::CardPricing::BITBRIDGE_FX_MARKUP_PERCENT
                },
                new_fees: {
                  monthly_maintenance_fee_usd: card_fee_policy.monthly_maintenance_fee_usd.to_f,
                  funding_fee_bps: setting.card_funding_fee_bps.to_i,
                  funding_fee_cap_usd: (setting.card_funding_fee_cap_usd_cents.to_i / 100.0).round(2),
                  withdrawal_fee_bps: setting.card_withdrawal_fee_bps.to_i,
                  withdrawal_fee_cap_usd: (setting.card_withdrawal_fee_cap_usd_cents.to_i / 100.0).round(2)
                }
              },
              transfers: {
                anchor_fee_tiers: [
                  { max_amount: 1999, fee: Pricing::Engine.transfer_fee_ngn(1999).to_f },
                  { max_amount: 9999, fee: Pricing::Engine.transfer_fee_ngn(9999).to_f },
                  { max_amount: 49_999, fee: Pricing::Engine.transfer_fee_ngn(49_999).to_f },
                  { max_amount: nil, fee: Pricing::Engine.transfer_fee_ngn(50_000).to_f }
                ],
                stamp_duty_ngn: Pricing::Engine.stamp_duty_ngn(10_000).to_f,
                min_transfer_amount_ngn: Pricing::Engine::MIN_TRANSFER_AMOUNT_NGN
              },
              bills: {
                service_charge_ngn: 100,
                commission_pct: 1
              }
            }
          }, status: :ok
        end

        private

        def ensure_super_admin!
          return if current_user&.super_admin?

          render json: { message: 'Not authorized' }, status: :forbidden
        end
      end
    end
  end
end
