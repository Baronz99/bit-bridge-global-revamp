# frozen_string_literal: true

require 'rails_helper'

RSpec.describe BridgeCardService do
  around do |example|
    original = ENV.to_h
    ENV['ENABLE_BRIDGE_CARDS'] = 'false'
    example.run
    ENV.replace(original)
  end

  it 'does not hit BridgeCard when disabled' do
    expect(described_class).not_to receive(:get)

    result = described_class.new.card_balance('card_123')

    expect(result[:status]).to eq(:unprocessable_entity)
    expect(result[:message]).to eq('BRIDGE cards are disabled')
  end
end
