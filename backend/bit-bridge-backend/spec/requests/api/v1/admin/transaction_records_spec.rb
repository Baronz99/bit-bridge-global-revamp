# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Admin transaction records', type: :request do
  include ActiveSupport::Testing::TimeHelpers

  let(:admin) { create(:user, role: 'super_admin') }
  let(:headers) { auth_headers(admin) }

  it 'returns 401 when unauthorized' do
    get '/api/v1/admin/transaction_records'

    expect(response).to have_http_status(:unauthorized)
  end

  it 'returns 403 when non-super-admin' do
    user = create(:user, role: 'support')

    get '/api/v1/admin/transaction_records', headers: auth_headers(user)

    expect(response).to have_http_status(:forbidden)
  end

  it 'returns records with expected keys and no PII' do
    TransactionRecord.create!(
      reference: 'fbg-111',
      status: 'pending',
      event_type: 'checkout.init',
      amount: 100,
      customer_name: 'Jane Doe',
      email: 'test@example.com',
      phone_number: '08000000000'
    )

    get '/api/v1/admin/transaction_records', headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    record = body['data'].first
    expect(record.keys).to contain_exactly(
      'id',
      'reference',
      'status',
      'event_type',
      'amount',
      'created_at',
      'updated_at',
      'transaction_id',
      'bill_order_id',
      'exchange_id'
    )
    expect(record.keys).not_to include('customer_name', 'email', 'phone_number')
  end

  it 'caps limit at 200 and filters by prefix, status, and before' do
    travel_to(Time.current) do
      205.times do |i|
        TransactionRecord.create!(
          reference: "fbg-#{i}",
          status: i.even? ? 'pending' : 'approved',
          event_type: 'checkout.init',
          amount: 100,
          created_at: i < 5 ? 2.days.ago : Time.current
        )
      end

      get '/api/v1/admin/transaction_records',
          params: {
            limit: 300,
            reference_prefix: 'fbg-1',
            status: 'pending',
            before: 1.day.ago.iso8601
          },
          headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      data = body['data']
      expect(data.length).to be <= 200
      expect(data).to all(satisfy { |row| row['reference'].start_with?('fbg-1') })
      expect(data).to all(satisfy { |row| row['status'] == 'pending' })
      expect(data).to all(satisfy { |row| Time.iso8601(row['created_at']) < 1.day.ago })
    end
  end

  it 'creates an audit event with filters' do
    TransactionRecord.create!(
      reference: 'fbg-222',
      status: 'pending',
      event_type: 'checkout.init',
      amount: 100
    )

    expect do
      get '/api/v1/admin/transaction_records',
          params: { limit: 10, status: 'pending', reference_prefix: 'fbg', before: 1.minute.ago.iso8601 },
          headers: headers
    end.to change(AdminAuditEvent, :count).by(1)

    event = AdminAuditEvent.order(created_at: :desc).first
    expect(event.action).to eq('admin.transaction_records.list')
    expect(event.admin_user_id).to eq(admin.id)
    expect(event.metadata).to include(
      'limit' => 10,
      'status' => 'pending',
      'reference_prefix' => 'fbg'
    )
    expect(event.metadata['before']).to be_present
    expect(event.metadata['request_id']).to be_present
  end
end
