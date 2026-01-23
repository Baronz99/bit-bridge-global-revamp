# frozen_string_literal: true

require 'rails_helper'

RSpec.describe BillOrders::Finalizer, type: :service do
  let(:user) { create(:user) }
  let(:wallet) { user.wallet }
  let!(:deposit) do
    Transaction.create!(
      wallet: wallet,
      amount: 10_000,
      bonus: 0,
      status: :approved,
      transaction_type: :deposit
    )
  end

  def build_bill_order(status: 'completed', amount: 1_000)
    BillOrder.create!(
      user: user,
      meter_number: SecureRandom.hex(6),
      meter_type: 'PREPAID',
      address: 'Test',
      name: 'Finalize Test',
      tariff_class: 'A',
      service_type: 'VTU',
      email: user.email,
      amount: amount,
      total_amount: amount,
      phone: '08000000000',
      biller: 'MTN',
      description: 'Finalize',
      payment_type: 'online',
      payment_method: 'wallet',
      status: status
    )
  end

  it 'creates a debit once when a completed bill_order is finalized' do
    order = build_bill_order(amount: 2_000)
    expect do
      described_class.call(bill_order: order)
    end.to change { WalletLedgerEntry.where(bill_order: order, entry_type: :debit).count }.by(1)
    expect(Wallet.find_by(user_id: user.id, wallet_type: :ngn).reload.ledger_available_balance).to eq(8_000.to_d)
    debit = WalletLedgerEntry.find_by(bill_order: order, entry_type: :debit)
    expect(debit.amount).to eq(order.total_amount.to_d)
  end

  it 'does not create a debit for non-wallet payment methods' do
    order = build_bill_order(status: 'completed', amount: 1_000)
    order.update!(payment_method: :card)
    described_class.call(bill_order: order)
    expect(WalletLedgerEntry.where(bill_order: order, entry_type: :debit)).to be_empty
  end

  it 'is idempotent when called twice' do
    order = build_bill_order(amount: 1_500)
    described_class.call(bill_order: order)
    expect do
      described_class.call(bill_order: order)
    end.not_to change { WalletLedgerEntry.where(bill_order: order, entry_type: :debit).count }
  end

  it 'does nothing for non-completed orders' do
    order = build_bill_order(status: 'processing')
    described_class.call(bill_order: order)
    expect(WalletLedgerEntry.where(bill_order: order, entry_type: :debit)).to be_empty
  end
end
