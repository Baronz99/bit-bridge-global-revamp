# frozen_string_literal: true

require 'rails_helper'

RSpec.describe BillOrder, type: :model do
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
end
