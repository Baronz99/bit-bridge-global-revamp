# frozen_string_literal: true

require 'rails_helper'

RSpec.describe BridgeCardService do
  it 'parses provider details from response data' do
    allow(FeatureFlags).to receive(:bridge_cards?).and_return(true)
    allow(Bridgecard::Config).to receive(:api_token).and_return('token')
    allow(Bridgecard::Config).to receive(:env_name).and_return('sandbox')
    allow(Bridgecard::Config).to receive(:live?).and_return(false)

    response = instance_double(HTTParty::Response, code: 200, parsed_response: {
      'data' => { 'status' => 'active', 'card_id' => 'card_123' }
    })
    allow(described_class).to receive(:get).and_return(response)

    result = described_class.new.fetch_card_details(card_id: 'card_123')

    expect(result[:ok]).to eq(true)
    expect(result[:data][:provider_status]).to eq('active')
    expect(result[:data][:provider_card_id]).to eq('card_123')
  end

  it 'returns error payload on 401' do
    allow(FeatureFlags).to receive(:bridge_cards?).and_return(true)
    allow(Bridgecard::Config).to receive(:api_token).and_return('token')
    allow(Bridgecard::Config).to receive(:env_name).and_return('sandbox')
    allow(Bridgecard::Config).to receive(:live?).and_return(false)

    response = instance_double(HTTParty::Response, code: 401, parsed_response: { 'message' => 'Unauthorized' })
    allow(described_class).to receive(:get).and_return(response)

    result = described_class.new.fetch_card_details(card_id: 'card_123')

    expect(result[:ok]).to eq(false)
    expect(result.dig(:error, :status)).to eq(401)
    expect(result.dig(:error, :snippet)).to be_present
  end
end
