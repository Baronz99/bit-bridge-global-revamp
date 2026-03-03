# frozen_string_literal: true

module Api
  module V1
    module Kyc
      class NinController < ApplicationController
        before_action :authenticate_user!

        ALLOWED_REASONS = %w[
          watchlisted
          provider_incomplete
          profile_incomplete
          name_mismatch
          mismatch
          nin_invalid
          provider_unavailable
        ].freeze

        def verify
          unless FeatureFlags.prembly?
            return render json: { error: "PREMBLY is disabled" }, status: :service_unavailable
          end

          nin = params[:nin].presence || params[:number].presence
          nin = nin.to_s.gsub(/\s+/, "")
          unless nin.match?(/\A\d{11}\z/)
            return render json: { status: "error", reason: "nin_invalid", message: "NIN must be 11 digits." },
                          status: :unprocessable_entity
          end

          user = current_user
          user_kyc = user.user_kyc || user.build_user_kyc

          if user_kyc.nin_verified? && same_verified_nin?(user_kyc, nin)
            refresh_tier!(user)
            return render json: response_payload(
              user,
              user_kyc,
              status: "verified",
              reason: nil,
              message: "NIN already verified for this account."
            ), status: :ok
          end

          result = ::Kyc::PremblyNinVerification.new(nin).call
          unless result[:ok]
            reason = result[:invalid] ? "nin_invalid" : "provider_unavailable"
            update_last_result!(user_kyc, status: "failed", reason: reason)
            http_status = result[:invalid] ? :unprocessable_entity : :service_unavailable
            message = result[:invalid] ? "NIN is invalid. Check and try again." : "NIN verification is currently unavailable."
            return render json: response_payload(user, user_kyc, status: "failed", reason: reason, message: message),
                          status: http_status
          end

          outcome = ::Kyc::NinMatcher.resolve_match_outcome(user.user_profile, result)
          apply_outcome!(user_kyc, nin, result, outcome)
          update_last_result!(user_kyc, status: outcome[:status], reason: outcome[:reason])
          refresh_tier!(user)

          render json: response_payload(user, user_kyc, status: user_kyc.nin_status, reason: outcome[:reason]), status: :ok
        end

        def status
          user = current_user
          user_kyc = user.user_kyc || user.build_user_kyc
          render json: response_payload(user, user_kyc, status: user_kyc.nin_status, reason: user_kyc.nin_last_result_reason),
                 status: :ok
        end

        private

        def response_payload(user, user_kyc, status:, reason:, message: nil)
          normalized_reason = normalize_reason(status: status, reason: reason)
          {
            status: status,
            reason_code: normalized_reason,
            reason: normalized_reason,
            display: customer_display_payload(status: status, reason: normalized_reason),
            message: message,
            tier: user.kyc_level || "tier_0",
            nin_last4: user_kyc.nin_last4,
            prembly_reference: user_kyc.nin_provider_reference,
            verified_at: user_kyc.nin_verified_at,
            last_result_status: user_kyc.nin_last_result_status,
            last_result_reason: user_kyc.nin_last_result_reason,
            last_checked_at: user_kyc.nin_last_checked_at,
            requirements: ::Kyc::RequirementsCalculator.new(user).call
          }.compact
        end

        def normalize_reason(status:, reason:)
          key = reason.to_s.strip
          return nil if key.empty?
          return key if ALLOWED_REASONS.include?(key)

          status_key = status.to_s
          return "mismatch" if status_key == "mismatch"
          return "provider_incomplete" if status_key == "pending_review"
          return "nin_invalid" if status_key == "failed"

          nil
        end

        def update_last_result!(user_kyc, status:, reason:)
          user_kyc.update!(
            nin_last_result_status: status,
            nin_last_result_reason: normalize_reason(status: status, reason: reason),
            nin_last_checked_at: Time.current
          )
        end

        def apply_outcome!(user_kyc, nin, result, outcome)
          score =
            [outcome[:dob_match], outcome[:last_name_match], outcome[:first_name_match]]
              .compact
              .map { |flag| flag ? 1 : 0 }
              .sum / 3.0

          user_kyc.assign_attributes(
            nin_last4: nin[-4, 4],
            nin_provider: "prembly",
            nin_provider_reference: result[:reference],
            nin_name_match: outcome[:first_name_match] && outcome[:last_name_match],
            nin_dob_match: outcome[:dob_match],
            nin_first_name_match: outcome[:first_name_match],
            nin_last_name_match: outcome[:last_name_match],
            nin_match_score: score.round(3)
          )

          case outcome[:status]
          when "verified"
            user_kyc.nin_status = "verified"
            user_kyc.nin_verified_at = Time.current
            user_kyc.nin_encrypted = nin
          when "pending_review"
            user_kyc.nin_status = "pending_review"
            user_kyc.nin_verified_at = nil
            user_kyc.nin_encrypted = nil
          else
            user_kyc.nin_status = "mismatch"
            user_kyc.nin_verified_at = nil
            user_kyc.nin_encrypted = nil
          end

          user_kyc.save!
        end

        def refresh_tier!(user)
          user.update!(kyc_level: ::Kyc::LevelCalculator.resolve_level(user))
        end

        def customer_display_payload(status:, reason:)
          status_key = status.to_s
          reason_key = reason.to_s

          case status_key
          when "verified"
            {
              severity: "success",
              title: "NIN verified",
              message: "Your NIN has been verified successfully.",
              action: "continue_kyc",
              action_label: "Continue verification"
            }
          when "pending_review"
            pending_review_display(reason_key)
          when "mismatch"
            {
              severity: "warning",
              title: "Details do not match",
              message: "Your NIN details do not match your profile records. Update your profile and retry.",
              action: "update_profile",
              action_label: "Update profile"
            }
          when "failed"
            {
              severity: "error",
              title: "Verification unavailable",
              message: "NIN verification is currently unavailable. Please retry shortly.",
              action: "retry",
              action_label: "Try again"
            }
          else
            {
              severity: "info",
              title: "NIN verification required",
              message: "Enter your NIN to continue identity verification.",
              action: "submit_nin",
              action_label: "Verify NIN"
            }
          end
        end

        def pending_review_display(reason_key)
          case reason_key
          when "name_mismatch"
            {
              severity: "warning",
              title: "Name needs review",
              message: "Your name does not fully match your NIN record. Update your profile details and retry.",
              action: "update_profile",
              action_label: "Update profile"
            }
          when "watchlisted"
            {
              severity: "warning",
              title: "Manual review required",
              message: "Your NIN verification requires compliance review. We will notify you when completed.",
              action: "contact_support",
              action_label: "Contact support"
            }
          else
            {
              severity: "info",
              title: "Verification under review",
              message: "Your NIN verification is under review. Please check again shortly.",
              action: "wait_and_recheck",
              action_label: "Check status"
            }
          end
        end

        def same_verified_nin?(user_kyc, nin)
          stored_nin = user_kyc.nin_encrypted.to_s.gsub(/\s+/, "")
          return false if stored_nin.blank?
          return false unless stored_nin.length == nin.length

          ActiveSupport::SecurityUtils.secure_compare(stored_nin, nin)
        end
      end
    end
  end
end
