# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AnchorWebhookProcessor do
  describe '.call' do
    it 'processes payment.settled only once for same event type + reference' do
      payload = {
        'type' => 'payment.settled',
        'attributes' => { 'payment' => { 'paymentReference' => 'pay-ref-1' } }
      }
      raw_body = payload.to_json

      service = instance_double(AnchorService)
      allow(AnchorService).to receive(:new).and_return(service)
      allow(service).to receive(:fund_deposit_account)

      described_class.call(payload: payload, raw_body: raw_body)
      described_class.call(payload: payload, raw_body: raw_body)

      expect(service).to have_received(:fund_deposit_account).once
      event = AnchorWebhookEvent.find_by(event_type: 'payment.settled', reference: 'pay-ref-1')
      expect(event).to be_present
      expect(event.status).to eq('processed')
      expect(event.processed_at).to be_present
    end

    it 'uses paymentId as webhook reference when provided' do
      payload = {
        'type' => 'payment.settled',
        'attributes' => { 'payment' => { 'paymentId' => 'pay-id-1', 'paymentReference' => 'pay-ref-1' } }
      }

      service = instance_double(AnchorService)
      allow(AnchorService).to receive(:new).and_return(service)
      allow(service).to receive(:fund_deposit_account)

      described_class.call(payload: payload, raw_body: payload.to_json)

      event = AnchorWebhookEvent.find_by(event_type: 'payment.settled', reference: 'pay-id-1')
      expect(event).to be_present
      expect(event.status).to eq('processed')
    end

    it 'marks webhook as failed when processor raises' do
      payload = {
        'type' => 'payment.settled',
        'attributes' => { 'payment' => { 'paymentReference' => 'pay-ref-fail' } }
      }

      service = instance_double(AnchorService)
      allow(AnchorService).to receive(:new).and_return(service)
      allow(service).to receive(:fund_deposit_account).and_raise(StandardError, 'boom')

      expect do
        described_class.call(payload: payload, raw_body: payload.to_json)
      end.to raise_error(StandardError, 'boom')

      event = AnchorWebhookEvent.find_by(event_type: 'payment.settled', reference: 'pay-ref-fail')
      expect(event).to be_present
      expect(event.status).to eq('failed')
      expect(event.error_message).to eq('boom')
    end

    it 'updates account status for customer.identification.approved' do
      user = create(:user, email: "anchor-webhook-#{SecureRandom.hex(4)}@example.com")
      account = Account.create!(
        user: user,
        vendor: 'anchor',
        account_id: 'cust_123',
        status: :verifying
      )

      payload = {
        'type' => 'customer.identification.approved',
        'relationships' => { 'customer' => { 'data' => { 'id' => account.account_id } } }
      }

      described_class.call(payload: payload, raw_body: payload.to_json)

      expect(account.reload.status).to eq('verified')
    end
  end
end
