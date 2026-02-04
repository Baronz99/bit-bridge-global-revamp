# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'BuyPower Webhook', type: :request do
  include ActiveJob::TestHelper

  let(:token) { 'secret-token' }
  let(:headers) { { 'X-BuyPower-Token' => token, 'CONTENT_TYPE' => 'application/json', 'HOST' => 'localhost' } }
  let(:plain_headers) { headers.merge('CONTENT_TYPE' => 'text/plain') }
  let(:payload) { { event: 'vend.update', data: { id: 'abc123', status: 'SUCCESS' } } }

  before(:all) do
    conn = ActiveRecord::Base.connection
    unless conn.table_exists?(:webhook_events)
      conn.create_table(:webhook_events, id: :uuid) do |t|
        t.string :source, null: false
        t.string :event_type
        t.jsonb :headers
        t.jsonb :payload
        t.jsonb :payload_json
        t.datetime :processed_at
        t.string :processing_error
        t.timestamps
      end
    end
    conn.add_column(:webhook_events, :event_type, :string) unless conn.column_exists?(:webhook_events, :event_type)
    conn.add_column(:webhook_events, :payload_json, :jsonb) unless conn.column_exists?(:webhook_events, :payload_json)
    conn.add_column(:webhook_events, :processed_at, :datetime) unless conn.column_exists?(:webhook_events, :processed_at)
    conn.add_column(:webhook_events, :processing_error, :string) unless conn.column_exists?(:webhook_events, :processing_error)
    WebhookEvent.reset_column_information
  end

  before do
    allow(ENV).to receive(:[]).and_call_original
    allow(ENV).to receive(:[]).with('BUYPOWER_WEBHOOK_TOKEN').and_return(token)
    ActiveJob::Base.queue_adapter = :test
    clear_enqueued_jobs
    WebhookEvent.delete_all
  end

  it 'persists event and enqueues job' do
    event_id = nil

    expect do
      expect do
        post '/api/v1/webhooks/buypower', params: payload.to_json, headers: headers
        event_id = WebhookEvent.last&.id
      end.to have_enqueued_job(ProcessBuypowerWebhookJob).with(event_id)
    end.to change(WebhookEvent, :count).by(1)

    expect(response).to have_http_status(:ok)

    event = WebhookEvent.find(event_id)
    expect(event.source).to eq('buypower')
    expect(event.payload_json).to eq(payload.deep_stringify_keys)
    expect(event.processing_error).to be_nil
  end

  it 'rejects invalid token' do
    expect do
      post '/api/v1/webhooks/buypower', params: payload.to_json, headers: headers.merge('X-BuyPower-Token' => 'bad')
    end.not_to change(WebhookEvent, :count)

    expect(response).to have_http_status(:unauthorized)
  end

  it 'stores invalid JSON and does not enqueue job' do
    expect do
      expect do
        post '/api/v1/webhooks/buypower', params: 'not-json', headers: plain_headers
      end.not_to have_enqueued_job(ProcessBuypowerWebhookJob)
    end.to change(WebhookEvent, :count).by(1)

    expect(response).to have_http_status(:ok)

    event = WebhookEvent.last
    expect(event.payload_json).to be_nil
    expect(event.processing_error).to be_present
  end
end
