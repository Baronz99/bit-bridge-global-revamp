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
  end
end
