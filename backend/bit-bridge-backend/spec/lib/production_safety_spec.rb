# frozen_string_literal: true

require 'rails_helper'

RSpec.describe ProductionSafety do
  before do
    allow(Rails.env).to receive(:production?).and_return(true)
  end

  after do
    %w[
      ALLOW_ANCHOR_UNSIGNED_WEBHOOKS
      ENABLE_ADMIN_CARD_DEBUG
      BRIDGE_CARDS_SANDBOX
      JWT_SECRET
      AUTH_REFRESH_TOKEN_HMAC_SECRET
      BVN_HMAC_SECRET
      KYC_FINGERPRINT_PEPPER
      ANCHOR_API_KEY
      ANCHOR_BASE_URL
      ANCHOR_WEBHOOK_SECRET
      ENABLE_BRIDGE_CARDS
      BRIDGECARD_LIVE_TOKEN
      BRIDGECARD_LIVE_SECRET
      BRIDGECARD_LIVE_WEBHOOK_SECRET
      MONNIFY_API_KEY
      MONNIFY_SECRET_KEY
      MONNIFY_CONTRACT_CODE
      MONNIFY_BASE_URL
    ].each { |key| ENV.delete(key) }
  end

  it 'raises when forbidden flag is truthy' do
    ENV['ALLOW_ANCHOR_UNSIGNED_WEBHOOKS'] = 'true'
    expect { described_class.ensure! }.to raise_error(/Forbidden production flags/)
  end

  it 'raises when wildcard sandbox/debug key truthy' do
    ENV['CUSTOM_SANDBOX'] = 'yes'
    expect { described_class.ensure! }.to raise_error(/Sandbox\/debug flags/)
    ENV.delete('CUSTOM_SANDBOX')
  end

  it 'raises when critical secrets missing' do
    expect { described_class.ensure! }.to raise_error(/Missing critical secrets/)
  end

  it 'requires anchor webhook secret when anchor enabled' do
    ENV['ANCHOR_API_KEY'] = 'key'
    ENV['ANCHOR_BASE_URL'] = 'https://api.anchor.test'
    ENV['JWT_SECRET'] = 'jwt'
    ENV['AUTH_REFRESH_TOKEN_HMAC_SECRET'] = 'refresh'
    ENV['BVN_HMAC_SECRET'] = 'bvn'
    ENV['KYC_FINGERPRINT_PEPPER'] = 'pepper'
    ENV['MONNIFY_API_KEY'] = 'a'
    ENV['MONNIFY_SECRET_KEY'] = 'b'
    ENV['MONNIFY_CONTRACT_CODE'] = 'c'
    ENV['MONNIFY_BASE_URL'] = 'https://monnify'
    ENV['ENABLE_BRIDGE_CARDS'] = 'false'

    expect { described_class.ensure! }.to raise_error(/ANCHOR_WEBHOOK_SECRET/)
  end

  it 'requires bridge card secrets when enabled' do
    ENV['ENABLE_BRIDGE_CARDS'] = 'true'
    ENV['MONNIFY_API_KEY'] = 'a'
    ENV['MONNIFY_SECRET_KEY'] = 'b'
    ENV['MONNIFY_CONTRACT_CODE'] = 'c'
    ENV['MONNIFY_BASE_URL'] = 'https://monnify'
    ENV['JWT_SECRET'] = 'jwt'
    ENV['AUTH_REFRESH_TOKEN_HMAC_SECRET'] = 'refresh'
    ENV['BVN_HMAC_SECRET'] = 'bvn'
    ENV['KYC_FINGERPRINT_PEPPER'] = 'pepper'
    expect { described_class.ensure! }.to raise_error(/Bridge card keys/)
  end

  it 'passes when all requirements met and dangerous flags off' do
    ENV['JWT_SECRET'] = 'jwt'
    ENV['AUTH_REFRESH_TOKEN_HMAC_SECRET'] = 'refresh'
    ENV['BVN_HMAC_SECRET'] = 'bvn'
    ENV['KYC_FINGERPRINT_PEPPER'] = 'pepper'
    ENV['MONNIFY_API_KEY'] = 'a'
    ENV['MONNIFY_SECRET_KEY'] = 'b'
    ENV['MONNIFY_CONTRACT_CODE'] = 'c'
    ENV['MONNIFY_BASE_URL'] = 'https://monnify'
    ENV['ENABLE_BRIDGE_CARDS'] = 'false'
    expect { described_class.ensure! }.not_to raise_error
  end
end
