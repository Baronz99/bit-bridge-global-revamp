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

  it 'records settlement metadata without debiting usd wallet' do
    event = build_event(amount: 50)
    before_balance = wallet.reload.balance_cents
    result = described_class.call(card: card, card_event: event)

    expect(result[:status]).to eq(:ok)
    expect(event.reload.metadata['ledger_posted']).to eq(true)
    expect(wallet.reload.balance_cents).to eq(before_balance)
    txns = wallet.transactions.where("metadata ->> 'transfer_reference' = ?", event.provider_transaction_reference)
    expect(txns.count).to eq(0)
  end

  it 'does not mark provider-successful event declined when usd wallet is low' do
    wallet.update!(balance_cents: 100)
    event = build_event(amount: 5_000, provider_ref: 'ref_low')

    result = described_class.call(card: card, card_event: event)

    expect(result[:status]).to eq(:ok)
    expect(event.reload.status).to eq('successful')
    expect(event.metadata['ledger_posted']).to eq(true)
    expect(wallet.transactions.where("metadata ->> 'transfer_reference' = ?", 'ref_low')).to be_empty
  end

  it 'is idempotent for the same provider reference' do
    event = build_event(amount: 1_000, provider_ref: 'ref_idem')

    first = described_class.call(card: card, card_event: event)
    second = described_class.call(card: card, card_event: event)

    txns = wallet.transactions.where("metadata ->> 'transfer_reference' = ?", 'ref_idem')
    expect(first[:code]).to eq('posted')
    expect(second[:code]).to eq('already_posted')
    expect(txns.count).to eq(0)
  end
end
