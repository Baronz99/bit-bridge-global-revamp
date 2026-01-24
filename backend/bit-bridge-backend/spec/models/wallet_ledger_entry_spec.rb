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

    it 'rejects amounts with more than 2 decimal places' do
      entry = WalletLedgerEntry.new(wallet: wallet, bill_order: nil, entry_type: :credit, amount: 1.001)
      expect(entry).not_to be_valid
      expect(entry.errors[:amount]).to include('must have at most 2 decimal places')
    end
  end

  describe 'amount_cents for NGN entries' do
    let(:user) { create(:user) }
    let(:wallet) { user.wallet }

    def build_bill_order(amount: 1_000)
      BillOrder.create!(
        user: user,
        meter_number: SecureRandom.hex(6),
        meter_type: 'PREPAID',
        address: 'Test',
        name: 'Ledger Amount Cents',
        tariff_class: 'A',
        service_type: 'VTU',
        email: user.email,
        amount: amount,
        total_amount: amount,
        phone: '08000000000',
        biller: 'MTN',
        description: 'Ledger cents',
        payment_type: 'online',
        payment_method: 'wallet',
        status: 'initialized'
      )
    end

    def expected_cents(amount)
      (BigDecimal(amount.to_s).round(2) * 100).to_i
    end

    it 'writes amount_cents for credit, hold, release, debit, refund, and adjustment' do
      Transaction.create!(
        wallet: wallet,
        transaction_type: :deposit,
        status: :approved,
        amount: 10_000
      )

      [100, 100.55, 0.01].each do |amount|
        credit_order = build_bill_order(amount: amount)
        credit = WalletLedgerEntry.create!(
          wallet: wallet,
          bill_order: credit_order,
          entry_type: :credit,
          amount: amount,
          reference: "credit-#{amount}-#{SecureRandom.hex(4)}"
        )
        expect(credit.amount_cents).to eq(expected_cents(amount))
        expect(credit.amount.to_d).to eq(Money.from_cents(credit.amount_cents, 'NGN').to_d)

        hold_order = build_bill_order(amount: amount)
        hold = WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: hold_order, amount: amount)
        expect(hold.amount_cents).to eq(expected_cents(amount))
        expect(hold.amount.to_d).to eq(Money.from_cents(hold.amount_cents, 'NGN').to_d)

        release = WalletLedgerEntry.release_hold!(wallet: wallet, bill_order: hold_order, amount: amount)
        expect(release.amount_cents).to eq(expected_cents(amount))
        expect(release.amount.to_d).to eq(Money.from_cents(release.amount_cents, 'NGN').to_d)

        debit_order = build_bill_order(amount: amount)
        WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: debit_order, amount: amount)
        debit = WalletLedgerEntry.record_debit!(wallet: wallet, bill_order: debit_order, amount: amount)
        expect(debit.amount_cents).to eq(expected_cents(amount))
        expect(debit.amount.to_d).to eq(Money.from_cents(debit.amount_cents, 'NGN').to_d)

        refund_order = build_bill_order(amount: amount)
        refund = WalletLedgerEntry.record_refund!(wallet: wallet, bill_order: refund_order, amount: amount)
        expect(refund.amount_cents).to eq(expected_cents(amount))
        expect(refund.amount.to_d).to eq(Money.from_cents(refund.amount_cents, 'NGN').to_d)

        adjustment = WalletLedgerEntry.record_adjustment!(
          wallet: wallet,
          amount: amount,
          reference: "adjust-#{amount}-#{SecureRandom.hex(4)}"
        )
        expect(adjustment.amount_cents).to eq(expected_cents(amount))
        expect(adjustment.amount.to_d).to eq(Money.from_cents(adjustment.amount_cents, 'NGN').to_d)
      end
    end
  end
end
