# frozen_string_literal: true

require "rails_helper"

RSpec.describe Kyc::LevelCalculator do
  let(:user) { create(:user, id_type: "nin") }

  def attach_proof!(profile)
    file = Tempfile.new(["proof", ".txt"])
    file.write("proof")
    file.rewind
    profile.proof_of_address.attach(
      io: file,
      filename: "proof.txt",
      content_type: "text/plain"
    )
  ensure
    if file
      file.close
      file.unlink
    end
  end

  before do
    user.create_user_profile!(
      first_name: "Test",
      last_name: "User",
      phone_number: "08012345678",
      date_of_birth: Date.new(1990, 1, 1)
    )
    user.user_profile.update_column(:phone_verified_at, Time.current)
    user.create_user_kyc!
  end

  it "does not return tier_3 when tier3 is verified but tier2 is incomplete" do
    user.user_kyc.update!(
      tier3_status: "verified",
      tier3_verified_at: Time.current,
      bvn_status: "unverified",
      bvn_verified_at: nil
    )

    expect(described_class.resolve_level(user)).to eq("tier_1")
  end

  it "returns tier_3 when tier2 is complete and tier3 is verified" do
    user.user_kyc.update!(
      bvn_status: "verified",
      bvn_verified_at: Time.current,
      nin_status: "verified",
      nin_verified_at: Time.current,
      tier3_status: "verified",
      tier3_verified_at: Time.current
    )

    expect(described_class.resolve_level(user)).to eq("tier_3")
  end

  it "returns tier_4 when tier3 is complete and proof requirements are complete" do
    profile = user.user_profile
    profile.update!(
      proof_of_address_type: "utility_bill"
    )
    attach_proof!(profile)

    user.user_kyc.update!(
      bvn_status: "verified",
      bvn_verified_at: Time.current,
      nin_status: "verified",
      nin_verified_at: Time.current,
      tier3_status: "verified",
      tier3_verified_at: Time.current
    )

    expect(described_class.resolve_level(user)).to eq("tier_4")
  end
end
