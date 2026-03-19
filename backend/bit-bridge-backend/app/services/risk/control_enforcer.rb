# frozen_string_literal: true

module Risk
  class ControlEnforcer
    BUSINESS_TIMEZONE = 'Africa/Lagos'
    RESTRICTED_ERROR = 'account_restricted'
    RESTRICTED_MESSAGE = 'Account is temporarily restricted pending review.'
    PRECHECK_MESSAGE = 'This account has been placed under review due to configured risk limits.'

    class << self
      def enforce_unrestricted!(controller:, user:, message: RESTRICTED_MESSAGE)
        control = user&.user_risk_control
        return true unless control&.restricted?

        controller.render json: {
          error: RESTRICTED_ERROR,
          message: message
        }, status: :forbidden
        false
      end

      def precheck_inbound_request!(controller:, user:, amount_cents:, source_type:, source_id: nil)
        return true unless enforce_unrestricted!(controller:, user:)

        result = apply_thresholds!(
          user: user,
          amount_cents: amount_cents,
          source_type: source_type,
          source_id: source_id,
          phase: 'precheck'
        )

        return true unless result[:restricted]

        controller.render json: {
          error: 'risk_review_required',
          message: PRECHECK_MESSAGE
        }, status: :forbidden
        false
      end

      def evaluate_inbound_credit!(user:, amount_cents:, source_type:, source_id: nil)
        apply_thresholds!(
          user: user,
          amount_cents: amount_cents,
          source_type: source_type,
          source_id: source_id,
          phase: 'credited'
        )
      end

      private

      def apply_thresholds!(user:, amount_cents:, source_type:, source_id:, phase:)
        control = user&.user_risk_control
        return noop_result unless control&.monitoring_enabled?

        breach = first_breach(user:, control:, amount_cents:)
        return noop_result unless breach

        action = control.auto_lock_enabled? ? 'restricted' : 'monitored'
        reason = "Automatic restriction triggered: #{breach[:trigger_type].tr('_', ' ')}"

        if control.auto_lock_enabled? && !control.restricted?
          control.update!(
            restricted: true,
            restriction_reason: reason
          )
          Risk::ProviderAccountFreeze.freeze_for_user!(user: user, control: control, reason: reason)
        end

        RiskEvent.create!(
          user: user,
          trigger_type: breach[:trigger_type],
          amount_cents: amount_cents.to_i,
          threshold_cents: breach[:threshold_cents],
          action_taken: action,
          source_type: source_type,
          source_id: source_id,
          metadata: {
            phase: phase,
            monitoring_enabled: true,
            auto_lock_enabled: control.auto_lock_enabled
          }
        )

        {
          triggered: true,
          restricted: control.auto_lock_enabled?,
          trigger_type: breach[:trigger_type],
          threshold_cents: breach[:threshold_cents]
        }
      end

      def first_breach(user:, control:, amount_cents:)
        amount_cents = amount_cents.to_i

        if control.single_txn_limit_cents.present? && amount_cents > control.single_txn_limit_cents.to_i
          return { trigger_type: 'single_txn_limit_exceeded', threshold_cents: control.single_txn_limit_cents.to_i }
        end

        if control.daily_limit_cents.present? &&
           (current_inflow_cents(user:, period: :day) + amount_cents) > control.daily_limit_cents.to_i
          return { trigger_type: 'daily_inflow_limit_exceeded', threshold_cents: control.daily_limit_cents.to_i }
        end

        if control.weekly_limit_cents.present? &&
           (current_inflow_cents(user:, period: :week) + amount_cents) > control.weekly_limit_cents.to_i
          return { trigger_type: 'weekly_inflow_limit_exceeded', threshold_cents: control.weekly_limit_cents.to_i }
        end

        nil
      end

      def current_inflow_cents(user:, period:)
        wallet = user&.ngn_wallet
        return 0 unless wallet

        from, to = period_range(period)
        wallet.transactions
              .where(transaction_type: :deposit, status: :approved, coin_type: :bank, created_at: from..to)
              .sum(:amount_cents)
              .to_i
      end

      def period_range(period)
        now = Time.find_zone!(BUSINESS_TIMEZONE).now
        case period
        when :week
          [now.beginning_of_week, now.end_of_week]
        else
          [now.beginning_of_day, now.end_of_day]
        end
      end

      def noop_result
        { triggered: false, restricted: false }
      end
    end
  end
end
