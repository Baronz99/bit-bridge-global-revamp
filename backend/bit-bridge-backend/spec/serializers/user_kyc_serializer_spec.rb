# frozen_string_literal: true

require "rails_helper"

RSpec.describe UserKycSerializer do
  let(:user) { create(:user) }

  it "returns tier3_status as verified when tier3_verified_at is present" do
    user.create_user_kyc!(
      tier3_status: "pending",
      tier3_verified_at: Time.current
    )

    payload = described_class.new(user.user_kyc).as_json

    expect(payload[:tier3_status]).to eq("verified")
  end
end

