# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Payment processor query transaction', type: :request do
  it 'creates an admin audit event when querying a transaction' do
    admin = create(:user, active: true, role: 'admin', admin_role: 'support')
    target_user = create(:user, active: true)
    bill_order = BillOrder.create!(
      user: target_user,
      amount: 1000,
      service_type: 'DATA',
      biller: 'mtn',
      meter_number: '123',
      status: 'processing',
      payment_method: 'wallet',
      payment_type: 'online',
      meter_type: 'PREPAID',
      provider_reference: 'prov-123'
    )

    service_double = instance_double(
      BuyPowerPaymentService,
      re_query: { status: :ok, response: { 'data' => { 'status' => 'completed', 'reference' => 'prov-123' } } }
    )
    allow(BuyPowerPaymentService).to receive(:new).and_return(service_double)

    expect do
      get "/api/v1/payment_processors/#{bill_order.id}/query_transaction",
          headers: auth_headers(admin)
    end.to change(AdminAuditEvent, :count).by(1)

    event = AdminAuditEvent.last
    expect(event.admin_user_id).to eq(admin.id)
    expect(event.target_user_id).to eq(target_user.id)
    expect(event.action).to eq('transaction_query')
    expect(event.metadata['transaction_id']).to eq(bill_order.id)
    expect(event.metadata['provider_reference']).to eq('prov-123')
  end
end
