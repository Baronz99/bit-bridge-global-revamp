# frozen_string_literal: true

require "rails_helper"

RSpec.describe "NIN verification", type: :request do
  let(:user) { create(:user, :confirmed) }
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
    poa_file = Tempfile.new(["proof", ".png"])
    poa_file.binmode
    poa_file.write("\x89PNG\r\n\x1A\n")
    poa_file.rewind
    profile.proof_of_address.attach(
      io: poa_file,
      filename: "proof.png",
      content_type: "image/png"
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
    expect(json["tier"]).to be_present
    expect(json["reason_code"]).to be_nil
    expect(json.dig("display", "title")).to eq("NIN verified")
    expect(json.dig("display", "severity")).to eq("success")

    user.reload
    user.user_kyc.reload
    expect(user.kyc_level).to be_present
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

  it "does not call provider when same NIN is already verified" do
    user.user_kyc.update!(
      nin_status: "verified",
      nin_verified_at: Time.current,
      nin_encrypted: nin,
      nin_last4: nin[-4, 4],
      nin_provider_reference: "existing-nin-ref"
    )

    expect(Kyc::PremblyNinVerification).not_to receive(:new)

    post "/api/v1/kyc/nin/verify", params: { nin: nin }, headers: headers

    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    expect(json["status"]).to eq("verified")
    expect(json["message"]).to eq("NIN already verified for this account.")
    expect(json["prembly_reference"]).to eq("existing-nin-ref")
    expect(json.dig("display", "title")).to eq("NIN verified")
  end

  it "reuses recent mismatch result for same NIN without profile changes" do
    user.user_kyc.update!(
      nin_status: "mismatch",
      nin_encrypted: nin,
      nin_last_result_reason: "mismatch",
      nin_last_checked_at: Time.current,
      nin_provider_reference: "existing-mismatch-ref",
      nin_first_name_match: false,
      nin_last_name_match: false,
      nin_dob_match: true
    )

    expect(Kyc::PremblyNinVerification).not_to receive(:new)

    post "/api/v1/kyc/nin/verify", params: { nin: nin }, headers: headers

    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    expect(json["status"]).to eq("mismatch")
    expect(json["message"]).to include("recently checked")
    expect(json["prembly_reference"]).to eq("existing-mismatch-ref")
    expect(json.dig("display", "action")).to eq("update_profile")
  end

  it "calls provider again when profile changed after last NIN check" do
    user.user_kyc.update!(
      nin_status: "mismatch",
      nin_encrypted: nin,
      nin_last_result_reason: "mismatch",
      nin_last_checked_at: 2.hours.ago
    )
    user.user_profile.update!(last_name: "Changed")

    result = {
      ok: true,
      reference: "prembly-nin-ref-new",
      first_name: "Test",
      last_name: "Changed",
      date_of_birth: "01-Jan-1990",
      watchlisted: false
    }
    allow(Kyc::PremblyNinVerification).to receive(:new).with(nin).and_return(double(call: result))

    post "/api/v1/kyc/nin/verify", params: { nin: nin }, headers: headers

    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    expect(json["status"]).to eq("verified")
    expect(json["prembly_reference"]).to eq("prembly-nin-ref-new")
  end

  it "does not call provider when same NIN verification is already pending" do
    user.user_kyc.update!(
      nin_status: "pending",
      nin_encrypted: nin,
      nin_last4: nin[-4, 4],
      nin_last_result_status: "pending",
      nin_last_checked_at: Time.current
    )

    expect(Kyc::PremblyNinVerification).not_to receive(:new)

    post "/api/v1/kyc/nin/verify", params: { nin: nin }, headers: headers

    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    expect(json["status"]).to eq("pending")
    expect(json["reason"]).to eq("provider_incomplete")
    expect(json["message"]).to include("already in progress")
  end

  it "returns customer-facing display for mismatch" do
    result = {
      ok: true,
      reference: "prembly-nin-ref",
      first_name: "Other",
      last_name: "Person",
      date_of_birth: "01-Jan-1980",
      watchlisted: false
    }
    allow(Kyc::PremblyNinVerification).to receive(:new).with(nin).and_return(double(call: result))

    post "/api/v1/kyc/nin/verify", params: { nin: nin }, headers: headers

    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    expect(json["status"]).to eq("mismatch")
    expect(json["reason"]).to eq("mismatch")
    expect(json["reason_code"]).to eq("mismatch")
    expect(json.dig("display", "title")).to eq("Details do not match")
    expect(json.dig("display", "action")).to eq("update_profile")
    expect(json.dig("display", "message")).to include("first name, last name, and date of birth")
    expect(json["mismatch_fields"]).to match_array(["first name", "last name", "date of birth"])
    expect(json.dig("nin_match", "first_name")).to eq(false)
    expect(json.dig("nin_match", "last_name")).to eq(false)
    expect(json.dig("nin_match", "date_of_birth")).to eq(false)
  end

  it "adds swapped-name hint when only names mismatch" do
    result = {
      ok: true,
      reference: "prembly-nin-ref",
      first_name: "Other",
      last_name: "Person",
      date_of_birth: "01-Jan-1990",
      watchlisted: false
    }
    allow(Kyc::PremblyNinVerification).to receive(:new).with(nin).and_return(double(call: result))

    post "/api/v1/kyc/nin/verify", params: { nin: nin }, headers: headers

    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    expect(json["status"]).to eq("mismatch")
    expect(json["mismatch_fields"]).to match_array(["first name", "last name"])
    expect(json.dig("display", "message")).to include("may be swapped")
  end
end
