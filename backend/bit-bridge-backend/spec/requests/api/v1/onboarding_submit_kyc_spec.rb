# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Onboarding submit_kyc", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers(user) }

  before do
    user.create_user_profile!(
      first_name: "Test",
      last_name: "User",
      phone_number: "08012345678",
      phone_verified_at: Time.current,
      date_of_birth: Date.new(1990, 1, 1)
    )
  end

  it "ignores params[:kyc_level] and computes level from LevelCalculator" do
    post "/api/v1/onboarding/kyc",
         params: {
           id_type: "nin",
           id_number: "12345678901",
           kyc_level: "tier_4"
         },
         headers: headers

    expect(response).to have_http_status(:ok)

    user.reload
    expected = Kyc::LevelCalculator.resolve_level(user)
    expect(user.kyc_level).to eq(expected)
    expect(user.kyc_level).not_to eq("tier_4")
    expect(user.onboarding_stage).to eq("kyc_submitted")
  end
end
