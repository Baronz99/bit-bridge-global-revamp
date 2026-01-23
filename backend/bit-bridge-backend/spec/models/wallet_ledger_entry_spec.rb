# frozen_string_literal: true

require 'rails_helper'
require 'securerandom'

RSpec.describe WalletLedgerEntry, type: :model do
  it 'does not create duplicate logical ledger entries' do
    user = create(:user)
    wallet = user.wallet
    bill_order = BillOrder.create!(
      user: user,
      meter_number: '08012345678',
      meter_type: 'PREPAID',
      address: 'Test Address',
      name: 'Test User',
      tariff_class: 'A',
      service_type: 'VTU',
      email: user.email,
      amount: 1000,
      phone: '08012345678',
      biller: 'MTN',
      description: 'Airtime',
      payment_type: 'online',
      payment_method: 'wallet'
    )

    Transaction.create!(
      wallet: wallet,
      transaction_type: :deposit,
      status: :approved,
      amount: 2_000
    )

    WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: bill_order, amount: 1000)
    WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: bill_order, amount: 1000)
    expect(WalletLedgerEntry.where(wallet: wallet, bill_order: bill_order, entry_type: :hold).count).to eq(1)

    WalletLedgerEntry.record_debit!(wallet: wallet, bill_order: bill_order, amount: 1000)
    WalletLedgerEntry.record_debit!(wallet: wallet, bill_order: bill_order, amount: 1000)
    expect(WalletLedgerEntry.where(wallet: wallet, bill_order: bill_order, entry_type: :debit).count).to eq(1)

    WalletLedgerEntry.record_refund!(wallet: wallet, bill_order: bill_order, amount: 1000)
    WalletLedgerEntry.record_refund!(wallet: wallet, bill_order: bill_order, amount: 1000)
    expect(WalletLedgerEntry.where(wallet: wallet, bill_order: bill_order, entry_type: :refund).count).to eq(1)
  end

  describe 'ledger invariants' do
    let(:user) { create(:user) }
    let(:wallet) { user.wallet }
    let!(:deposit) do
      Transaction.create!(
        wallet: wallet,
        transaction_type: :deposit,
        status: :approved,
        amount: 2_000
      )
    end
    let(:bill_order) do
      BillOrder.create!(
        user: user,
        meter_number: SecureRandom.hex(6),
        meter_type: 'PREPAID',
        address: 'Test',
        name: 'Ledger Invariant',
        tariff_class: 'A',
        service_type: 'VTU',
        email: user.email,
        amount: 1_000,
        phone: '08000000000',
        biller: 'MTN',
        description: 'Ledger guard',
        payment_type: 'online',
        payment_method: 'wallet',
        status: 'initialized'
      )
    end

    it 'prevents release_hold! after a debit is recorded' do
      WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: bill_order, amount: 1_000)
      WalletLedgerEntry.record_debit!(wallet: wallet, bill_order: bill_order, amount: 1_000)

      expect do
        WalletLedgerEntry.release_hold!(wallet: wallet, bill_order: bill_order, amount: 1_000)
      end.to raise_error(ActiveRecord::RecordInvalid)

      expect(WalletLedgerEntry.where(wallet: wallet, bill_order: bill_order, entry_type: :release)).to be_empty
    end

    it 'prevents record_debit! after the hold has already been released' do
      WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: bill_order, amount: 1_000)
      WalletLedgerEntry.release_hold!(wallet: wallet, bill_order: bill_order, amount: 1_000)

      expect do
        WalletLedgerEntry.record_debit!(wallet: wallet, bill_order: bill_order, amount: 1_000)
      end.to raise_error(ActiveRecord::RecordInvalid)

      expect(WalletLedgerEntry.where(wallet: wallet, bill_order: bill_order, entry_type: :debit)).to be_empty
    end

    it 'blocks debit when raw ledger balance is insufficient' do
      Transaction.create!(
        wallet: wallet,
        transaction_type: :withdrawal,
        status: :approved,
        amount: 1_800,
        address: 'Test withdrawal'
      )
      WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: bill_order, amount: 1_000)

      expect do
        WalletLedgerEntry.record_debit!(wallet: wallet, bill_order: bill_order, amount: 1_000)
      end.to raise_error(ActiveRecord::RecordInvalid)
    end

    it 'is idempotent for debit creation' do
      WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: bill_order, amount: 1_000)
      entry = WalletLedgerEntry.record_debit!(wallet: wallet, bill_order: bill_order, amount: 1_000)

      expect do
        WalletLedgerEntry.record_debit!(wallet: wallet, bill_order: bill_order, amount: 1_000)
      end.not_to change { WalletLedgerEntry.where(wallet: wallet, bill_order: bill_order, entry_type: :debit).count }
      expect(WalletLedgerEntry.find_by(wallet: wallet, bill_order: bill_order, entry_type: :debit).id).to eq(entry.id)
    end
  end

  describe 'bill_order validation' do
    let(:user) { create(:user) }
    let(:wallet) { user.wallet }

    it 'allows credit without a bill_order' do
      entry = WalletLedgerEntry.new(wallet: wallet, bill_order: nil, entry_type: :credit, amount: 100)
      expect(entry).to be_valid
    end

    it 'requires bill_order for debit' do
      entry = WalletLedgerEntry.new(wallet: wallet, bill_order: nil, entry_type: :debit, amount: 100)
      expect(entry).not_to be_valid
      expect(entry.errors[:bill_order]).to include("can't be blank")
    end
  end
end
