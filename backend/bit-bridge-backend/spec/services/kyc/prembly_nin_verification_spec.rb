# frozen_string_literal: true

require "rails_helper"

RSpec.describe Kyc::PremblyNinVerification do
  around do |example|
    original = ENV.to_h
    ENV["ENABLE_PREMBLY"] = "false"
    ENV["PREMBLY_API_KEY"] = "test-key"
    ENV["PREMBLY_APP_ID"] = "test-app"
    example.run
    ENV.replace(original)
  end

  it "does not call Prembly when disabled" do
    expect(described_class).not_to receive(:post)

    result = described_class.new("12345678901").call

    expect(result[:ok]).to be(false)
    expect(result[:error]).to eq("PREMBLY is disabled")
  end

  it "parses vnin-basic nin_data payload keys from provider docs" do
    ENV["ENABLE_PREMBLY"] = "true"
    response = instance_double(
      HTTParty::Response,
      code: 200,
      parsed_response: {
        "status" => true,
        "data" => {
          "reference" => "VER-NIN_BASIC-ABC123",
          "nin_data" => {
            "firstname" => "Cynthia",
            "surname" => "Okafor",
            "birthdate" => "1995-03-17",
            "phoneNumber" => "08012345678",
            "watchListed" => false
          }
        }
      }
    )

    allow(described_class).to receive(:post).and_return(response)

    result = described_class.new("12345678901").call

    expect(result[:ok]).to be(true)
    expect(result[:reference]).to eq("VER-NIN_BASIC-ABC123")
    expect(result[:first_name]).to eq("Cynthia")
    expect(result[:last_name]).to eq("Okafor")
    expect(result[:date_of_birth]).to eq("1995-03-17")
    expect(result[:watchlisted]).to be(false)
  end
end
