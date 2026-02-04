# frozen_string_literal: true

require 'rails_helper'

RSpec.describe ProcessBuypowerWebhookJob, type: :job do
  before(:all) do
    conn = ActiveRecord::Base.connection
    unless conn.table_exists?(:webhook_events)
      conn.create_table(:webhook_events, id: :uuid) do |t|
        t.string :source, null: false
        t.string :event_type
        t.jsonb :headers
        t.jsonb :payload
        t.datetime :processed_at
        t.string :processing_error
        t.timestamps
      end
    end
    conn.add_column(:webhook_events, :event_type, :string) unless conn.column_exists?(:webhook_events, :event_type)
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
    event = build_event({ 'orderId' => bill_order.id, 'data' => { 'transactionId' => 'p123', 'responseCode' => 100 }, 'message' => 'done' })
    described_class.new.perform(event.id)
    expect(bill_order.reload.status).to eq('completed')
    expect(bill_order.provider_reference).to eq('p123')
  end

  it 'marks bill order completed on boolean success status' do
    event = build_event({ 'orderId' => bill_order.id, 'data' => { 'status' => true, 'transactionId' => 'txn-bool' } })
    described_class.new.perform(event.id)
    expect(bill_order.reload.status).to eq('completed')
    expect(bill_order.provider_reference).to eq('txn-bool')
  end

  it 'marks bill order completed even if previously failed when success webhook arrives' do
    bill_order.update!(status: 'failed', reason: 'provider_error', provider_reference: nil)
    event = build_event({ 'orderId' => bill_order.id, 'data' => { 'responseCode' => 100, 'transaction_id' => 'txn-recover' } })
    described_class.new.perform(event.id)
    bill_order.reload
    expect(bill_order.status).to eq('completed')
    expect(bill_order.provider_reference).to eq('txn-recover')
    expect(bill_order.reason).to be_nil
  end

  it 'completes on responseCode success even without provider_reference' do
    event = build_event({ 'orderId' => bill_order.id, 'data' => { 'responseCode' => 100, 'status' => 'success' } })
    described_class.new.perform(event.id)
    bill_order.reload
    expect(bill_order.status).to eq('completed')
    expect(bill_order.provider_reference).to be_nil
  end

  it 'completes when transactionId is nil but orderId present in data' do
    event = build_event({ 'data' => { 'orderId' => bill_order.id, 'transactionId' => nil, 'status' => true } })
    described_class.new.perform(event.id)
    bill_order.reload
    expect(bill_order.status).to eq('completed')
    expect(bill_order.provider_reference).to be_nil
  end

  it 'marks bill order failed on non-100 responseCode' do
    event = build_event({ 'reference' => bill_order.idempotency_key, 'data' => { 'transaction_id' => 'p124', 'responseCode' => 400 }, 'message' => 'fail' })
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
