# frozen_string_literal: true

require 'rails_helper'

RSpec.describe TimelineQuery do
  describe '#call' do
    let(:user) do
      User.create!(
        email: "timeline-query-#{SecureRandom.hex(6)}@example.com",
        password: 'password123',
        password_confirmation: 'password123'
      )
    end

    before do
      user.ngn_wallet

      BillOrder.create!(
        user: user,
        meter_number: '08012345678',
        address: 'Test Address',
        name: 'Test User',
        tariff_class: 'A',
        service_type: 'VTU',
        email: user.email,
        amount: 1000,
        phone: '08012345678',
        biller: 'MTN',
        description: 'Airtime',
        payment_type: 'online',
        payment_method: 'wallet',
        provider_response: { 'source' => 'anchor_transfer' }
      )
    end

    it 'does not reference bill_orders.metadata when the metadata column is missing' do
      allow(BillOrder).to receive(:column_names).and_return(BillOrder.column_names - ['metadata'])

      query = described_class.new(user: user, limit: 25)
      sql = query.send(:bill_orders_unscoped).to_sql

      expect(sql).not_to include("metadata ->> 'source'")
      expect { query.call }.not_to raise_error
    end

    it 'returns a timeline payload without raising' do
      result = nil

      expect { result = described_class.new(user: user, limit: 25).call }.not_to raise_error
      expect(result).to include(:items, :next_cursor)
      expect(result[:items]).to be_an(Array)
    end

    it 'excludes anchor transfer hold bill rows by description when metadata column is missing' do
      allow(BillOrder).to receive(:column_names).and_return(BillOrder.column_names - ['metadata'])

      BillOrder.create!(
        user: user,
        meter_number: '08012345679',
        address: 'Hold Address',
        name: 'Hold User',
        tariff_class: 'A',
        service_type: 'TRANSFER',
        email: user.email,
        amount: 1035,
        phone: '08012345679',
        biller: 'ANCHOR',
        description: 'Anchor NGN transfer hold',
        payment_type: 'online',
        payment_method: 'wallet',
        provider_response: {}
      )

      result = described_class.new(user: user, limit: 25).call
      bill_labels = result[:items].select { |item| item[:kind] == 'bill_order' }.map { |item| item[:label] }

      expect(bill_labels).not_to include('Anchor NGN transfer hold')
    end

    it 'keeps pending anchor checkout initialization visible before settlement' do
      tx = user.ngn_wallet.transactions.create!(
        status: :initialized,
        coin_type: :mobile_bank,
        transaction_type: :deposit,
        amount: 1000,
        metadata: { provider: 'anchor', purpose: 'wallet_fund', subtype: 'principal' }
      )

      result = described_class.new(user: user, limit: 25).call
      timeline_ids = result[:items].map { |item| item[:id] }

      expect(timeline_ids).to include("wallet-tx-#{tx.id}")
    end
    it 'includes pooled funding deposits with nil subtype in timeline feed' do
      tx = user.ngn_wallet.transactions.create!(
        status: :approved,
        coin_type: :bank,
        transaction_type: :deposit,
        amount: 1500,
        metadata: { provider: 'anchor', purpose: 'wallet_fund_pooled' }
      )

      result = described_class.new(user: user, limit: 25).call
      timeline_ids = result[:items].map { |item| item[:id] }

      expect(timeline_ids).to include("wallet-tx-#{tx.id}")
    end
    it 'hides settled anchor checkout initialization and keeps settled deposit entry' do
      initialized_tx = user.ngn_wallet.transactions.create!(
        status: :initialized,
        coin_type: :mobile_bank,
        transaction_type: :deposit,
        amount: 1000,
        metadata: {
          provider: 'anchor',
          purpose: 'wallet_fund',
          checkout_state: 'settled',
          subtype: 'principal'
        }
      )

      settled_tx = user.ngn_wallet.transactions.create!(
        status: :approved,
        coin_type: :bank,
        transaction_type: :deposit,
        amount: 1000,
        metadata: { provider: 'anchor', purpose: 'wallet_fund', subtype: 'principal' }
      )

      result = described_class.new(user: user, limit: 25).call
      timeline_ids = result[:items].map { |item| item[:id] }

      expect(timeline_ids).not_to include("wallet-tx-#{initialized_tx.id}")
      expect(timeline_ids).to include("wallet-tx-#{settled_tx.id}")
    end

    it 'filters cards type at query level' do
      CardEvent.create!(
        user: user,
        event: 'card.authorization',
        card_id: 'provider-card-1',
        amount: 500,
        status: 'successful',
        transaction_at: Time.current
      )
      user.ngn_wallet.transactions.create!(
        status: :approved,
        coin_type: :bank,
        transaction_type: :deposit,
        amount: 2500
      )

      result = described_class.new(user: user, type: 'cards', limit: 25).call
      kinds = result[:items].map { |item| item[:kind] }.uniq

      expect(kinds).to eq(['card_event'])
    end

    it 'keeps card event amount in cents when metadata indicates provider minor units' do
      event =
        CardEvent.create!(
          user: user,
          event: 'card.authorization',
          card_id: 'provider-card-2',
          amount: 1900,
          status: 'successful',
          transaction_at: Time.current,
          metadata: { principal_usd: 19.0, total_debit_usd: 20.0 }
        )

      result = described_class.new(user: user, type: 'cards', limit: 25).call
      item = result[:items].find { |entry| entry[:id] == "card-evt-#{event.id}" }

      expect(item).to be_present
      expect(item[:amount_cents]).to eq(1900)
    end

    it 'normalizes inbound bank transfer title for timeline wallet items' do
      tx = user.ngn_wallet.transactions.create!(
        status: :approved,
        coin_type: :bank,
        transaction_type: :deposit,
        amount: 2500,
        address: 'NIP transfer to 0123456789',
        metadata: { provider: 'anchor', purpose: 'wallet_fund' }
      )
      tx.create_transaction_record!(
        reference: 'fbg-10001',
        status: 'approved',
        event_type: 'anchor.webhook.payment.settled',
        description: 'NIP transfer to 0123456789'
      )

      result = described_class.new(user: user, limit: 25).call
      item = result[:items].find { |entry| entry[:id] == "wallet-tx-#{tx.id}" }

      expect(item).to be_present
      expect(item[:label]).to eq('Incoming bank transfer')
    end

    it 'uses sender name (not account number) for wallet deposit fallback label' do
      tx = user.ngn_wallet.transactions.create!(
        status: :approved,
        coin_type: :bank,
        transaction_type: :deposit,
        amount: 1200,
        address: '0123456789',
        metadata: {}
      )
      tx.create_transaction_record!(
        reference: 'misc-deposit-1',
        status: 'approved',
        event_type: 'manual.deposit',
        customer_name: 'Ada Sender',
        description: nil
      )

      result = described_class.new(user: user, limit: 25).call
      item = result[:items].find { |entry| entry[:id] == "wallet-tx-#{tx.id}" }

      expect(item).to be_present
      expect(item[:label]).to eq('Wallet deposit from Ada Sender')
      expect(item[:label]).not_to include('0123456789')
    end
  end
end
