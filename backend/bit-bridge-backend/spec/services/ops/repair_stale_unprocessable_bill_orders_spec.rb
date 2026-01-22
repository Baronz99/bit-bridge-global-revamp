# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Ops::RepairStaleUnprocessableBillOrders, type: :service do
  let(:user) { create(:user) }
  let(:wallet) { user.wallet }
  let(:cutoff_time) { 48.hours.ago }

  def build_order(attrs = {})
    BillOrder.create!(
      {
        user: user,
        meter_number: SecureRandom.hex(6),
        meter_type: 'PREPAID',
        address: 'Test',
        name: 'Test Order',
        tariff_class: 'A',
        service_type: 'VTU',
        email: user.email,
        amount: 1_000,
        phone: '08000000000',
        biller: 'MTN',
        description: 'Repair',
        payment_type: 'online',
        payment_method: 'wallet',
        status: :processing,
        reason: 'Reconcile stalled: unprocessable_entity',
        created_at: 3.days.ago
      }.merge(attrs)
    )
  end

  it 'updates eligible processing records with zero ledger entries' do
    order = build_order

    service = described_class.new(cutoff_time: cutoff_time, limit: 10, dry_run: false).run

    expect(service.updated).to eq(1)
    order.reload
    expect(order.status).to eq('failed')
    expect(order.reason).to eq('reconcile_stalled_unprocessable_closed')
    expect(order.provider_response['repair_reference']).to eq("repair/reconcile-stalled-unprocessable/#{order.id}")
    expect(WalletLedgerEntry.where(bill_order: order)).to be_empty
  end

  it 'does not touch terminal bill_orders' do
    terminal = build_order(status: :completed)
    service = described_class.new(cutoff_time: cutoff_time, limit: 10, dry_run: false).run
    terminal.reload
    expect(terminal.status).to eq('completed')
    expect(service.updated).to eq(0)
  end

  it 'skips orders with any ledger entries' do
    order = build_order
    WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: order, amount: 100)

    service = described_class.new(cutoff_time: cutoff_time, limit: 10, dry_run: false).run

    order.reload
    expect(order.status).to eq('processing')
    expect(service.updated).to eq(0)
    expect(service.skipped).to be_positive
  end

  it 'is idempotent when run twice' do
    order = build_order
    service = described_class.new(cutoff_time: cutoff_time, limit: 10, dry_run: false)
    service.run
    summary1 = service.summary.dup

    service2 = described_class.new(cutoff_time: cutoff_time, limit: 10, dry_run: false)
    service2.run
    summary2 = service2.summary

    order.reload
    expect(order.provider_response['repair_reference']).to eq("repair/reconcile-stalled-unprocessable/#{order.id}")
    expect(summary1[:updated]).to eq(1)
    expect(summary2[:updated]).to eq(0)
  end

  it 'honors dry_run and creates no ledger entries' do
    order = build_order

    service = described_class.new(cutoff_time: cutoff_time, limit: 10, dry_run: true).run

    order.reload
    expect(order.status).to eq('processing')
    expect(service.updated).to eq(1) # counted, but not persisted
    expect(order.provider_response).to be_nil.or be_empty
    expect(WalletLedgerEntry.where(bill_order: order)).to be_empty
  end
end
