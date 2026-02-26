# frozen_string_literal: true

require "rails_helper"

RSpec.describe Kyc::PremblyTier3Biometrics do
  around do |example|
    original = ENV.to_h
    ENV["ENABLE_PREMBLY"] = "true"
    ENV["PREMBLY_API_KEY"] = "test_api_key_123456"
    ENV["PREMBLY_APP_ID"] = "test_app_id"
    example.run
    ENV.replace(original)
  end

  it "sends accept and content-type headers for bvn face match" do
    response = instance_double(HTTParty::Response, code: 200, parsed_response: { "status" => true })

    expect(described_class).to receive(:post).with(
      "/verification/bvn_w_face",
      hash_including(
        headers: hash_including(
          "Accept" => "application/json",
          "Content-Type" => "application/json",
          "x-api-key" => "test_api_key_123456",
          "app-id" => "test_app_id"
        )
      )
    ).and_return(response)

    described_class.new.bvn_face_match("12345678901", "ZmFrZQ==")
  end
end
