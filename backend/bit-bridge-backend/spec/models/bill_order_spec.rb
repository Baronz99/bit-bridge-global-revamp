# frozen_string_literal: true

require 'rails_helper'

RSpec.describe BillOrder, type: :model do
  def build_bill_order(user:, service_type: 'VTU', biller: 'MTN', status: 'processing', metadata: {})
    BillOrder.create!(
      user: user,
      meter_number: SecureRandom.hex(6),
      meter_type: 'PREPAID',
      address: 'Test Address',
      name: 'Test User',
      tariff_class: 'A',
      service_type: service_type,
      email: user.email,
      amount: 1000,
      phone: '08012345678',
      biller: biller,
      description: 'Test Bill',
      payment_type: 'online',
      payment_method: 'wallet',
      status: status,
      provider_response: metadata
    )
  end

  it 'prevents terminal status regression' do
    user = create(:user)
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
      payment_method: 'wallet',
      status: 'completed'
    )

    expect(bill_order.update(status: 'processing')).to eq(false)
    expect(bill_order.errors[:status]).to include('is terminal and cannot be changed')
  end

  it 'accepts amounts with 2 decimal places' do
    user = create(:user)
    bill_order = BillOrder.new(
      user: user,
      meter_number: '08012345678',
      meter_type: 'PREPAID',
      address: 'Test Address',
      name: 'Test User',
      tariff_class: 'A',
      service_type: 'VTU',
      email: user.email,
      amount: 100.55,
      phone: '08012345678',
      biller: 'MTN',
      description: 'Airtime',
      payment_type: 'online',
      payment_method: 'wallet'
    )

    expect(bill_order).to be_valid
  end

  it 'writes cents alongside decimal amounts' do
    user = create(:user)
    bill_order = BillOrder.create!(
      user: user,
      meter_number: '08012345678',
      meter_type: 'PREPAID',
      address: 'Test Address',
      name: 'Test User',
      tariff_class: 'A',
      service_type: 'VTU',
      email: user.email,
      amount: 100.0,
      phone: '08012345678',
      biller: 'MTN',
      description: 'Airtime',
      payment_type: 'online',
      payment_method: 'wallet'
    )

    expect(bill_order.amount_cents).to eq(10_000)
  end

  it 'skips bill push notification for anchor transfer shadow orders' do
    user = create(:user)
    bill_order = build_bill_order(
      user: user,
      service_type: 'OTHER',
      biller: 'Anchor',
      metadata: { source: 'anchor_transfer', transfer_reference: SecureRandom.uuid }
    )

    expect(Notifications::EventPublisher).not_to receive(:call)
    bill_order.update!(status: 'completed')
  end

  it 'publishes bill status notification for non-transfer bill orders' do
    user = create(:user)
    bill_order = build_bill_order(user: user, service_type: 'VTU', biller: 'MTN', metadata: {})

    expect(Notifications::EventPublisher).to receive(:call).with(
      hash_including(
        user: user,
        event_type: 'bill.status.changed',
        resource_type: 'bill_order',
        resource_id: bill_order.id,
        metadata: hash_including(
          status: 'completed',
          source: '',
          service_type: 'VTU'
        )
      )
    )

    bill_order.update!(status: 'completed')
  end
end
