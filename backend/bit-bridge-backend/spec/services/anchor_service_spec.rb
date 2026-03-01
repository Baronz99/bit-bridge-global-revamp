# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AnchorService do
  around do |example|
    original_base = ENV['ANCHOR_BASE_URL']
    original_key = ENV['ANCHOR_API_KEY']
    original_scale = ENV['ANCHOR_AMOUNT_SCALE']
    ENV['ANCHOR_BASE_URL'] = 'http://example.com'
    ENV['ANCHOR_API_KEY'] = 'test-key'
    ENV['ANCHOR_AMOUNT_SCALE'] = nil
    example.run
  ensure
    ENV['ANCHOR_BASE_URL'] = original_base
    ENV['ANCHOR_API_KEY'] = original_key
    ENV['ANCHOR_AMOUNT_SCALE'] = original_scale
  end

  let(:service) { described_class.new }
  let(:user) { create(:user, email: "anchor-#{SecureRandom.hex(6)}@example.com") }
  let(:wallet) { user.ngn_wallet }
  let(:account) { Account.create!(user: user, useable_id: 'acc_123', vendor: 'anchor') }
  let(:transfer_id) { 'tr_in_123' }

  it 'persists inbound transfers and is idempotent for the same reference' do
    wallet
    account
    response = double('response', success?: true)
    allow(response).to receive(:dig) do |*args|
      data = {
        'relationships' => { 'account' => { 'data' => { 'id' => account.useable_id } } },
        'attributes' => {
          'amount' => '15000',
          'currency' => 'NGN',
          'sourceAccountName' => 'Jane Doe',
          'sourceAccountNumber' => '0123456789',
          'sourceBank' => { 'name' => 'Test Bank' }
        }
      }
      data.dig(*args)
    end

    allow(described_class).to receive(:get).and_return(response)

    expect do
      service.get_inbound_transfer(transfer_id)
    end.to change(Transaction, :count).by(1)
      .and change(TransactionRecord, :count).by(1)

    record = TransactionRecord.find_by(reference: transfer_id)
    transaction = record&.exchange

    expect(record.reference).to eq(transfer_id)
    expect(record.exchange).to eq(transaction)

    expect do
      service.get_inbound_transfer(transfer_id)
    end.not_to change(Transaction, :count)
  end

  it 'normalizes anchor kobo amounts' do
    ENV['ANCHOR_AMOUNT_SCALE'] = 'kobo'
    amount, scale = service.send(:normalize_anchor_amount, '1050', 'NGN')

    expect(amount).to eq(BigDecimal('10.50'))
    expect(scale).to eq('kobo')
  end

  it 'sets anchor webhook event_type on payment settled' do
    account = Account.create!(user: user, useable_id: 'acc_999', vendor: 'anchor')
    user.ngn_wallet
    payload = {
      'attributes' => {
        'payment' => {
          'settlementAccount' => { 'accountId' => account.useable_id },
          'paymentId' => 'pay_001',
          'amount' => '1500',
          'currency' => 'NGN',
          'virtualNuban' => { 'accountNumber' => '0123456789', 'accountName' => 'Receiver' },
          'narration' => 'Test',
          'counterParty' => {
            'accountNumber' => '1234567890',
            'accountName' => 'Sender',
            'bank' => { 'name' => 'Test Bank' }
          },
          'paymentReference' => 'anchor-ref-1'
        }
      }
    }

    service.fund_deposit_account(payload)
    record = TransactionRecord.find_by(transaction_id: 'pay_001')
    expect(record).to be_present
    expect(record.event_type).to start_with('anchor.webhook')
    expect(record.reference).to eq('pay_001')
    expect(record.exchange.metadata['provider']).to eq('anchor')
    expect(record.exchange.metadata['anchor_payment_reference']).to eq('anchor-ref-1')
    expect(record.exchange.metadata.dig('anchor_sender', 'bank_name')).to eq('Test Bank')
  end

  it 'credits two distinct inbound payments even when paymentReference is reused' do
    account = Account.create!(user: user, useable_id: 'acc_dup', vendor: 'anchor')
    user.ngn_wallet

    first_payload = {
      'attributes' => {
        'payment' => {
          'settlementAccount' => { 'accountId' => account.useable_id },
          'paymentId' => 'pay_dup_1',
          'paymentReference' => 'same-ref-1',
          'amount' => '1000',
          'currency' => 'NGN',
          'virtualNuban' => { 'accountNumber' => '0000000001', 'accountName' => 'Receiver' },
          'counterParty' => { 'accountNumber' => '1234567890', 'accountName' => 'Sender', 'bank' => { 'name' => 'Test Bank' } }
        }
      }
    }

    second_payload = {
      'attributes' => {
        'payment' => {
          'settlementAccount' => { 'accountId' => account.useable_id },
          'paymentId' => 'pay_dup_2',
          'paymentReference' => 'same-ref-1',
          'amount' => '2000',
          'currency' => 'NGN',
          'virtualNuban' => { 'accountNumber' => '0000000001', 'accountName' => 'Receiver' },
          'counterParty' => { 'accountNumber' => '1234567890', 'accountName' => 'Sender', 'bank' => { 'name' => 'Test Bank' } }
        }
      }
    }

    expect do
      service.fund_deposit_account(first_payload)
      service.fund_deposit_account(second_payload)
    end.to change(Transaction, :count).by(2)
      .and change(TransactionRecord, :count).by(2)

    expect(TransactionRecord.find_by(transaction_id: 'pay_dup_1')).to be_present
    expect(TransactionRecord.find_by(transaction_id: 'pay_dup_2')).to be_present
  end
  it 'does not collide with a legacy record keyed only by paymentReference when paymentId is present' do
    account = Account.create!(user: user, useable_id: 'acc_legacy_ref', vendor: 'anchor')
    user.ngn_wallet

    legacy_tx = wallet.transactions.create!(
      status: :approved,
      transaction_type: :deposit,
      coin_type: :bank,
      amount: 10
    )
    TransactionRecord.create!(
      exchange: legacy_tx,
      reference: 'legacy-ref-1',
      status: 'approved',
      event_type: 'anchor.webhook.payment.settled'
    )

    payload = {
      'attributes' => {
        'payment' => {
          'settlementAccount' => { 'accountId' => account.useable_id },
          'paymentId' => 'pay_new_1',
          'paymentReference' => 'legacy-ref-1',
          'amount' => '2500',
          'currency' => 'NGN',
          'virtualNuban' => { 'accountNumber' => '0000000002', 'accountName' => 'Receiver' },
          'counterParty' => { 'accountNumber' => '1234567890', 'accountName' => 'Sender', 'bank' => { 'name' => 'Test Bank' } }
        }
      }
    }

    expect do
      service.fund_deposit_account(payload)
    end.to change(Transaction, :count).by(1)
      .and change(TransactionRecord, :count).by(1)

    new_record = TransactionRecord.find_by(transaction_id: 'pay_new_1')
    expect(new_record).to be_present
    expect(new_record.reference).to eq('pay_new_1')
    expect(new_record.exchange).to be_present
    expect(new_record.exchange.id).not_to eq(legacy_tx.id)
  end


  it 'keeps naira amounts when configured' do
    ENV['ANCHOR_AMOUNT_SCALE'] = 'naira'
    amount, scale = service.send(:normalize_anchor_amount, '1050', 'NGN')

    expect(amount).to eq(BigDecimal('1050'))
    expect(scale).to eq('naira')
  end

  it 'calls /api/v1 payments verify-account endpoint for account resolution' do
    response = double('response', success?: true, message: 'OK')
    allow(response).to receive(:[]).and_return(nil)
    allow(described_class).to receive(:get).and_return(response)

    result = service.verify_account_details('000013', '0210998196')

    expect(described_class).to have_received(:get)
      .with(
        '/api/v1/payments/verify-account/000013/0210998196',
        hash_including(headers: anything, open_timeout: 3, timeout: 5)
      )
    expect(result[:status]).to eq(:ok)
  end

  it 'surfaces provider error detail for account resolution failures' do
    response = double('response', success?: false, message: 'Not Found')
    allow(response).to receive(:dig).with('errors', 0, 'detail').and_return('Endpoint not found')
    allow(response).to receive(:[]).with('message').and_return(nil)
    allow(described_class).to receive(:get).and_return(response)

    result = service.verify_account_details('000013', '0210998196')

    expect(result[:status]).to eq(:bad_request)
    expect(result[:message]).to eq('Endpoint not found')
  end

  it 'sends digits-only anchor phone number when creating individual customer' do
    allow(service).to receive(:store_account_details).and_return(double('account'))
    response = double('response', success?: true)
    allow(response).to receive(:[]).with('data').and_return({ 'id' => 'cust_123' })

    posted_body = nil
    allow(described_class).to receive(:post) do |_path, headers:, body:|
      posted_body = JSON.parse(body)
      response
    end

    result = service.create_individual_account(
      first_name: 'Ada',
      last_name: 'Lovelace',
      user_id: user.id,
      email: 'ada@example.com',
      postal_code: '100001',
      city: 'Lagos',
      state: 'Lagos',
      phone_number: '+2348102312186',
      address: '42 Marina'
    )

    expect(result[:status]).to eq(:ok)
    expect(posted_body.dig('data', 'attributes', 'phoneNumber')).to eq('2348102312186')
  end
end
