# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Cards::Ledger::PostCardSettlement do
  let(:user) { create(:user) }
  let!(:wallet) { Wallet.create!(user: user, wallet_type: 'usd', currency: 'USD', balance_cents: 20_000) }
  let(:card) { Card.create!(user: user, card_id: 'card_123') }

  def build_event(amount:, currency: 'USD', status: 'successful', provider_ref: 'ref_1')
    CardEvent.create!(
      event: 'card_debit_event.successful',
      status: status,
      event_name: 'card_debit_event',
      event_status: status,
      card_id: card.card_id,
      provider_transaction_reference: provider_ref,
      currency: currency,
      amount: amount,
      raw_payload: {
        'currency' => currency,
        'amount' => amount,
        'bridgecard_transaction_reference' => provider_ref
      },
      user_id: user.id
    )
  end

  it 'posts ledger debits when balance covers total' do
    event = build_event(amount: 50)
    result = described_class.call(card: card, card_event: event)

    expect(result[:status]).to eq(:ok)
    txns = wallet.transactions.where("metadata ->> 'transfer_reference' = ?", event.provider_transaction_reference)
    expect(txns.count).to eq(3)
  end

  it 'does not debit when balance is insufficient and records decline' do
    wallet.update!(balance_cents: 100)
    event = build_event(amount: 50, provider_ref: 'ref_low')

    result = described_class.call(card: card, card_event: event)

    expect(result[:status]).to eq(:error)
    expect(event.reload.status).to eq('declined')
    expect(wallet.transactions.where("metadata ->> 'transfer_reference' = ?", 'ref_low')).to be_empty
  end

  it 'is idempotent for the same provider reference' do
    event = build_event(amount: 10, provider_ref: 'ref_idem')

    described_class.call(card: card, card_event: event)
    described_class.call(card: card, card_event: event)

    txns = wallet.transactions.where("metadata ->> 'transfer_reference' = ?", 'ref_idem')
    expect(txns.count).to eq(3)
  end

  it 'freezes card after three declines' do
    stub_service = instance_double(BridgeCardService)
    allow(BridgeCardService).to receive(:new).and_return(stub_service)
    allow(stub_service).to receive(:freeze_card).and_return(status: :ok, data: {})

    wallet.update!(balance_cents: 100)
    card.update!(decline_count: 2)
    event = build_event(amount: 50, provider_ref: 'ref_freeze')

    described_class.call(card: card, card_event: event)

    expect(card.reload.status).to eq('frozen')
    expect(card.frozen_by).to eq('system')
  end
end
