# frozen_string_literal: true

require 'rails_helper'
require 'securerandom'

RSpec.describe Wallet, type: :model do
  let(:user) { create(:user) }
  let(:wallet) { user.wallet }

  def deposit(amount = 10_000)
    Transaction.create!(
      wallet: wallet,
      amount: amount,
      bonus: 0,
      status: :approved,
      transaction_type: :deposit
    )
  end

  def build_bill_order(status: 'initialized')
    BillOrder.create!(
      user: user,
      meter_number: "0801#{SecureRandom.hex(4)}",
      meter_type: 'PREPAID',
      address: 'Test',
      name: 'Ledger Test',
      tariff_class: 'A',
      service_type: 'VTU',
      email: user.email,
      amount: 1_000,
      phone: '08000000000',
      biller: 'MTN',
      description: 'Airtime',
      payment_type: 'online',
      payment_method: 'wallet',
      status: status
    )
  end

  describe 'ledger-derived balances' do
    before do
      wallet.transactions.delete_all
      wallet.wallet_ledger_entries.delete_all
      deposit
    end

    it 'exposes ledger_available_balance through balance and real_balance for NGN wallets' do
      expect(wallet.balance).to eq(wallet.ledger_available_balance)
      expect(wallet.real_balance).to eq(wallet.ledger_available_balance)
    end

    it 'never returns a negative balance even when holds exceed deposits' do
      WalletLedgerEntry.ensure_hold!(
        wallet: wallet,
        bill_order: build_bill_order,
        amount: 20_000
      )

      expect(wallet.ledger_available_balance).to eq(BigDecimal('0'))
    end

    it 'ignores pending or failed bill orders that never generated ledger holds' do
      build_bill_order(status: 'processing')
      build_bill_order(status: 'failed')

      expect(wallet.ledger_available_balance).to eq(10_000.to_d)
    end

    it 'reduces balance when holds exist and reclaims funds after release or debit' do
      cancelled_order = build_bill_order(status: 'initialized')
      success_order = build_bill_order(status: 'initialized')

      WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: cancelled_order, amount: 2_000)
      expect(wallet.reload.ledger_available_balance).to eq(8_000.to_d)

      WalletLedgerEntry.release_hold!(wallet: wallet, bill_order: cancelled_order, amount: 2_000)
      expect(wallet.reload.ledger_available_balance).to eq(10_000.to_d)

      WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: success_order, amount: 2_000)
      WalletLedgerEntry.record_debit!(wallet: wallet, bill_order: success_order, amount: 2_000)
      expect(wallet.reload.ledger_available_balance).to eq(8_000.to_d)
    end

    it 'reduces available balance by pending and approved withdrawals' do
      Transaction.create!(
        wallet: wallet,
        amount: 3_000,
        bonus: 0,
        status: :pending,
        transaction_type: :withdrawal,
        address: 'withdrawal-spec'
      )

      expect(wallet.reload.ledger_available_balance).to eq(7_000.to_d)

      wallet.transactions.update_all(status: :approved)
      expect(wallet.reload.ledger_available_balance).to eq(7_000.to_d)
    end

    it 'does not include deposit bonuses in ledger deposits' do
      Transaction.create!(
        wallet: wallet,
        amount: 1_000,
        bonus: 500,
        status: :approved,
        transaction_type: :deposit
      )

      expect(wallet.reload.ledger_available_balance).to eq(11_000.to_d)
    end

    it 'clamps outstanding holds per bill order so negatives never cancel positives' do
      long_release = build_bill_order(status: 'initialized')
      overcharged = build_bill_order(status: 'initialized')

      WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: long_release, amount: 2_000)
      WalletLedgerEntry.release_hold!(wallet: wallet, bill_order: long_release, amount: 2_500)
      WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: overcharged, amount: 1_500)
      WalletLedgerEntry.record_debit!(wallet: wallet, bill_order: overcharged, amount: 200)

      expect(wallet.reload.ledger_outstanding_hold).to eq(1_300.to_d)
    end

    it 'ignores repair credits when calculating available balance' do
      funded_order = build_bill_order(status: 'failed')
      WalletLedgerEntry.create!(
        wallet: wallet,
        bill_order: funded_order,
        entry_type: :credit,
        amount: 500,
        reference: 'funded-credit',
        metadata: { 'source' => 'external_funding' }
      )

      repair_order = build_bill_order(status: 'failed')
      WalletLedgerEntry.create!(
        wallet: wallet,
        bill_order: repair_order,
        entry_type: :credit,
        amount: 700,
        reference: 'repair-credit',
        metadata: { 'source' => 'ledger_repair', 'subtype' => 'hold_invariant' }
      )

      expect(wallet.reload.ledger_available_balance).to eq(10_000.to_d)
    end

    it 'restores negative raw balance to zero after an adjustment' do
      Transaction.create!(
        wallet: wallet,
        amount: 12_000,
        status: :approved,
        transaction_type: :withdrawal,
        address: 'ledger-reset',
        metadata: { 'ledger_hold_reserved' => true }
      )

      expect(wallet.reload.ledger_raw_balance).to eq((-2_000).to_d)
      expect(wallet.reload.ledger_available_balance).to eq(0.to_d)

      WalletLedgerEntry.record_adjustment!(
        wallet: wallet,
        amount: 2_000,
        reference: "neg_reset:spec:#{wallet.id}"
      )

      expect(wallet.reload.ledger_raw_balance).to eq(0.to_d)
      expect(wallet.reload.ledger_available_balance).to eq(0.to_d)
    end

    it 'subtracts withdrawals from ledger balances' do
      Transaction.create!(
        wallet: wallet,
        amount: 4_000,
        status: :approved,
        transaction_type: :withdrawal,
        address: 'test',
        metadata: { 'ledger_hold_reserved' => true }
      )

      expect(wallet.reload.ledger_raw_balance).to eq(6_000.to_d)
      expect(wallet.reload.ledger_available_balance).to eq(6_000.to_d)
    end

    it 'adds refunds to ledger balances' do
      refunded_order = build_bill_order(status: 'failed')
      WalletLedgerEntry.record_refund!(
        wallet: wallet,
        bill_order: refunded_order,
        amount: 1_500,
        reference: "refund:spec:#{wallet.id}"
      )

      expect(wallet.reload.ledger_raw_balance).to eq(11_500.to_d)
    end
  end

  describe 'USD wallet behavior' do
    it 'uses balance_cents for balance and real_balance' do
      usd_wallet = user.usd_wallet
      usd_wallet.update!(balance_cents: 20_50)

      expected = usd_wallet.cents_to_money(20_50)
      expect(usd_wallet.balance).to eq(expected)
      expect(usd_wallet.real_balance).to eq(expected)
    end
  end

  describe 'currency normalization' do
    it 'normalizes currency to uppercase and strips whitespace' do
      new_user = create(:user)
      Wallet.where(user_id: new_user.id).delete_all

      new_wallet = Wallet.new(user: new_user, wallet_type: :ngn, currency: ' ngn ')
      new_wallet.validate

      expect(new_wallet.currency).to eq('NGN')
    end
  end
end
