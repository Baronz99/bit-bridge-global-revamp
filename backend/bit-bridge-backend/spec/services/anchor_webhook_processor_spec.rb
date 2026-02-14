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

    it 'creates one approved deposit exactly once for repeated payin.received delivery' do
      user = create(:user, email: "payin-#{SecureRandom.hex(4)}@example.com")
      wallet = user.ngn_wallet
      initialized_tx = wallet.transactions.create!(
        status: :initialized,
        coin_type: :mobile_bank,
        transaction_type: :deposit,
        amount: 1,
        metadata: { provider: 'anchor', purpose: 'wallet_fund' }
      )
      TransactionRecord.create!(
        exchange: initialized_tx,
        reference: 'fbg-445566',
        transaction_id: 'payin_445566',
        status: 'pending',
        event_type: 'checkout.init'
      )

      payload = {
        'type' => 'payin.received',
        'attributes' => {
          'payIn' => {
            'id' => 'payin_445566',
            'reference' => 'fbg-445566',
            'amount' => '250000',
            'currency' => 'NGN'
          }
        }
      }

      service = instance_double(AnchorService)
      allow(AnchorService).to receive(:new).and_return(service)
      allow(service).to receive(:fetch_payin).and_return(status: :bad_request, message: 'not needed')

      described_class.call(payload: payload, raw_body: payload.to_json)
      described_class.call(payload: payload, raw_body: payload.to_json)

      record = TransactionRecord.find_by(reference: 'fbg-445566')
      settled_tx = record.exchange

      expect(settled_tx).to be_present
      expect(settled_tx.id).not_to eq(initialized_tx.id)
      expect(settled_tx.status).to eq('approved')
      expect(settled_tx.coin_type).to eq('bank')
      expect(settled_tx.amount).to eq(BigDecimal('2500'))
      expect(settled_tx.metadata['anchor_payin_id']).to eq('payin_445566')
      expect(record.status).to eq('approved')
      expect(record.event_type).to eq('anchor.webhook.payin.received')
      expect(record.transaction_id).to eq('payin_445566')
      expect(wallet.transactions.where(status: :approved, transaction_type: :deposit, coin_type: :bank).count).to eq(1)
    end

    it 'ignores payin.received when no matching reference or payin id exists' do
      payload = {
        'type' => 'payin.received',
        'attributes' => {
          'payIn' => {
            'id' => 'payin_missing',
            'reference' => 'fbg-missing',
            'amount' => '250000',
            'currency' => 'NGN'
          }
        }
      }

      service = instance_double(AnchorService)
      allow(AnchorService).to receive(:new).and_return(service)
      allow(service).to receive(:fetch_payin).and_return(status: :bad_request, message: 'not needed')

      expect do
        described_class.call(payload: payload, raw_body: payload.to_json)
      end.not_to change(Transaction, :count)

      event = AnchorWebhookEvent.find_by(event_type: 'payin.received')
      expect(event).to be_present
      expect(event.status).to eq('processed')
    end
  end
end
