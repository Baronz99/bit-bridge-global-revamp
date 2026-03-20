# frozen_string_literal: true

module Kyc
  class VerificationSnapshotStore
    TTL = 60.days

    class << self
      def find_reusable(document_type:, fingerprint:)
        snapshot = KycVerificationSnapshot.find_by(document_type: document_type, fingerprint: fingerprint)
        return nil unless snapshot&.reusable?

        snapshot
      end

      def write!(document_type:, fingerprint:, result:, status:, provider: "prembly")
        return unless fingerprint.present?
        return unless snapshot_fields_present?(result)

        snapshot = KycVerificationSnapshot.find_or_initialize_by(
          document_type: document_type,
          fingerprint: fingerprint
        )

        snapshot.assign_attributes(
          status: status.to_s,
          provider: provider,
          first_name: normalize_name(result[:first_name]),
          last_name: normalize_name(result[:last_name]),
          date_of_birth: normalize_dob(result[:date_of_birth]),
          watchlisted: to_bool(result[:watchlisted]),
          provider_reference: result[:reference].to_s.presence,
          captured_at: Time.current,
          expires_at: Time.current + TTL,
          metadata: (snapshot.metadata || {}).merge("source" => provider)
        )
        snapshot.save!
        snapshot
      end

      private

      def snapshot_fields_present?(result)
        result[:first_name].present? &&
          result[:last_name].present? &&
          result[:date_of_birth].present?
      end

      def normalize_name(value)
        value.to_s.strip.presence
      end

      def normalize_dob(value)
        parsed = Kyc::BvnMatcher.parse_prembly_dob(value)
        parsed&.iso8601
      rescue StandardError
        nil
      end

      def to_bool(value)
        return true if value == true
        return false if value == false

        value.to_s.downcase == "true"
      end
    end
  end
end
