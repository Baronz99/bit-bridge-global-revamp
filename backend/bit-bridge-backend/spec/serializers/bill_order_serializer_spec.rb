# frozen_string_literal: true

require 'rails_helper'

RSpec.describe BillOrderSerializer, type: :serializer do
  let(:user) { create(:user, :tier2) }

  it 'returns transaction_record reference as receipt_reference when present' do
    bill_order = BillOrder.create!(
      user: user,
      amount: 100,
      service_type: 'VTU',
      payment_method: :wallet,
      status: :initialized
    )

    record = TransactionRecord.create!(
      bill_order: bill_order,
      reference: 'bbg-7001',
      status: 'pending',
      event_type: 'bill_order.checkout_init'
    )

    payload = described_class.new(bill_order).as_json
    expect(payload[:receipt_reference]).to eq(record.reference)
  end
end
