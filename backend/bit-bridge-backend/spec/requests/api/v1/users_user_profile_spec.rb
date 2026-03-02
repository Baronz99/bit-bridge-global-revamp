# frozen_string_literal: true

require "rails_helper"
require "securerandom"

RSpec.describe "Users profile", type: :request do
  it "includes admin flags for admin users" do
    user = create(:user, :confirmed, role: "admin", email: "admin_#{SecureRandom.hex(6)}@example.com")
    token, = Warden::JWTAuth::UserEncoder.new.call(user, :user, nil)

    get "/api/v1/users/user_profile", headers: { "Authorization" => "Bearer #{token}" }

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body.dig("data", "admin")).to eq(true)
    expect(body.dig("data", "admin_role")).to be_present
  end

  it "includes kyc requirements for profile guidance" do
    user = create(:user, :confirmed, email: "profile_#{SecureRandom.hex(6)}@example.com")
    token, = Warden::JWTAuth::UserEncoder.new.call(user, :user, nil)

    get "/api/v1/users/user_profile", headers: { "Authorization" => "Bearer #{token}" }

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body.dig("data", "kyc_requirements")).to be_present
    expect(body.dig("data", "kyc_requirements", "missing")).to be_an(Array)
  end

  it "returns tier3_status as verified when tier3_verified_at is present" do
    user = create(:user, :confirmed, email: "tier3_#{SecureRandom.hex(6)}@example.com")
    user.create_user_kyc!(tier3_status: "pending", tier3_verified_at: Time.current)
    token, = Warden::JWTAuth::UserEncoder.new.call(user, :user, nil)

    get "/api/v1/users/user_profile", headers: { "Authorization" => "Bearer #{token}" }

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body.dig("data", "user_kyc", "tier3_status")).to eq("verified")
  end
end
