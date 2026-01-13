# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Anchor webhook', type: :request do
  include ActiveJob::TestHelper

  let(:secret) { 'anchor-secret' }
  let(:payload) { { type: 'payment.settled', attributes: { payment: { amount: 1000 } } } }
  let(:raw_body) { payload.to_json }
  let(:signature) { Base64.strict_encode64(OpenSSL::HMAC.hexdigest('sha1', secret, raw_body)) }

  around do |example|
    original = ENV['ANCHOR_WEBHOOK_SECRET']
    ENV['ANCHOR_WEBHOOK_SECRET'] = secret
    example.run
    ENV['ANCHOR_WEBHOOK_SECRET'] = original
  end

  it 'enqueues job when signature is valid' do
    expect do
      post '/api/v1/anchor/webhook', params: raw_body, headers: { 'x-anchor-signature' => signature }
    end.to have_enqueued_job(AnchorWebhookJob)

    expect(response).to have_http_status(:ok)
  end

  it 'rejects invalid signature' do
    post '/api/v1/anchor/webhook', params: raw_body, headers: { 'x-anchor-signature' => 'bad' }

    expect(response).to have_http_status(:unauthorized)
  end

  it 'returns 503 when secret is missing' do
    ENV['ANCHOR_WEBHOOK_SECRET'] = ''
    post '/api/v1/anchor/webhook', params: raw_body, headers: { 'x-anchor-signature' => signature }

    expect(response).to have_http_status(:service_unavailable)
  end
end
