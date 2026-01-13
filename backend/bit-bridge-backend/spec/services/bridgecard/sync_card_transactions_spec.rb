# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Bridgecard::SyncCardTransactions do
  let(:user) { create(:user) }
  let(:card) { Card.create!(user: user, card_id: 'card_123') }

  it 'tracks created vs updated counts' do
    payload = {
      'bridgecard_transaction_reference' => 'ref_1',
      'card_transaction_type' => 'DEBIT',
      'status' => 'successful',
      'amount' => '10.00',
      'currency' => 'USD',
      'billing_currency' => 'EUR',
      'billing_amount' => '9.50',
      'exchange_rate' => '1.05'
    }

    service = instance_double(BridgeCardService)
    allow(BridgeCardService).to receive(:new).and_return(service)
    allow(service).to receive(:get_card_transactions).and_return(status: :ok, data: [payload])

    first = described_class.call(card: card, page_limit: 1, page_size: 20)
    second = described_class.call(card: card, page_limit: 1, page_size: 20)

    expect(first[:created_count]).to eq(1)
    expect(first[:updated_count]).to eq(0)
    expect(second[:created_count]).to eq(0)
    expect(second[:updated_count]).to eq(1)

    event = CardEvent.last
    expect(event.billing_currency).to eq('EUR')
    expect(event.billing_amount.to_s('F')).to eq('9.5')
    expect(event.metadata['billing_currency']).to eq('EUR')
    expect(event.metadata['billing_amount']).to eq('9.5')
    expect(event.metadata['exchange_rate']).to eq('1.05')
    expect(event.metadata['is_foreign']).to eq(false)
  end

  it 'limits enrichment attempts to five' do
    payloads =
      (1..6).map do |index|
        {
          'bridgecard_transaction_reference' => "ref_#{index}",
          'card_transaction_type' => 'DEBIT',
          'status' => 'successful',
          'amount' => '10.00',
          'currency' => 'USD'
        }
      end

    service = instance_double(BridgeCardService)
    allow(BridgeCardService).to receive(:new).and_return(service)
    allow(service).to receive(:get_card_transactions).and_return(status: :ok, data: payloads)

    allow(Bridgecard::EnrichTransactionDetails).to receive(:call).and_return(
      ok: true,
      data: { enriched: false }
    )

    result = described_class.call(card: card, page_limit: 1, page_size: 20)

    expect(Bridgecard::EnrichTransactionDetails).to have_received(:call).exactly(5).times
    expect(result[:enriched_count]).to eq(0)
  end
end
