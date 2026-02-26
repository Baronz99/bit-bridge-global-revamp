# frozen_string_literal: true

module Kyc
  class Tier3StuckSweep
    DEFAULT_CUTOFF = 2.hours
    DEFAULT_LIMIT = 500

    def initialize(now: Time.current, cutoff: DEFAULT_CUTOFF)
      @now = now
      @cutoff = cutoff
    end

    def call(dry_run: false, limit: DEFAULT_LIMIT)
      scope = candidate_scope.limit(limit.to_i.positive? ? limit.to_i : DEFAULT_LIMIT)
      summary = {
        generated_at: now.iso8601,
        cutoff_minutes: (cutoff / 1.minute).to_i,
        dry_run: dry_run,
        candidates: scope.count,
        updated: 0,
        skipped: 0,
        failed_updates: 0
      }

      return summary if dry_run

      scope.each do |kyc|
        begin
          updated = mark_timed_out!(kyc)
          if updated
            summary[:updated] += 1
          else
            summary[:skipped] += 1
          end
        rescue StandardError => e
          summary[:failed_updates] += 1
          Rails.logger.warn("[Tier3StuckSweep] failed user_kyc_id=#{kyc.id} #{e.class}: #{e.message}")
        end
      end

      summary
    end

    private

    attr_reader :now, :cutoff

    def cutoff_time
      now - cutoff
    end

    def candidate_scope
      UserKyc.where(tier3_status: "processing")
             .where("updated_at <= ?", cutoff_time)
             .order(updated_at: :asc)
    end

    def mark_timed_out!(kyc)
      updated = false
      kyc.with_lock do
        return false unless kyc.tier3_status.to_s == "processing"
        return false if kyc.updated_at > cutoff_time

        kyc.update!(
          tier3_status: "failed",
          tier3_error: "Tier 3 verification timed out. Please retry."
        )
        updated = true
      end

      if updated
        KycTier3Event.record!(
          user: kyc.user,
          user_kyc: kyc,
          provider: "prembly",
          stage: "sweeper",
          status: "timed_out",
          message: "Processing state exceeded cutoff"
        )
      end

      updated
    end
  end
end
