# frozen_string_literal: true

module Api
  module V1
    module Kyc
      class BvnController < ApplicationController
        before_action :authenticate_user!

        USER_DAILY_LIMIT = 3
        IP_DAILY_LIMIT = 10

        def verify
          unless FeatureFlags.prembly?
            raise StandardError, 'PREMBLY is disabled'
          end

          bvn = params[:bvn].to_s.gsub(/\s+/, '')
          unless bvn.match?(/\A\d{11}\z/)
            return render json: { status: 'error', message: 'BVN must be 11 digits.' }, status: :unprocessable_entity
          end

          user = current_user
          user_kyc = user.user_kyc || user.build_user_kyc

          if user_kyc.verified?
            return render json: response_payload(user, user_kyc, status: 'verified'), status: :ok
          end

          reset_attempt_window!(user_kyc)

          if locked_out?(user_kyc)
            return render json: locked_payload(user_kyc), status: :too_many_requests
          end

          ip_address = request.remote_ip.to_s
          if ip_rate_limited?(ip_address)
            return render json: { status: 'locked', message: 'Too many attempts from this IP. Try again later.' },
                          status: :too_many_requests
          end

          last4 = bvn[-4, 4]
          fingerprint = ::Kyc::BvnFingerprint.generate(bvn)

          user_kyc.assign_attributes(
            bvn_last4: last4,
            bvn_fingerprint: fingerprint,
            bvn_provider: 'prembly',
            bvn_attempts_count: (user_kyc.bvn_attempts_count || 0) + 1,
            bvn_last_attempt_at: Time.current
          )
          user_kyc.save!

          if bvn_in_use?(fingerprint, user.id)
            user_kyc.update!(bvn_status: 'pending_review')
            review = create_review(user, 'bvn_in_use', 'pending')
            log_attempt(user, ip_address, false, 'pending_review')
            log_audit(user, 'verification_attempt', 'pending_review', ip_address, review_id: review&.id)

            return render json: response_payload(user, user_kyc, status: 'pending_review', reason: 'bvn_in_use'),
                          status: :ok
          end

          result = ::Kyc::PremblyBvnVerification.new(bvn).call
          unless result[:ok]
            handle_failed_attempt!(user, user_kyc, ip_address, 'failed', result[:error])
            return render json: { status: 'error', message: 'BVN verification is unavailable. Try again later.' },
                          status: :service_unavailable
          end

          outcome = resolve_match_outcome(user, result)
          apply_outcome!(user, user_kyc, result, outcome)

          if outcome[:status] == 'mismatch'
            handle_failed_attempt!(user, user_kyc, ip_address, 'mismatch', outcome[:reason])
            refresh_tier!(user)
            return render json: response_payload(user, user_kyc, status: user_kyc.bvn_status, reason: outcome[:reason]),
                          status: :ok
          end

          log_attempt(user, ip_address, outcome[:status] == 'verified', outcome[:status])
          log_audit(user, 'verification_attempt', outcome[:status], ip_address, outcome.slice(:reason))

          if outcome[:status] == 'pending_review'
            review = create_review(user, outcome[:reason], 'pending')
            log_audit(user, 'review_created', 'pending_review', ip_address, review_id: review&.id)
          end

          refresh_tier!(user)

          render json: response_payload(user, user_kyc, status: outcome[:status], reason: outcome[:reason]),
                 status: :ok
        end

        private

        def response_payload(user, user_kyc, status:, reason: nil)
          {
            status: status,
            tier: user.kyc_level || 'tier_0',
            bvn_last4: user_kyc.bvn_last4,
            matches: {
              dob: user_kyc.bvn_dob_match,
              first_name: user_kyc.bvn_first_name_match,
              last_name: user_kyc.bvn_last_name_match
            },
            match_score: user_kyc.bvn_match_score,
            prembly_reference: user_kyc.bvn_provider_reference,
            verified_at: user_kyc.bvn_verified_at,
            reason: reason
          }
        end

        def locked_payload(user_kyc)
          {
            status: 'locked',
            bvn_last4: user_kyc.bvn_last4,
            locked_until: user_kyc.bvn_locked_until
          }
        end

        def reset_attempt_window!(user_kyc)
          last = user_kyc.bvn_last_attempt_at
          return unless last && last < 24.hours.ago

          user_kyc.update!(
            bvn_attempts_count: 0,
            bvn_failed_attempts_count: 0,
            bvn_locked_until: nil
          )
        end

        def locked_out?(user_kyc)
          user_kyc.bvn_locked_until.present? && user_kyc.bvn_locked_until > Time.current
        end

        def ip_rate_limited?(ip_address)
          KycAttempt.where(kyc_type: 'bvn', ip_address: ip_address)
                    .where('created_at >= ?', 24.hours.ago)
                    .count >= IP_DAILY_LIMIT
        end

        def bvn_in_use?(fingerprint, current_user_id)
          UserKyc.where.not(user_id: current_user_id)
                 .where(bvn_fingerprint: fingerprint, bvn_status: 'verified')
                 .exists?
        end

        def handle_failed_attempt!(user, user_kyc, ip_address, status, error_message)
          failed = (user_kyc.bvn_failed_attempts_count || 0) + 1
          user_kyc.assign_attributes(
            bvn_status: status,
            bvn_failed_attempts_count: failed
          )

          if failed >= USER_DAILY_LIMIT
            user_kyc.bvn_locked_until = 24.hours.from_now
            user_kyc.bvn_status = 'locked'
          end

          user_kyc.save!
          log_attempt(user, ip_address, false, status)
          log_audit(user, 'verification_attempt', status, ip_address, error: error_message)
        end

        def resolve_match_outcome(user, result)
          profile = user.user_profile
          return { status: 'pending_review', reason: 'profile_incomplete' } unless profile

          dob_match = match_dob(profile.date_of_birth, result[:date_of_birth])
          last_name_match = match_name(profile.last_name, result[:last_name])
          first_name_match = match_first_name(profile.first_name, result[:first_name])

          watchlisted = to_bool(result[:watchlisted])
          incomplete = result[:first_name].blank? || result[:last_name].blank? || result[:date_of_birth].blank?

          if watchlisted
            return { status: 'pending_review', reason: 'watchlisted', dob_match:, last_name_match:, first_name_match: }
          end

          if incomplete
            return { status: 'pending_review', reason: 'provider_incomplete', dob_match:, last_name_match:, first_name_match: }
          end

          if dob_match && last_name_match && first_name_match
            return { status: 'verified', reason: nil, dob_match:, last_name_match:, first_name_match: }
          end

          if dob_match && last_name_match && !first_name_match
            return { status: 'pending_review', reason: 'name_mismatch', dob_match:, last_name_match:, first_name_match: }
          end

          { status: 'mismatch', reason: 'mismatch', dob_match:, last_name_match:, first_name_match: }
        end

        def apply_outcome!(user, user_kyc, result, outcome)
          score =
            [outcome[:dob_match], outcome[:last_name_match], outcome[:first_name_match]]
              .compact
              .map { |flag| flag ? 1 : 0 }
              .sum / 3.0

          user_kyc.assign_attributes(
            bvn_provider_reference: result[:reference],
            bvn_name_match: outcome[:first_name_match] && outcome[:last_name_match],
            bvn_dob_match: outcome[:dob_match],
            bvn_first_name_match: outcome[:first_name_match],
            bvn_last_name_match: outcome[:last_name_match],
            bvn_match_score: score.round(3),
            watchlisted: to_bool(result[:watchlisted])
          )

          case outcome[:status]
          when 'verified'
            user_kyc.bvn_status = 'verified'
            user_kyc.bvn_verified_at = Time.current
            user_kyc.bvn_failed_attempts_count = 0
            user_kyc.bvn_locked_until = nil          when 'pending_review'
            user_kyc.bvn_status = 'pending_review'
          else
            user_kyc.bvn_status = 'mismatch'
          end

          user_kyc.save!
        end

        def refresh_tier!(user)
          user.update!(kyc_level: ::Kyc::LevelCalculator.resolve_level(user))
        end

        def create_review(user, reason, status)
          KycReview.create!(
            user_id: user.id,
            kyc_type: 'bvn',
            status: status,
            reason: reason
          )
        rescue StandardError
          nil
        end

        def log_attempt(user, ip_address, success, status)
          KycAttempt.create!(
            user_id: user.id,
            kyc_type: 'bvn',
            ip_address: ip_address,
            success: success,
            result_status: status
          )
        rescue StandardError
          nil
        end

        def log_audit(user, action, status, ip_address, metadata = {})
          KycAuditLog.create!(
            user_id: user.id,
            action: action,
            status: status,
            ip_address: ip_address,
            metadata: metadata
          )
        rescue StandardError
          nil
        end

        def match_name(profile_value, provider_value)
          normalize_name(profile_value) == normalize_name(provider_value)
        end

        def match_first_name(profile_value, provider_value)
          profile_norm = normalize_name(profile_value)
          provider_norm = normalize_name(provider_value)

          return false if profile_norm.blank? || provider_norm.blank?
          return true if profile_norm == provider_norm

          profile_tokens = profile_norm.split
          provider_tokens = provider_norm.split
          (profile_tokens & provider_tokens).any?
        end

        def normalize_name(value)
          value.to_s.downcase.gsub(/[^a-z\s]/, ' ').split.join(' ')
        end

        def match_dob(profile_dob, provider_dob)
          return false if profile_dob.blank? || provider_dob.blank?

          parsed = parse_prembly_dob(provider_dob)
          return false unless parsed

          profile_date = profile_dob.is_a?(Date) ? profile_dob : Date.parse(profile_dob.to_s)
          profile_date == parsed
        rescue StandardError
          false
        end

        def parse_prembly_dob(value)
          raw = value.to_s.strip
          return nil if raw.blank?

          Date.strptime(raw, '%d-%b-%Y')
        rescue StandardError
          begin
            Date.parse(raw)
          rescue StandardError
            nil
          end
        end

        def to_bool(value)
          return true if value == true
          return false if value == false
          value.to_s.downcase == 'true'
        end
      end
    end
  end
end
