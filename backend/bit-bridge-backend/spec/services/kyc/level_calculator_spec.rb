# frozen_string_literal: true

require "rails_helper"

RSpec.describe Kyc::LevelCalculator do
  describe ".resolve_level" do
    it "preserves tier_3 when Tier 3 verification is complete" do
      kyc = instance_double(UserKyc, tier3_status: "verified", tier3_verified_at: nil)
      user = instance_double(User, user_profile: nil, user_kyc: kyc)

      expect(described_class.resolve_level(user)).to eq("tier_3")
    end
  end
end
