# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'BridgeCardService card fees' do
  let(:user) { create(:user) }
  let(:wallet) { user.usd_wallet }
  let(:card) { user.cards.create!(card_id: 'card_123', status: 'active') }

  around do |example|
    original = ENV.to_h
    ENV['ENABLE_BRIDGE_CARDS'] = 'true'
    example.run
    ENV.replace(original)
  end

  before do
    allow_any_instance_of(BridgeCardService).to receive(:fetch).and_return({ 'data' => {}, 'message' => 'ok' })
    wallet.update!(balance_cents: 20_000)
  end

  it 'applies funding fee with separate fee transaction' do
    FxSetting.current.update!(card_funding_fee_bps: 100, card_funding_fee_cap_usd_cents: 0)

    service = BridgeCardService.new
    response = service.fund_wallet(
      {
        amount: 100,
        currency: 'USD',
        wallet_type: 'usd',
        card_id: card.card_id,
        transaction_reference: 'ref-fund-1'
      },
      user
    )

    expect(response[:status]).to eq(:ok)
    expect(Transaction.find_by(unique_transaction_id: 'ref-fund-1')).to be_present
    expect(Transaction.find_by(unique_transaction_id: 'ref-fund-1:funding_fee')).to be_present
    expect(wallet.reload.balance_cents).to eq(20_000 - 10_100)
  end

  it 'applies withdrawal fee on unload success' do
    FxSetting.current.update!(card_withdrawal_fee_bps: 200, card_withdrawal_fee_cap_usd_cents: 0)

    service = BridgeCardService.new
    response = service.unload_wallet(
      {
        amount: 50,
        currency: 'USD',
        wallet_type: 'usd',
        card_id: card.card_id,
        transaction_reference: 'ref-unload-1'
      },
      user
    )

    expect(response[:status]).to eq(:ok)
    txn = Transaction.find_by(unique_transaction_id: 'ref-unload-1')
    expect(txn).to be_present

    result = Cards::UnloadFeeApplier.call(transaction: txn, amount_cents: 5000)
    expect(result[:status]).to eq(:ok)

    expect(Transaction.find_by(unique_transaction_id: 'ref-unload-1:withdrawal_fee')).to be_present
    expect(wallet.reload.balance_cents).to eq(20_000 + 5_000 - 100)
  end

  it 'rejects unload when fee exceeds amount' do
    FxSetting.current.update!(card_withdrawal_fee_bps: 10_000, card_withdrawal_fee_cap_usd_cents: 0)

    service = BridgeCardService.new
    response = service.unload_wallet(
      {
        amount: 10,
        currency: 'USD',
        wallet_type: 'usd',
        card_id: card.card_id,
        transaction_reference: 'ref-unload-2'
      },
      user
    )

    expect(response[:status]).to eq(:unprocessable_entity)
  end
end
