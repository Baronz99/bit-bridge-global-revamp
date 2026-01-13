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

  it 'uses sandbox mock debit endpoint' do
    service = described_class.new
    expect(service).to receive(:fetch).with(
      'patch',
      '/issuing/sandbox/cards/mock_debit_transaction',
      { card_id: 'card_123' }.to_json
    ).and_return({ 'data' => { 'transaction_reference' => 'ref_123' } })

    result = service.mock_debit_transaction(card_id: 'card_123')
    expect(result[:status]).to eq(:ok)
    expect(result.dig(:data, :transaction_reference)).to eq('ref_123')
  end
end
