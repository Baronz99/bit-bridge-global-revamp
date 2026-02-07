# frozen_string_literal: true

module Ops
  class CloseStaleElectricityOrders
    attr_reader :updated, :skipped, :candidates, :dry_run, :cutoff_time, :include_timedout

    def initialize(cutoff_time:, dry_run: true, include_timedout: true, limit: nil)
      @cutoff_time = cutoff_time
      @dry_run = dry_run
      @include_timedout = include_timedout
      @limit = limit&.to_i
      @updated = 0
      @skipped = 0
      @candidates = 0
    end

    def run
      base_scope.find_each do |order|
        @candidates += 1
        close_reference = "repair/close-stale-electricity/#{order.id}"

        order.with_lock do
          order.reload
          next skip! unless eligible?(order)

          reason = failure_reason_for(order)
          payload = provider_payload(order.provider_response)
          payload['repair'] = true
          payload['repair_reference'] = close_reference
          payload['repair_at'] = Time.current.utc.iso8601
          payload['repair_actor'] = 'ops_close_stale_electricity'
          payload['previous_status'] = order.status
          payload['previous_reason'] = order.reason

          if dry_run
            @updated += 1
            next
          end

          close_order!(order, reason: reason, payload: payload)
          @updated += 1
        end
      end

      self
    end

    def summary
      {
        updated: updated,
        skipped: skipped,
        candidates: candidates,
        dry_run: dry_run,
        cutoff_time: cutoff_time.iso8601
      }
    end

    private

    def base_scope
      statuses = %w[initialized pending processing]
      statuses << 'timedout' if include_timedout

      scope = BillOrder.where(service_type: 'ELECTRICITY', status: statuses)
                       .where('updated_at <= ?', cutoff_time)
      scope = scope.limit(@limit) if @limit.present? && @limit.positive?
      scope
    end

    def eligible?(order)
      return false if order.status.to_s == 'completed'
      return false if order.token.to_s.strip.present?

      include_timedout || order.status.to_s != 'timedout'
    end

    def close_order!(order, reason:, payload:)
      if order.payment_method.to_s == 'wallet' && %w[processing pending].include?(order.status.to_s)
        service = BuyPowerPaymentService.new
        service.send(
          :handle_wallet_failure,
          order,
          'wallet',
          reason,
          payload,
          status: 'failed'
        )
        return
      end

      if order.status.to_s == 'timedout'
        order.update_columns(
          status: BillOrder.statuses[:failed],
          reason: reason,
          provider_response: payload,
          updated_at: Time.current
        )
      else
        order.update!(
          status: 'failed',
          reason: reason,
          provider_response: payload
        )
      end
    end

    def failure_reason_for(order)
      message = extract_message(order).to_s.strip
      return message if message.present? && known_failure_message?(message)

      if order.payment_method.blank? || order.status.to_s == 'initialized'
        'Transaction expired: initiated but payment was not completed.'
      elsif order.provider_reference.blank?
        'Transaction failed: provider reference was not generated before timeout.'
      else
        'Transaction failed: provider confirmation timed out. Please retry.'
      end
    end

    def extract_message(order)
      payload = provider_payload(order.provider_response)
      order.reason.presence ||
        payload.dig('result', 'data', 'message').presence ||
        payload.dig('data', 'message').presence ||
        payload.dig('result', 'message').presence ||
        payload['message'].presence
    end

    def known_failure_message?(message)
      text = message.downcase
      text.include?('insufficient') ||
        text.include?('minimum vend') ||
        text.include?('below the minimum vend amount') ||
        text.include?('timed out') ||
        text.include?('timeout') ||
        text.include?('failed') ||
        text.include?('invalid')
    end

    def provider_payload(raw)
      return raw.deep_dup if raw.is_a?(Hash)
      return {} if raw.blank?

      JSON.parse(raw) rescue {}
    end

    def skip!
      @skipped += 1
      nil
    end
  end
end
