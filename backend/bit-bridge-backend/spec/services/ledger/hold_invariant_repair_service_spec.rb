require 'rails_helper'
require 'securerandom'

RSpec.describe Ledger::HoldInvariantRepairService, type: :service do
  let(:user) { create(:user) }
  let(:wallet) { user.wallet }

  def build_bill_order(status: 'failed')
    BillOrder.create!(
      user: user,
      meter_number: SecureRandom.hex(6),
      meter_type: 'PREPAID',
      address: 'Repair Test',
      name: 'Repair Order',
      tariff_class: 'A',
      service_type: 'VTU',
      email: user.email,
      amount: 1_000,
      phone: '08000000000',
      biller: 'MTN',
      description: 'Repair',
      payment_type: 'online',
      payment_method: 'wallet',
      status: status
    )
  end

  describe '#run' do
    it 'adds a repair credit when release+debit exceed the hold and is idempotent' do
      order = build_bill_order
      WalletLedgerEntry.create!(wallet: wallet, bill_order: order, entry_type: :hold, amount: 1_000)
      WalletLedgerEntry.create!(wallet: wallet, bill_order: order, entry_type: :release, amount: 800)
      WalletLedgerEntry.create!(wallet: wallet, bill_order: order, entry_type: :debit, amount: 600)

      service = described_class.new(commit: true).run

      expect(service.actions[:overclosed]).not_to be_empty
      credit = WalletLedgerEntry.where(bill_order: order, entry_type: :credit).first
      expect(credit).to be_present
      expect(credit.reference).to eq("repair/overclosed-hold/#{order.id}")
      expect(credit.metadata).to include('source' => 'ledger_repair', 'subtype' => 'hold_invariant')

      described_class.new(commit: true).run
      expect(WalletLedgerEntry.where(bill_order: order, entry_type: :credit, reference: credit.reference).count).to eq(1)
    end

    it 'creates a release for stale holds once' do
      order = build_bill_order(status: 'completed')
      WalletLedgerEntry.create!(wallet: wallet, bill_order: order, entry_type: :hold, amount: 1_000)

      service = described_class.new(commit: true).run
      expect(service.actions[:stale]).not_to be_empty
      reference = "repair/stale-hold/#{order.id}"
      expect(WalletLedgerEntry.where(bill_order: order, entry_type: :release, reference: reference).count).to eq(1)
      release = WalletLedgerEntry.where(bill_order: order, entry_type: :release, reference: reference).first
      expect(release.metadata).to include('source' => 'ledger_repair', 'subtype' => 'hold_invariant')

      described_class.new(commit: true).run
      expect(WalletLedgerEntry.where(bill_order: order, entry_type: :release, reference: reference).count).to eq(1)
    end
  end
end
