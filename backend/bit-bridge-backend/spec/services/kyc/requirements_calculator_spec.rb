# frozen_string_literal: true

require "rails_helper"

RSpec.describe Kyc::RequirementsCalculator do
  let(:user) { create(:user, id_type: "nin", kyc_level: "tier_1") }

  def attach_proof!(profile)
    poa_file = Tempfile.new(["proof", ".txt"])
    poa_file.write("proof")
    poa_file.rewind
    profile.proof_of_address.attach(
      io: poa_file,
      filename: "proof.txt",
      content_type: "text/plain"
    )
  ensure
    if poa_file
      poa_file.close
      poa_file.unlink
    end
  end

  before do
    user.create_user_profile!(
      first_name: "Test",
      last_name: "User",
      phone_number: "08012345678",
      phone_verified_at: Time.current,
      date_of_birth: Date.new(1990, 1, 1),
      address_line1: "1 Main Street",
      city: "Lagos",
      state: "Lagos",
      country: "NG",
      proof_of_address_type: "utility_bill"
    )
    attach_proof!(user.user_profile)
    user.create_user_kyc!(
      bvn_status: "verified",
      bvn_verified_at: Time.current,
      nin_status: "verified",
      nin_verified_at: Time.current
    )
  end

  it "marks tier2_ready true when nin is verified and id_document is absent" do
    result = described_class.new(user).call

    expect(result.dig(:checks, :bvn_verified)).to eq(true)
    expect(result.dig(:checks, :nin_verified)).to eq(true)
    expect(result.dig(:checks, :has_id_document)).to eq(false)
    expect(result.dig(:checks, :has_proof_of_address)).to eq(true)
    expect(result.dig(:checks, :identity_verified)).to eq(true)
    expect(result.dig(:checks, :tier2_ready)).to eq(true)
  end
end

