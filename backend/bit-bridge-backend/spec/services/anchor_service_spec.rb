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
  let(:user) { create(:user) }
  let(:wallet) { user.ngn_wallet }
  let(:account) { Account.create!(user: user, useable_id: 'acc_123') }
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

    transaction = Transaction.last
    record = TransactionRecord.last

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

  it 'keeps naira amounts when configured' do
    ENV['ANCHOR_AMOUNT_SCALE'] = 'naira'
    amount, scale = service.send(:normalize_anchor_amount, '1050', 'NGN')

    expect(amount).to eq(BigDecimal('1050'))
    expect(scale).to eq('naira')
  end
end
