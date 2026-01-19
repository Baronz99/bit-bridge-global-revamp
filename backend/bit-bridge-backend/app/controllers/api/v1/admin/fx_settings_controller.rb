# frozen_string_literal: true

module Api
  module V1
    module Admin
      class FxSettingsController < ApplicationController
        before_action :authenticate_user!
        before_action :ensure_admin!
        before_action :set_setting

        def show
          render json: { message: 'FX settings loaded', data: serialize_setting(@setting) }, status: :ok
        end

        def update
          rate = params[:base_usd_ngn_rate] || params.dig(:fx_setting, :base_usd_ngn_rate)
          divisor = params[:provider_fx_divisor] || params.dig(:fx_setting, :provider_fx_divisor)
          rate = rate.to_d

          unless rate.between?(500, 5000)
            return render json: { message: 'base_usd_ngn_rate must be between 500 and 5000' },
                          status: :unprocessable_entity
          end

          updates = { base_usd_ngn_rate: rate }
          fee_updates = extract_card_fee_updates
          if fee_updates.any?
            return render json: { message: 'Not authorized' }, status: :forbidden unless current_user&.super_admin?

            updates.merge!(fee_updates)
          end

          if divisor.present?
            divisor = divisor.to_i
            if divisor <= 0
              return render json: { message: 'provider_fx_divisor must be greater than 0' },
                            status: :unprocessable_entity
            end
            updates[:provider_fx_divisor] = divisor
            if @setting.provider_raw.present?
              updates[:provider_usd_ngn_rate] = (@setting.provider_raw.to_d / divisor).round(6)
            end
          end

          @setting.update!(updates)

          render json: {
            message: 'FX settings updated',
            data: serialize_setting(@setting)
          }, status: :ok
        rescue ActionController::BadRequest => e
          render json: { message: e.message }, status: :unprocessable_entity
        end

        def refresh_provider
          if @setting.provider_updated_at.present? && @setting.provider_updated_at >= 1.minute.ago
            retry_after = (@setting.provider_updated_at + 1.minute - Time.current).ceil
            return render json: {
              message: 'Provider FX can only be refreshed once per minute',
              retry_after_seconds: retry_after,
              data: serialize_setting(@setting)
            }, status: :too_many_requests
          end

          provider = Bridgecard::FxRateFetcher.call(setting: @setting)
          render json: {
            message: 'Provider FX refreshed',
            data: {
              base_usd_ngn_rate: @setting.base_usd_ngn_rate.to_f,
              updated_at: @setting.updated_at&.iso8601,
              provider: provider
            }
          }, status: :ok
        rescue Bridgecard::FxRateFetcher::Error => e
          render json: {
            message: e.message,
            data: serialize_setting(@setting)
          }, status: :bad_gateway
        end

        def apply_provider
          if @setting.provider_usd_ngn_rate.blank?
            return render json: { message: 'Provider FX rate not available yet' },
                          status: :unprocessable_entity
          end

          @setting.update!(base_usd_ngn_rate: @setting.provider_usd_ngn_rate)
          render json: {
            message: 'Provider FX rate applied',
            data: {
              base_usd_ngn_rate: @setting.base_usd_ngn_rate.to_f,
              updated_at: @setting.updated_at&.iso8601,
              provider: provider_payload(@setting)
            }
          }, status: :ok
        end

        def refresh_exchange_rate
          if @setting.provider_updated_at.present? && @setting.provider_updated_at >= 1.minute.ago
            retry_after = (@setting.provider_updated_at + 1.minute - Time.current).ceil
            return render json: {
              message: 'Provider FX can only be refreshed once per minute',
              retry_after_seconds: retry_after,
              data: {
                base: serialize_base(@setting),
                provider: serialize_provider(@setting),
                bridgecard_provider: provider_payload(@setting)
              }
            }, status: :too_many_requests
          end

          provider = Fx::Providers::ExchangeRateApiFetcher.call(setting: @setting)
          render json: {
            message: 'Provider FX updated',
            data: {
              base: serialize_base(@setting),
              provider: serialize_provider(@setting).merge(provider),
              bridgecard_provider: provider_payload(@setting)
            }
          }, status: :ok
        rescue Fx::Providers::ExchangeRateApiFetcher::Error => e
          render json: {
            message: e.message,
            data: {
              base: serialize_base(@setting),
              provider: serialize_provider(@setting),
              bridgecard_provider: provider_payload(@setting)
            }
          }, status: :bad_gateway
        end

        def apply_exchange_rate
          apply_param = params[:apply]
          apply =
            if apply_param.respond_to?(:to_unsafe_h)
              apply_param.to_unsafe_h
            elsif apply_param.is_a?(Hash)
              apply_param
            else
              {}
            end
          currencies = Array(apply[:currencies]).map { |c| c.to_s.upcase }.uniq
          apply_ngn = apply[:ngn_to_usd_base] == true || apply[:ngn_to_usd_base].to_s == 'true'
          force_apply = apply[:force] == true || apply[:force].to_s == 'true'

          rates = @setting.provider_rates.to_h
          if rates.blank?
            return render json: { message: 'Provider rates not available yet' },
                          status: :unprocessable_entity
          end

          if provider_stale?(@setting) && !force_apply
            return render json: { message: 'Provider feed is stale. Refresh first.' },
                          status: :unprocessable_entity
          end

          updates = {}
          if apply_ngn && rates['NGN'].present?
            ngn_value = rates['NGN'].to_d
            unless ngn_value.between?(300, 5000)
              return render json: { message: 'NGN rate is out of range for apply' },
                            status: :unprocessable_entity
            end
            updates[:base_usd_ngn_rate] = ngn_value
          end

          base_fx_rates = @setting.base_fx_rates.is_a?(Hash) ? @setting.base_fx_rates.dup : {}
          if rates['NGN'].present?
            base_fx_rates['USDNGN'] = rates['NGN'].to_d.round(8).to_f
          end
          currencies.each do |code|
            raw = rates[code]
            if raw.blank?
              return render json: { message: "#{code} rate is missing for apply" },
                            status: :unprocessable_entity
            end
            unless rate_in_range?(code, raw.to_d)
              return render json: { message: "#{code} rate is out of range for apply" },
                            status: :unprocessable_entity
            end

            base_fx_rates["#{code}USD"] = (1.to_d / raw.to_d).round(8).to_f
          end
          updates[:base_fx_rates] = base_fx_rates

          @setting.update!(updates) if updates.any?

          render json: {
            message: 'Provider rate applied',
            data: {
              base: serialize_base(@setting),
              provider: serialize_provider(@setting),
              bridgecard_provider: provider_payload(@setting)
            }
          }, status: :ok
        end

        private

        def ensure_admin!
          return if current_user&.admin?

          render json: { message: 'Not authorized' }, status: :forbidden
        end

        def set_setting
          @setting = FxSetting.current
        end

        def serialize_setting(setting)
          pricing = FxDesk::Pricing.new(base_rate: setting.base_usd_ngn_rate)
          samples = [25, 100, 500]
          previews =
            samples.each_with_object([]) do |notional, memo|
              markup = pricing.markup_for_usd_notional(notional)
              memo << {
                usd_notional: notional.to_f,
                markup: markup.to_f,
                ask_rate: pricing.ask_rate(notional).to_f,
                bid_rate: pricing.bid_rate(notional).to_f
              }
            end

          {
            base_usd_ngn_rate: setting.base_usd_ngn_rate.to_f,
            previews: previews,
            updated_at: setting.updated_at&.iso8601,
            provider: serialize_provider(setting),
            bridgecard_provider: provider_payload(setting),
            base: serialize_base(setting),
            provider_feed: serialize_provider(setting),
            card_fees: card_fees_payload(setting)
          }
        end

        def provider_payload(setting)
          {
            raw: setting.provider_raw,
            divisor: setting.provider_fx_divisor,
            computed_rate: setting.provider_usd_ngn_rate&.to_f,
            as_of: setting.provider_updated_at&.iso8601,
            source: setting.provider_source,
            pair: Bridgecard::FxRateFetcher::RATE_KEY
          }
        end

        def serialize_base(setting)
          {
            base_usd_ngn_rate: setting.base_usd_ngn_rate.to_f,
            updated_at: setting.updated_at&.iso8601,
            base_fx_rates_count: setting.base_fx_rates.is_a?(Hash) ? setting.base_fx_rates.size : 0
          }
        end

        def serialize_provider(setting)
          rates = setting.provider_rates.is_a?(Hash) ? setting.provider_rates : {}
          preview_codes = %w[NGN EUR GBP CAD KES GHS ZAR JPY AUD CNY]
          preview = rates.slice(*preview_codes)
          derived = {
            'EURUSD' => rates['EUR'].present? ? (1.to_d / rates['EUR'].to_d).round(8).to_f : nil,
            'GBPUSD' => rates['GBP'].present? ? (1.to_d / rates['GBP'].to_d).round(8).to_f : nil,
            'CADUSD' => rates['CAD'].present? ? (1.to_d / rates['CAD'].to_d).round(8).to_f : nil
          }.compact
          updated_at = setting.provider_updated_at
          age_seconds = updated_at.present? ? (Time.current - updated_at).to_i : nil
          stale = updated_at.blank? || updated_at < 12.hours.ago

          {
            source: setting.provider_source,
            base: setting.provider_base,
            as_of: setting.provider_as_of,
            updated_at: setting.provider_updated_at&.iso8601,
            error: setting.provider_error,
            rates_preview: preview,
            computed_ngn_per_usd: rates['NGN'],
            derived_preview: derived,
            age_seconds: age_seconds,
            stale: stale
          }
        end

        def provider_stale?(setting)
          setting.provider_updated_at.blank? || setting.provider_updated_at < 12.hours.ago
        end

        def rate_in_range?(code, value)
          case code
          when 'EUR'
            value.between?(0.5, 2.0)
          when 'GBP'
            value.between?(0.3, 2.0)
          when 'CAD'
            value.between?(0.5, 3.0)
          else
            value.positive?
          end
        end

        def card_fees_payload(setting)
          {
            creation_fee_usd: (setting.card_creation_fee_usd_cents.to_i / 100.0).round(2),
            monthly_maintenance_fee_usd: (setting.card_monthly_maintenance_fee_usd_cents.to_i / 100.0).round(2),
            funding_fee_bps: setting.card_funding_fee_bps.to_i,
            funding_fee_cap_usd: (setting.card_funding_fee_cap_usd_cents.to_i / 100.0).round(2),
            withdrawal_fee_bps: setting.card_withdrawal_fee_bps.to_i,
            withdrawal_fee_cap_usd: (setting.card_withdrawal_fee_cap_usd_cents.to_i / 100.0).round(2)
          }
        end

        def extract_card_fee_updates
          fee_params = {
            card_creation_fee_usd_cents: params[:card_creation_fee_usd_cents],
            card_monthly_maintenance_fee_usd_cents: params[:card_monthly_maintenance_fee_usd_cents],
            card_funding_fee_bps: params[:card_funding_fee_bps],
            card_funding_fee_cap_usd_cents: params[:card_funding_fee_cap_usd_cents],
            card_withdrawal_fee_bps: params[:card_withdrawal_fee_bps],
            card_withdrawal_fee_cap_usd_cents: params[:card_withdrawal_fee_cap_usd_cents]
          }.compact

          return {} if fee_params.empty?

          fee_params.transform_values do |value|
            int_value = value.to_i
            raise ArgumentError, 'fee value must be non-negative' if int_value.negative?

            int_value
          end
        rescue ArgumentError => e
          raise ActionController::BadRequest, e.message
        end
      end
    end
  end
end
