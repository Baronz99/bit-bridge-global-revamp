# frozen_string_literal: true

require "rails_helper"

RSpec.describe Kyc::PremblyNinVerification do
  around do |example|
    original = ENV.to_h
    ENV["ENABLE_PREMBLY"] = "false"
    example.run
    ENV.replace(original)
  end

  it "does not call Prembly when disabled" do
    expect(described_class).not_to receive(:post)

    result = described_class.new("12345678901").call

    expect(result[:ok]).to be(false)
    expect(result[:error]).to eq("PREMBLY is disabled")
  end
end

