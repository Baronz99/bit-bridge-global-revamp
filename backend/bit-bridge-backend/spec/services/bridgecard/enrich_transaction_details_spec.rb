# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Bridgecard::EnrichTransactionDetails do
  let(:user) { create(:user) }
  let(:card) { Card.create!(user: user, card_id: 'card_123') }
  let(:card_event) do
    CardEvent.create!(
      user: user,
      card_id: card.card_id,
      event: 'card_debit_event.successful',
      status: 'successful',
      amount: 12.5,
      currency: 'USD',
      provider_transaction_reference: 'ref_123'
    )
  end

  it 'stores raw payload details and fx fields' do
    service = instance_double(BridgeCardService)
    allow(BridgeCardService).to receive(:new).and_return(service)
    allow(service).to receive(:fetch_card_transaction_by_id).and_return(
      ok: true,
      data: {
        'currency' => 'USD',
        'amount' => '12.50',
        'merchant_currency' => 'EUR',
        'merchant_amount' => '10'
      }
    )

    result = described_class.call(
      card: card,
      provider_transaction_reference: 'ref_123',
      card_event: card_event
    )

    expect(result[:ok]).to eq(true)
    updated = card_event.reload
    expect(updated.merchant_currency).to eq('EUR')
    expect(updated.metadata['raw_payload_details']).to be_a(Hash)
    expect(updated.metadata['enriched_at']).to be_present
  end
end
