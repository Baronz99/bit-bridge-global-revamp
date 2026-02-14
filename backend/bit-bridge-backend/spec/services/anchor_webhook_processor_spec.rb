# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AnchorWebhookProcessor do
  describe '.call' do
    around do |example|
      original_scale = ENV['ANCHOR_AMOUNT_SCALE']
      ENV['ANCHOR_AMOUNT_SCALE'] = '100'
      example.run
    ensure
      ENV['ANCHOR_AMOUNT_SCALE'] = original_scale
    end

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
      expect(settled_tx.metadata['anchor_amount_raw']).to eq('250000')
      expect(settled_tx.metadata['anchor_amount_scale']).to eq('100.0')
      expect(settled_tx.metadata['anchor_amount_major']).to eq('2500.0')
      expect(record.status).to eq('approved')
      expect(record.event_type).to eq('anchor.webhook.payin.received')
      expect(record.transaction_id).to eq('payin_445566')
      expect(wallet.transactions.where(status: :approved, transaction_type: :deposit, coin_type: :bank).count).to eq(1)
    end

    it 'scales small NGN minor unit amounts deterministically without heuristic' do
      user = create(:user, email: "payin-small-#{SecureRandom.hex(4)}@example.com")
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
        reference: 'fbg-500',
        transaction_id: 'payin_500',
        status: 'pending',
        event_type: 'checkout.init'
      )

      payload = {
        'type' => 'payin.received',
        'attributes' => {
          'payIn' => {
            'id' => 'payin_500',
            'reference' => 'fbg-500',
            'amount' => '500',
            'currency' => 'NGN'
          }
        }
      }

      service = instance_double(AnchorService)
      allow(AnchorService).to receive(:new).and_return(service)
      allow(service).to receive(:fetch_payin).and_return(status: :bad_request, message: 'not needed')

      described_class.call(payload: payload, raw_body: payload.to_json)

      record = TransactionRecord.find_by(reference: 'fbg-500')
      settled_tx = record.exchange

      expect(settled_tx).to be_present
      expect(settled_tx.amount).to eq(BigDecimal('5.0'))
      expect(settled_tx.metadata['anchor_amount_raw']).to eq('500')
      expect(settled_tx.metadata['anchor_amount_scale']).to eq('100.0')
      expect(settled_tx.metadata['anchor_amount_major']).to eq('5.0')
    end

    it 'creates pooled funding credit when payin matches funding intent reference' do
      user = create(:user, email: "pooled-#{SecureRandom.hex(4)}@example.com")
      wallet = user.ngn_wallet
      intent = FundingIntent.create!(
        user: user,
        provider: 'anchor',
        reference: 'BBG-ABC123-1XYZ',
        expected_amount_cents: 300_00,
        expires_at: 20.minutes.from_now,
        status: 'pending',
        metadata: {}
      )

      payload = {
        'type' => 'payin.received',
        'attributes' => {
          'payIn' => {
            'id' => 'payin_pool_1',
            'reference' => 'BBG-ABC123-1XYZ',
            'amount' => '30000',
            'currency' => 'NGN',
            'narration' => 'Wallet topup BBG-ABC123-1XYZ'
          }
        }
      }

      service = instance_double(AnchorService)
      allow(AnchorService).to receive(:new).and_return(service)
      allow(service).to receive(:fetch_payin).and_return(status: :bad_request, message: 'not needed')

      expect do
        described_class.call(payload: payload, raw_body: payload.to_json)
      end.to change(Transaction, :count).by(1)

      credit_tx = wallet.transactions.find_by(unique_transaction_id: 'anchor-pooled-payin_pool_1')
      expect(credit_tx).to be_present
      expect(credit_tx.status).to eq('approved')
      expect(credit_tx.amount).to eq(BigDecimal('300.0'))
      expect(credit_tx.metadata['purpose']).to eq('wallet_fund_pooled')
      expect(credit_tx.metadata['funding_intent_id']).to eq(intent.id)

      intent.reload
      expect(intent.status).to eq('credited')
      expect(intent.credited_transaction_id).to eq(credit_tx.id)

      inbound = InboundBankTransfer.find_by(provider: 'anchor', provider_reference: 'payin_pool_1')
      expect(inbound).to be_present
      expect(inbound.status).to eq('credited')
      expect(inbound.funding_intent_id).to eq(intent.id)
      expect(inbound.matched_user_id).to eq(user.id)
      expect(inbound.credited_transaction_id).to eq(credit_tx.id)

      record = TransactionRecord.find_by(reference: intent.reference)
      expect(record).to be_present
      expect(record.exchange_id).to eq(credit_tx.id)
      expect(record.status).to eq('approved')
    end

    it 'does not double-credit pooled intent on duplicate payin webhook deliveries' do
      user = create(:user, email: "pooled-dup-#{SecureRandom.hex(4)}@example.com")
      wallet = user.ngn_wallet
      FundingIntent.create!(
        user: user,
        provider: 'anchor',
        reference: 'BBG-DUP111-ABCD',
        expires_at: 20.minutes.from_now,
        status: 'pending',
        metadata: {}
      )

      payload = {
        'type' => 'payin.received',
        'attributes' => {
          'payIn' => {
            'id' => 'payin_pool_dup',
            'reference' => 'BBG-DUP111-ABCD',
            'amount' => '15000',
            'currency' => 'NGN'
          }
        }
      }

      service = instance_double(AnchorService)
      allow(AnchorService).to receive(:new).and_return(service)
      allow(service).to receive(:fetch_payin).and_return(status: :bad_request, message: 'not needed')

      described_class.call(payload: payload, raw_body: payload.to_json)
      described_class.call(payload: payload, raw_body: payload.to_json)

      expect(wallet.transactions.where(unique_transaction_id: 'anchor-pooled-payin_pool_dup').count).to eq(1)
      inbound = InboundBankTransfer.find_by(provider: 'anchor', provider_reference: 'payin_pool_dup')
      expect(inbound.status).to eq('credited')
    end

    it 'routes payment.settled with BBG narration to pooled funding credit path' do
      user = create(:user, email: "pooled-settled-#{SecureRandom.hex(4)}@example.com")
      wallet = user.ngn_wallet
      intent = FundingIntent.create!(
        user: user,
        provider: 'anchor',
        reference: 'BBG-LSGSCZ-LRLA',
        expected_amount_cents: 100_000,
        expires_at: 20.minutes.from_now,
        status: 'pending',
        metadata: {}
      )

      payload = {
        'type' => 'payment.settled',
        'attributes' => {
          'payment' => {
            'paymentId' => '177108533436536-anc_inb_trsf',
            'paymentReference' => '1771084585945140-ref',
            'currency' => 'NGN',
            'amount' => 100_000,
            'narration' => 'BBG-LSGSCZ-LRLA to Bit Bridge Global Limited'
          }
        }
      }

      service = instance_double(AnchorService)
      allow(AnchorService).to receive(:new).and_return(service)
      allow(service).to receive(:fund_deposit_account)

      expect do
        described_class.call(payload: payload, raw_body: payload.to_json)
      end.to change(Transaction, :count).by(1)

      expect(service).not_to have_received(:fund_deposit_account)

      credit_tx = wallet.transactions.find_by(unique_transaction_id: 'anchor-pooled-177108533436536-anc_inb_trsf')
      expect(credit_tx).to be_present
      expect(credit_tx.amount).to eq(BigDecimal('1000.0'))
      expect(credit_tx.status).to eq('approved')

      inbound = InboundBankTransfer.find_by(provider: 'anchor', provider_reference: '177108533436536-anc_inb_trsf')
      expect(inbound).to be_present
      expect(inbound.status).to eq('credited')
      expect(inbound.funding_intent_id).to eq(intent.id)

      expect(intent.reload.status).to eq('credited')
      expect(intent.credited_transaction_id).to eq(credit_tx.id)
    end

    it 'stores unmatched pooled payin for manual review when no funding intent is found' do
      payload = {
        'type' => 'payin.received',
        'attributes' => {
          'payIn' => {
            'id' => 'payin_unmatched',
            'reference' => 'BBG-NOTMAT-0000',
            'amount' => '250000',
            'currency' => 'NGN',
            'narration' => 'Unknown payment'
          }
        }
      }

      service = instance_double(AnchorService)
      allow(AnchorService).to receive(:new).and_return(service)
      allow(service).to receive(:fetch_payin).and_return(status: :bad_request, message: 'not needed')

      expect do
        described_class.call(payload: payload, raw_body: payload.to_json)
      end.not_to change(Transaction, :count)

      inbound = InboundBankTransfer.find_by(provider: 'anchor', provider_reference: 'payin_unmatched')
      expect(inbound).to be_present
      expect(inbound.status).to eq('unmatched')
      expect(inbound.funding_intent_id).to be_nil
      expect(inbound.credited_transaction_id).to be_nil
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
