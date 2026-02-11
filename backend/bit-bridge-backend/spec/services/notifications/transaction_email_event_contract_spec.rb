# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Notifications::TransactionEmailEventContract do
  let(:user) { create(:user, email: "contract-#{SecureRandom.hex(4)}@example.com") }
  let(:wallet) { user.ngn_wallet }

  it 'classifies anchor inbound transfer using provider payment id' do
    tx = wallet.transactions.create!(
      transaction_type: :deposit,
      status: :approved,
      amount: 1000,
      coin_type: :bank,
      address: 'Inbound',
      metadata: {
        provider: 'anchor',
        anchor_payment_id: 'pid_1',
        anchor_payment_reference: 'pref_1'
      }
    )

    contract = described_class.build(
      transaction: tx,
      anchor_details: { payment_id: 'pid_1', payment_reference: 'pref_1', sender_name: 'John' },
      fx_quote: nil
    )

    expect(contract[:schema_version]).to eq('v1')
    expect(contract[:event_family]).to eq('inbound_transfer')
    expect(contract[:event_phase]).to eq('settled')
    expect(contract[:direction]).to eq('credit')
    expect(contract[:provider]).to eq('anchor')
    expect(contract[:provider_event_id]).to eq('pid_1')
    expect(contract[:provider_reference]).to eq('pref_1')
  end

  it 'classifies checkout wallet funding' do
    tx = wallet.transactions.create!(
      transaction_type: :deposit,
      status: :approved,
      amount: 1500,
      coin_type: :bank,
      address: 'Checkout funding'
    )
    tx.create_transaction_record!(
      reference: 'fbg-100',
      status: 'approved',
      event_type: 'checkout.init'
    )

    contract = described_class.build(transaction: tx, anchor_details: {}, fx_quote: nil)
    expect(contract[:event_family]).to eq('wallet_funding')
    expect(contract[:provider]).to eq('checkout')
  end
end
