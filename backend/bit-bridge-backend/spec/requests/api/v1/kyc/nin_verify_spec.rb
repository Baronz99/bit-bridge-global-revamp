# frozen_string_literal: true

require "rails_helper"

RSpec.describe "NIN verification", type: :request do
  let(:user) { create(:user) }
  let(:headers) { auth_headers(user) }
  let(:nin) { "12345678901" }

  around do |example|
    old = ENV["ENABLE_PREMBLY"]
    ENV["ENABLE_PREMBLY"] = "true"
    example.run
  ensure
    if old.nil?
      ENV.delete("ENABLE_PREMBLY")
    else
      ENV["ENABLE_PREMBLY"] = old
    end
  end

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
      bvn_verified_at: Time.current
    )
    user.update!(id_type: "nin", kyc_level: "tier_1")
  end

  it "upgrades tier when NIN is verified and proof of address exists without id_document" do
    result = {
      ok: true,
      reference: "prembly-nin-ref",
      first_name: "Test",
      last_name: "User",
      date_of_birth: "01-Jan-1990",
      watchlisted: false
    }
    allow(Kyc::PremblyNinVerification).to receive(:new).with(nin).and_return(double(call: result))

    post "/api/v1/kyc/nin/verify", params: { nin: nin }, headers: headers

    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    expect(json["status"]).to eq("verified")
    expect(json["tier"]).to eq("tier_2")

    user.reload
    user.user_kyc.reload
    expect(user.kyc_level).to eq("tier_2")
    expect(user.user_kyc.nin_status).to eq("verified")
    expect(user.user_kyc.nin_verified_at).to be_present
    expect(user.user_profile.id_document).not_to be_attached
    expect(user.user_profile.proof_of_address).to be_attached
  end

  it "returns 422 for invalid nin format" do
    post "/api/v1/kyc/nin/verify", params: { nin: "1234" }, headers: headers

    expect(response).to have_http_status(:unprocessable_entity)
    json = JSON.parse(response.body)
    expect(json["reason"]).to eq("nin_invalid")
  end
end

