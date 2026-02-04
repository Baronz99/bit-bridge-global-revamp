# frozen_string_literal: true

require 'rails_helper'

RSpec.describe ProcessBuypowerWebhookJob, type: :job do
  before(:all) do
    conn = ActiveRecord::Base.connection
    unless conn.table_exists?(:webhook_events)
      conn.create_table(:webhook_events, id: :uuid) do |t|
        t.string :source, null: false
        t.jsonb :headers
        t.jsonb :payload
        t.datetime :processed_at
        t.string :processing_error
        t.timestamps
      end
    end
    unless conn.column_exists?(:webhook_events, :processed_at)
      conn.add_column(:webhook_events, :processed_at, :datetime)
    end
    unless conn.column_exists?(:webhook_events, :processing_error)
      conn.add_column(:webhook_events, :processing_error, :string)
    end
    WebhookEvent.reset_column_information
  end

  let(:bill_order) do
    user = User.create!(email: 'webhook-user@example.com', password: 'Password1!', role: 'user')
    BillOrder.create!(
      user: user,
      meter_number: '111',
      meter_type: 'PREPAID',
      service_type: 'VTU',
      amount: 100,
      biller: 'mtn',
      status: 'initialized',
      provider_reference: nil,
      idempotency_key: 'idem123'
    )
  end

  def build_event(payload)
    WebhookEvent.create!(source: 'buypower', payload: payload)
  end

  it 'marks bill order completed on responseCode 100' do
    event = build_event({ 'orderId' => bill_order.id, 'data' => { 'id' => 'p123', 'responseCode' => 100 }, 'message' => 'done' })
    described_class.new.perform(event.id)
    expect(bill_order.reload.status).to eq('completed')
    expect(bill_order.provider_reference).to eq('p123')
  end

  it 'marks bill order failed on non-100 responseCode' do
    event = build_event({ 'reference' => bill_order.idempotency_key, 'data' => { 'id' => 'p124', 'responseCode' => 400 }, 'message' => 'fail' })
    described_class.new.perform(event.id)
    expect(bill_order.reload.status).to eq('failed')
    expect(bill_order.provider_reference).to eq('p124')
  end

  it 'does nothing if bill order already completed' do
    bill_order.update!(status: 'completed', provider_reference: 'old')
    event = build_event({ 'orderId' => bill_order.id, 'data' => { 'id' => 'new', 'responseCode' => 100 } })
    described_class.new.perform(event.id)
    expect(bill_order.reload.provider_reference).to eq('old')
  end
end
