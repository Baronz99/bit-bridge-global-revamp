# frozen_string_literal: true

require "rails_helper"

RSpec.describe Config::Bills do
  def with_env(values)
    original = {}
    values.each do |key, value|
      original[key] = ENV.key?(key) ? ENV[key] : :__missing__
      if value.nil?
        ENV.delete(key)
      else
        ENV[key] = value
      end
    end
    yield
  ensure
    original.each do |key, value|
      if value == :__missing__
        ENV.delete(key)
      else
        ENV[key] = value
      end
    end
  end

  it "defaults base_url to idev in non-production when BUYPOWER_BASE_URL is missing" do
    allow(Rails.env).to receive(:production?).and_return(false)

    with_env("BUYPOWER_BASE_URL" => nil, "BUYPOWER_TOKEN" => "test-token") do
      expect(described_class.base_url).to eq("https://idev.buypower.ng/v2")
    end
  end

  it "raises when BUYPOWER_TOKEN is missing" do
    allow(Rails.env).to receive(:production?).and_return(false)

    with_env("BUYPOWER_TOKEN" => nil) do
      expect { described_class.token }.to raise_error(RuntimeError, /BUYPOWER_TOKEN/)
    end
  end

  it "raises in production when BUYPOWER_BASE_URL is missing" do
    allow(Rails.env).to receive(:production?).and_return(true)

    with_env("BUYPOWER_BASE_URL" => nil, "BUYPOWER_TOKEN" => "test-token") do
      expect { described_class.base_url }.to raise_error(RuntimeError, /BUYPOWER_BASE_URL/)
    end
  end

  it "raises when confirmation mode is invalid" do
    allow(Rails.env).to receive(:production?).and_return(false)

    with_env(
      "BILLS_CONFIRMATION_MODE" => "invalid",
      "BUYPOWER_BASE_URL" => "https://idev.buypower.ng/v2",
      "BUYPOWER_TOKEN" => "test-token"
    ) do
      expect { described_class.confirmation_mode }.to raise_error(RuntimeError, /BILLS_CONFIRMATION_MODE/)
    end
  end
end
