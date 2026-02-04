# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'BuyPower Webhook', type: :request do
  include ActiveJob::TestHelper

  let(:token) { 'secret-token' }
  let(:headers) { { 'X-BuyPower-Token' => token, 'CONTENT_TYPE' => 'application/json' } }
  let(:payload) { { event: 'vend.update', data: { id: 'abc123', status: 'SUCCESS' } } }

  before do
    allow(ENV).to receive(:[]).and_call_original
    allow(ENV).to receive(:[]).with('BUYPOWER_WEBHOOK_TOKEN').and_return(token)
  end
  before(:all) do
    ActiveRecord::Base.connection.create_table(:webhook_events, id: :uuid, if_not_exists: true) do |t|
      t.string :source, null: false
      t.jsonb :headers
      t.jsonb :payload
      t.timestamps
    end
  end

  it 'persists event and enqueues job' do
    expect {
      post '/api/v1/webhooks/buypower', params: payload.to_json, headers: headers
    }.to change { WebhookEvent.count }.by(1)
      .and have_enqueued_job(ProcessBuypowerWebhookJob)

    expect(response).to have_http_status(:ok)
    event = WebhookEvent.last
    expect(event.source).to eq('buypower')
    expect(event.payload).to include('event' => 'vend.update')
  end

  it 'rejects invalid token' do
    post '/api/v1/webhooks/buypower', params: payload.to_json, headers: headers.merge('X-BuyPower-Token' => 'bad')
    expect(response).to have_http_status(:unauthorized)
  end
end
