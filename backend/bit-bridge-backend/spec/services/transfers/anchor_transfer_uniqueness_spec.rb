# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Anchor transfer uniqueness hardening' do
  let(:user) { create(:user, :tier2, :with_pin, :confirmed, email: "anchor-uniq-#{SecureRandom.hex(4)}@example.com") }
  let(:wallet) { user.ngn_wallet }
  let(:transfer_reference) { "uniq-#{SecureRandom.hex(4)}" }
  let(:bank_payload) do
    {
      bank_code: '000',
      bank: 'Test Bank',
      account_number: '1234567890',
      account_name: 'Jane Doe',
      counter_party_id: 'cp_123',
      inter_bank: true,
      source_id: 'src_123',
      source_name: 'BitBridge',
      source_account_number: '0001112223',
      account_id: 'acc_123',
      wallet_id: wallet.id,
      description: 'Test payout'
    }
  end

  before do
    wallet.transactions.create!(
      transaction_type: 'deposit',
      status: 'approved',
      amount: 100_000,
      coin_type: 'bank',
      address: 'Seed balance'
    )
  end

  it 'enforces DB uniqueness for anchor transfer components per wallet' do
    wallet.transactions.create!(
      transaction_type: 'withdrawal',
      status: 'pending',
      amount: 100,
      coin_type: 'bank',
      address: 'Anchor principal',
      unique_transaction_id: "#{transfer_reference}:principal",
      metadata: {
        provider: 'anchor',
        subtype: 'principal',
        transfer_reference: transfer_reference,
        ledger_hold_reserved: true
      }
    )

    expect do
      wallet.transactions.create!(
        transaction_type: 'withdrawal',
        status: 'pending',
        amount: 100,
        coin_type: 'bank',
        address: 'Anchor principal duplicate',
        unique_transaction_id: "#{transfer_reference}:principal",
        metadata: {
          provider: 'anchor',
          subtype: 'principal',
          transfer_reference: transfer_reference,
          ledger_hold_reserved: true
        }
      )
    end.to raise_error(ActiveRecord::RecordNotUnique)
  end

  it 'returns a safe already-processed response when duplicate insert race occurs' do
    wallet.transactions.create!(
      transaction_type: 'withdrawal',
      status: 'pending',
      amount: 500,
      coin_type: 'bank',
      address: 'Anchor principal',
      unique_transaction_id: "#{transfer_reference}:principal",
      metadata: {
        provider: 'anchor',
        subtype: 'principal',
        transfer_reference: transfer_reference,
        ledger_hold_reserved: true
      }
    )
    wallet.transactions.create!(
      transaction_type: 'withdrawal',
      status: 'pending',
      amount: 50,
      coin_type: 'bank',
      address: 'Anchor fee',
      unique_transaction_id: "#{transfer_reference}:fee",
      metadata: {
        provider: 'anchor',
        subtype: 'fee',
        transfer_reference: transfer_reference,
        fee_breakdown: { total_fee: 50.0 },
        ledger_hold_reserved: true
      }
    )

    anchor_service = instance_double(AnchorService)
    allow(AnchorService).to receive(:new).and_return(anchor_service)
    allow(anchor_service).to receive(:initiate_transfer)

    call_count = 0
    allow_any_instance_of(Transfers::AnchorNgnTransferService).to receive(:find_transfer_tx).and_wrap_original do |method, *args|
      call_count += 1
      if call_count <= 2
        nil
      else
        method.call(*args)
      end
    end

    result = Transfers::AnchorNgnTransferService.call(
      user: user,
      sender_wallet: wallet,
      amount_ngn: 500,
      bank_payload: bank_payload,
      narration: 'Transfer',
      transfer_reference: transfer_reference
    )

    expect(result[:status]).to eq(:ok)
    expect(result.dig(:body, :message)).to eq('Transfer already processed')
    expect(result.dig(:body, :transfer_reference)).to eq(transfer_reference)
    expect(anchor_service).not_to have_received(:initiate_transfer)
  end
end
