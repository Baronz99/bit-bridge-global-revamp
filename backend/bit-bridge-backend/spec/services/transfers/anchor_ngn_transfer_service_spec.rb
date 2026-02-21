# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transfers::AnchorNgnTransferService do
  let(:user) { create(:user, :tier2, :with_pin, email: "anchor-transfer-#{SecureRandom.hex(4)}@example.com") }
  let(:wallet) { user.ngn_wallet }
  let(:snapshot_columns_available) { WalletLedgerEntry.column_names.include?('before_book_balance') }
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
    if snapshot_columns_available
      expect(result[:body][:balance_snapshot]).to be_a(Hash)
      expect(result[:body][:balance_snapshot][:reserve]).to be_present
      expect(result[:body][:balance_snapshot][:settle]).to be_present
    end

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

  it 'marks transfers failed and releases hold without creating reversal deposits' do
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
    if snapshot_columns_available
      expect(result[:body][:balance_snapshot]).to be_a(Hash)
      expect(result[:body][:balance_snapshot][:reserve]).to be_present
      expect(result[:body][:balance_snapshot][:release]).to be_present
    end
    reversals = wallet.transactions.where("metadata ->> 'subtype' = ?", 'reversal')
    expect(reversals.count).to eq(0)
    order = BillOrder.find_by(meter_number: transfer_reference)
    release = WalletLedgerEntry.find_by(wallet: wallet, bill_order: order, entry_type: :release)
    expect(release).to be_present

    described_class.call(
      user: user,
      sender_wallet: wallet,
      amount_ngn: 10_000,
      bank_payload: bank_payload,
      narration: 'Transfer',
      transfer_reference: transfer_reference
    )

    expect(wallet.transactions.where("metadata ->> 'subtype' = ?", 'reversal').count).to eq(0)
  end

  it 'finalizes success idempotently when retried' do
    anchor_service = instance_double(AnchorService)
    allow(AnchorService).to receive(:new).and_return(anchor_service)
    allow(anchor_service).to receive(:initiate_transfer).and_return(
      status: :ok,
      data: { transfer_id: 'tr_456', status: 'pending' }
    )

    transfer_reference = 'ref-success-idem'
    starting_available = wallet.ledger_available_balance

    result = described_class.call(
      user: user,
      sender_wallet: wallet,
      amount_ngn: 10_000,
      bank_payload: bank_payload,
      narration: 'Transfer',
      transfer_reference: transfer_reference
    )

    expect(result[:status]).to eq(:ok)

    principal = wallet.transactions.where("metadata ->> 'subtype' = ?", 'principal').last
    fee = wallet.transactions.where("metadata ->> 'subtype' = ?", 'fee').last
    order = BillOrder.find_by(meter_number: transfer_reference)
    total_debit = principal.amount.to_d + fee.amount.to_d
    balance_after_first = wallet.ledger_available_balance

    expect(order).to be_present

    service = described_class.new(
      user: user,
      sender_wallet: wallet,
      amount_ngn: 10_000,
      bank_payload: bank_payload,
      narration: 'Transfer',
      transfer_reference: transfer_reference
    )

    anchor_response = { data: { transfer_id: 'tr_456', status: 'pending' } }
    service.send(:finalize_success!, principal, fee, anchor_response, transfer_reference, order, total_debit)

    debits = WalletLedgerEntry.where(wallet: wallet, bill_order: order, entry_type: :debit)
    expect(debits.count).to eq(1)
    expect(wallet.ledger_outstanding_hold).to eq(0.to_d)
    expect(wallet.ledger_available_balance).to eq(balance_after_first)

    principal_dupes = wallet.transactions.where(unique_transaction_id: "#{transfer_reference}:principal")
    fee_dupes = wallet.transactions.where(unique_transaction_id: "#{transfer_reference}:fee")
    expect(principal_dupes.count).to eq(1)
    expect(fee_dupes.count).to eq(1)
  end

  it 'records refund instead of release when provider later fails after debit' do
    anchor_service = instance_double(AnchorService)
    allow(AnchorService).to receive(:new).and_return(anchor_service)
    allow(anchor_service).to receive(:initiate_transfer).and_return(
      status: :ok,
      data: { transfer_id: 'tr_refund_1', status: 'pending' }
    )

    transfer_reference = 'ref-fail-after-debit'
    described_class.call(
      user: user,
      sender_wallet: wallet,
      amount_ngn: 7_500,
      bank_payload: bank_payload,
      narration: 'Transfer',
      transfer_reference: transfer_reference
    )

    principal = wallet.transactions.where("metadata ->> 'subtype' = ?", 'principal').last
    expect(principal).to be_present
    expect(principal.status).to eq('pending')

    described_class.reverse_transfer!(
      principal,
      reason: 'BENEFICIARY_BANK_NOT_AVAILABLE',
      provider_status: 'nip.transfer.failed'
    )

    order = BillOrder.find_by(meter_number: transfer_reference)
    expect(order).to be_present

    refund = WalletLedgerEntry.find_by(wallet: wallet, bill_order: order, entry_type: :refund)
    release = WalletLedgerEntry.find_by(wallet: wallet, bill_order: order, entry_type: :release)
    expect(refund).to be_present
    expect(release).to be_nil
    expect(order.reload.status).to eq('failed')

    record = TransactionRecord.find_by(reference: transfer_reference)
    expect(record).to be_present
    expect(record.status).to eq('failed')
    expect(record.provider_error_category).to eq('beneficiary_bank_unavailable')

    expect do
      described_class.reverse_transfer!(
        principal.reload,
        reason: 'BENEFICIARY_BANK_NOT_AVAILABLE',
        provider_status: 'nip.transfer.failed'
      )
    end.not_to change { WalletLedgerEntry.where(wallet: wallet, bill_order: order, entry_type: :refund).count }
  end
end
