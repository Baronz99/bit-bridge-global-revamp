# frozen_string_literal: true

require 'rails_helper'

RSpec.describe TransactionSerializer, type: :serializer do
  let(:user) { create(:user, :tier2) }

  def build_transaction(attrs = {})
    user.ngn_wallet.transactions.create!(
      {
        transaction_type: :deposit,
        status: :approved,
        coin_type: :bank,
        amount: 25,
        address: 'Test funding'
      }.merge(attrs)
    )
  end

  it 'uses transaction_record reference when present' do
    tx = build_transaction
    record = TransactionRecord.create!(
      exchange_id: tx.id,
      reference: 'fbg-9001',
      status: 'pending',
      event_type: 'checkout.init'
    )

    payload = described_class.new(tx).as_json
    expect(payload[:reference]).to eq(record.reference)
  end

  it 'falls back to transfer_id when no record exists' do
    tx = build_transaction(transfer_id: 'trf-123')

    payload = described_class.new(tx).as_json
    expect(payload[:reference]).to eq('trf-123')
  end

  it 'returns nil when neither record nor transfer_id exists' do
    tx = build_transaction

    payload = described_class.new(tx).as_json
    expect(payload[:reference]).to be_nil
  end
end
