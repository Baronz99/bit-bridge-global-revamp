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

  def build_bill_order(status: 'completed', amount: 1_000, with_hold: true)
    order = BillOrder.create!(
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
    if with_hold
      WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: order, amount: amount)
    end
    order
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
    order = build_bill_order(status: 'completed', amount: 1_000, with_hold: false)
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

  it 'applies commission to reduce wallet debit and remains idempotent' do
    user2 = create(:user)
    wallet2 = user2.wallet
    wallet2.update!(commission: 19)

    Transaction.create!(
      wallet: wallet2,
      amount: 200,
      bonus: 0,
      status: :approved,
      transaction_type: :deposit
    )

    order = BillOrder.create!(
      user: user2,
      meter_number: SecureRandom.hex(6),
      meter_type: 'PREPAID',
      address: 'Test',
      name: 'Finalize Bonus',
      tariff_class: 'A',
      service_type: 'VTU',
      email: user2.email,
      amount: 100,
      total_amount: 100,
      phone: '08000000000',
      biller: 'MTN',
      description: 'Finalize',
      payment_type: 'online',
      payment_method: 'wallet',
      status: :processing
    )

    WalletLedgerEntry.ensure_hold!(wallet: wallet2, bill_order: order, amount: 81)

    order.update!(
      status: 'completed',
      payment_method: 'wallet',
      use_commission: true,
      commission_used: 19,
      transaction_id: SecureRandom.hex(6)
    )

    expect do
      described_class.call(bill_order: order)
    end.to change { WalletLedgerEntry.where(bill_order: order, entry_type: :debit).count }.by(1)

    debit_entry = WalletLedgerEntry.find_by(bill_order: order, entry_type: :debit)
    expect(wallet2.reload.balance).to eq(119.to_d)
    expect(wallet2.commission.to_d).to eq(0.to_d)
    expect(order.reload.commission_used.to_d).to eq(19.to_d)
    expect(debit_entry&.amount).to eq(81.to_d)

    expect do
      described_class.call(bill_order: order)
    end.not_to change { wallet2.reload.balance }
  end

  it 'skips debit when commission covers the full amount' do
    user3 = create(:user)
    wallet3 = user3.wallet
    wallet3.update!(commission: 50)

    Transaction.create!(
      wallet: wallet3,
      amount: 200,
      bonus: 0,
      status: :approved,
      transaction_type: :deposit
    )

    order = BillOrder.create!(
      user: user3,
      meter_number: SecureRandom.hex(6),
      meter_type: 'PREPAID',
      address: 'Test',
      name: 'Finalize Bonus Full',
      tariff_class: 'A',
      service_type: 'VTU',
      email: user3.email,
      amount: 40,
      total_amount: 40,
      phone: '08000000000',
      biller: 'MTN',
      description: 'Finalize',
      payment_type: 'online',
      payment_method: 'wallet',
      status: :processing
    )

    order.update!(
      status: 'completed',
      payment_method: 'wallet',
      use_commission: true,
      commission_used: 40,
      transaction_id: SecureRandom.hex(6)
    )

    expect do
      described_class.call(bill_order: order)
    end.not_to change { WalletLedgerEntry.where(bill_order: order, entry_type: :debit).count }

    expect(wallet3.reload.balance).to eq(200.to_d)
    expect(wallet3.commission.to_d).to eq(10.to_d)
  end

  it 'does nothing for non-completed orders' do
    order = build_bill_order(status: 'processing')
    described_class.call(bill_order: order)
    expect(WalletLedgerEntry.where(bill_order: order, entry_type: :debit)).to be_empty
  end

  describe 'when USE_NGN_CENTS_LEDGER is enabled' do
    around do |example|
      old_value = ENV['USE_NGN_CENTS_LEDGER']
      ENV['USE_NGN_CENTS_LEDGER'] = '1'
      example.run
    ensure
      if old_value.nil?
        ENV.delete('USE_NGN_CENTS_LEDGER')
      else
        ENV['USE_NGN_CENTS_LEDGER'] = old_value
      end
    end

    it 'matches debit cents to hold cents' do
      order = build_bill_order(amount: 2_000)
      described_class.call(bill_order: order)

      hold_entry = WalletLedgerEntry.find_by(bill_order: order, entry_type: :hold)
      debit_entry = WalletLedgerEntry.find_by(bill_order: order, entry_type: :debit)

      expect(hold_entry&.amount_cents).to eq(200_000)
      expect(debit_entry&.amount_cents).to eq(hold_entry&.amount_cents)
    end

    it 'applies commission to reduce debit in cents and remains idempotent' do
      user2 = create(:user)
      wallet2 = user2.wallet
      wallet2.update!(commission: 19)

      Transaction.create!(
        wallet: wallet2,
        amount: 200,
        bonus: 0,
        status: :approved,
        transaction_type: :deposit
      )

      order = BillOrder.create!(
        user: user2,
        meter_number: SecureRandom.hex(6),
        meter_type: 'PREPAID',
        address: 'Test',
        name: 'Finalize Bonus',
        tariff_class: 'A',
        service_type: 'VTU',
        email: user2.email,
        amount: 100,
        total_amount: 100,
        phone: '08000000000',
        biller: 'MTN',
        description: 'Finalize',
        payment_type: 'online',
        payment_method: 'wallet',
        status: :processing
      )

      WalletLedgerEntry.ensure_hold!(wallet: wallet2, bill_order: order, amount: 81)

      order.update!(
        status: 'completed',
        payment_method: 'wallet',
        use_commission: true,
        commission_used: 19,
        transaction_id: SecureRandom.hex(6)
      )

      expect do
        described_class.call(bill_order: order)
      end.to change { WalletLedgerEntry.where(bill_order: order, entry_type: :debit).count }.by(1)

      debit_entry = WalletLedgerEntry.find_by(bill_order: order, entry_type: :debit)
      expect(debit_entry&.amount_cents).to eq(8100)

      expect do
        described_class.call(bill_order: order)
      end.not_to change { WalletLedgerEntry.where(bill_order: order, entry_type: :debit).count }
    end

    it 'does not use cents ledger path for non-NGN wallets' do
      usd_wallet = Wallet.create!(user: user, wallet_type: :usd, currency: 'USD', balance_cents: 0)
      order = BillOrder.create!(
        user: user,
        meter_number: SecureRandom.hex(6),
        meter_type: 'PREPAID',
        address: 'Test',
        name: 'Finalize USD',
        tariff_class: 'A',
        service_type: 'VTU',
        email: user.email,
        amount: 2_000,
        total_amount: 2_000,
        phone: '08000000000',
        biller: 'MTN',
        description: 'Finalize',
        payment_type: 'online',
        payment_method: 'wallet',
        status: 'completed'
      )

      WalletLedgerEntry.ensure_hold!(wallet: usd_wallet, bill_order: order, amount: 2_000)
      hold_entry = WalletLedgerEntry.find_by(bill_order: order, entry_type: :hold)
      hold_entry.update!(amount_cents: 9_999)

      described_class.call(bill_order: order)

      debit_entry = WalletLedgerEntry.find_by(bill_order: order, entry_type: :debit)
      expect(debit_entry&.amount).to eq(2_000.to_d)
    end
  end
end
