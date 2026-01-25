# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transfers::AnchorNgnTransferService do
  let(:user) { create(:user, :tier2, :with_pin) }
  let(:wallet) { user.ngn_wallet }
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
      amount: 50_000,
      coin_type: 'bank',
      address: 'Seed balance'
    )
  end

  it 'rejects amounts below the minimum' do
    result = described_class.call(
      user: user,
      sender_wallet: wallet,
      amount_ngn: 100,
      bank_payload: bank_payload,
      narration: 'Transfer'
    )

    expect(result[:status]).to eq(:unprocessable_entity)
    expect(result[:body]).to include(message: 'Minimum transfer amount is 150.', min_amount: 150)
  end

  it 'returns insufficient funds details when balance cannot cover total debit' do
    result = described_class.call(
      user: user,
      sender_wallet: wallet,
      amount_ngn: 100_000,
      bank_payload: bank_payload,
      narration: 'Transfer'
    )

    expect(result[:status]).to eq(:unprocessable_entity)
    expect(result[:body][:message]).to include('Insufficient balance.')
    expect(result[:body][:required_total]).to be > result[:body][:available_balance]
    expect(result[:body][:fee_breakdown]).to include('total_fee')
    expect(result[:body][:amount]).to be_a(Integer)
    expect(result[:body][:fee]).to be_a(Float)
    expect(result[:body][:message]).to include('100,000')
    expect(result[:body][:message]).to match(/\d{1,3}(,\d{3})*\.\d{2}/)
  end

  it 'considers ledger holds when deciding available funds' do
    held_order = BillOrder.create!(
      user: user,
      meter_number: '08000000000',
      meter_type: 'PREPAID',
      address: 'Hold Address',
      name: 'Hold User',
      tariff_class: 'A',
      service_type: 'VTU',
      email: user.email,
      amount: 1_000,
      phone: '08000000000',
      biller: 'MTN',
      description: 'Hold',
      payment_type: 'online',
      payment_method: 'wallet',
      status: 'processing'
    )
    WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: held_order, amount: 49_000)

    result = described_class.call(
      user: user,
      sender_wallet: wallet,
      amount_ngn: 5_000,
      bank_payload: bank_payload,
      narration: 'Transfer'
    )

    expect(result[:status]).to eq(:unprocessable_entity)
    expect(result[:body][:available_balance]).to eq(wallet.ledger_available_balance.to_f)
    expect(result[:body][:message]).to include('Insufficient balance.')
    expect(result[:body][:required_total]).to be > result[:body][:available_balance]
  end

  it 'creates fee and principal debits then approves them on Anchor success' do
    anchor_service = instance_double(AnchorService)
    allow(AnchorService).to receive(:new).and_return(anchor_service)
    allow(anchor_service).to receive(:initiate_transfer).and_return(
      status: :ok,
      data: { transfer_id: 'tr_123', status: 'pending' }
    )
    transfer_reference = 'ref-success-1'

    result = described_class.call(
      user: user,
      sender_wallet: wallet,
      amount_ngn: 10_000,
      bank_payload: bank_payload,
      narration: 'Transfer',
      transfer_reference: transfer_reference
    )

    expect(result[:status]).to eq(:ok)
    expect(result[:body][:fee_breakdown]).to include('total_fee')

    principal = wallet.transactions.where("metadata ->> 'subtype' = ?", 'principal').last
    fee = wallet.transactions.where("metadata ->> 'subtype' = ?", 'fee').last

    expect(principal).to be_present
    expect(fee).to be_present
    expect(principal.status).to eq('pending')
    expect(fee.status).to eq('pending')
    expect(principal.transfer_id).to eq('tr_123')
    expect(principal.unique_transaction_id).to include(':principal')
    expect(fee.unique_transaction_id).to include(':fee')

    order = BillOrder.find_by(meter_number: transfer_reference)
    expect(order).to be_present

    debit = WalletLedgerEntry.find_by(wallet: wallet, bill_order: order, entry_type: :debit)
    expect(debit).to be_present
    expect(debit.amount.to_d).to eq(principal.amount.to_d + fee.amount.to_d)
    expect(wallet.ledger_outstanding_hold).to eq(0.to_d)
  end

  it 'marks transfers failed and creates reversals on Anchor failure (idempotent)' do
    anchor_service = instance_double(AnchorService)
    allow(AnchorService).to receive(:new).and_return(anchor_service)
    allow(anchor_service).to receive(:initiate_transfer).and_return(
      status: :bad_request,
      message: 'Anchor failed'
    )

    transfer_reference = 'ref-123'

    result = described_class.call(
      user: user,
      sender_wallet: wallet,
      amount_ngn: 10_000,
      bank_payload: bank_payload,
      narration: 'Transfer',
      transfer_reference: transfer_reference
    )

    expect(result[:status]).to eq(:bad_gateway)
    reversals = wallet.transactions.where("metadata ->> 'subtype' = ?", 'reversal')
    expect(reversals.count).to eq(2)
    expect(reversals.pluck(:unique_transaction_id)).to contain_exactly(
      "#{transfer_reference}:reversal:principal",
      "#{transfer_reference}:reversal:fee"
    )

    described_class.call(
      user: user,
      sender_wallet: wallet,
      amount_ngn: 10_000,
      bank_payload: bank_payload,
      narration: 'Transfer',
      transfer_reference: transfer_reference
    )

    expect(wallet.transactions.where("metadata ->> 'subtype' = ?", 'reversal').count).to eq(2)
  end
end
