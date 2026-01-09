# app/serializers/user_kyc_serializer.rb
# frozen_string_literal: true

class UserKycSerializer < ActiveModel::Serializer
  attributes :bvn_status,
             :bvn_last4,
             :bvn_provider,
             :bvn_provider_reference,
             :bvn_verified_at,
             :bvn_name_match,
             :bvn_dob_match,
             :bvn_first_name_match,
             :bvn_last_name_match,
             :bvn_match_score,
             :watchlisted,
             :bvn_attempts_count,
             :bvn_failed_attempts_count,
             :bvn_locked_until,
             :tier3_status,
             :tier3_reference,
             :tier3_verified_at,
             :tier3_error
end
