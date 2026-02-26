# frozen_string_literal: true

require "rails_helper"

RSpec.describe Tier3VerificationJob, type: :job do
  let(:user) { create(:user) }

  before do
    user.create_user_profile!(
      first_name: "Test",
      last_name: "User",
      date_of_birth: Date.new(1990, 1, 1)
    )
    user.create_user_kyc!(
      bvn_status: "verified",
      bvn_verified_at: Time.current,
      bvn_encrypted: "12345678901",
      tier3_status: "pending"
    )
  end

  it "marks failed and raises retryable error when provider is temporarily unavailable at liveness" do
    client = instance_double(Kyc::PremblyTier3Biometrics)
    allow(Kyc::PremblyTier3Biometrics).to receive(:new).and_return(client)
    allow(client).to receive(:liveness_check).and_return(
      {
        "status" => false,
        "response_code" => "02",
        "message" => "Service temporarily unavailable",
        "verification" => { "reference" => "liv-ref-1", "status" => "FAILED" }
      }
    )

    expect do
      described_class.new.perform(user.id, "ZmFrZQ==")
    end.to raise_error(Tier3VerificationJob::ProviderTemporarilyUnavailableError)

    kyc = user.user_kyc.reload
    expect(kyc.tier3_status).to eq("failed")
    expect(kyc.tier3_reference).to eq("liv-ref-1")
    expect(kyc.tier3_error).to include("temporarily unavailable")
  end

  it "accepts successful verification status payloads even when top-level status is absent" do
    client = instance_double(Kyc::PremblyTier3Biometrics)
    allow(Kyc::PremblyTier3Biometrics).to receive(:new).and_return(client)
    allow(client).to receive(:liveness_check).and_return(
      {
        "verification" => { "reference" => "liv-ref-2", "status" => "SUCCESSFUL" },
        "data" => { "confidence" => 0.98 }
      }
    )
    allow(client).to receive(:bvn_face_match).and_return(
      {
        "verification" => { "reference" => "match-ref-2", "status" => "VERIFIED" }
      }
    )

    described_class.new.perform(user.id, "ZmFrZQ==")

    kyc = user.user_kyc.reload
    expect(kyc.tier3_status).to eq("verified")
    expect(kyc.tier3_reference).to eq("match-ref-2")
    expect(kyc.tier3_error).to be_nil
  end
end
