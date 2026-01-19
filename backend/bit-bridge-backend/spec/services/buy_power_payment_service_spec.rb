# frozen_string_literal: true

require 'rails_helper'

RSpec.describe BuyPowerPaymentService do
  describe '#confirm_subscription' do
    it 'returns success when wallet commission is nil and vend succeeds' do
      allow(Config::Bills).to receive(:validate!).and_return(true)
      allow(Config::Bills).to receive(:base_url).and_return('http://example.test')
      allow(Config::Bills).to receive(:token).and_return('token')

      response = {
        'data' => { 'units' => '1', 'token' => 'abc', 'id' => 'txn_1' },
        'message' => 'OK'
      }
      def response.success?
        true
      end

      allow(described_class).to receive(:post).and_return(response)

      user = create(:user)
      wallet = user.wallet
      wallet.update!(commission: nil)
      Transaction.create!(
        wallet: wallet,
        amount: 10_000,
        bonus: 0,
        status: :approved,
        transaction_type: :deposit
      )

      bill_order = BillOrder.create!(
        user: user,
        meter_number: '08012345678',
        meter_type: 'PREPAID',
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
        payment_method: 'wallet'
      )

      result = described_class.new.confirm_subscription(bill_order, 'wallet', false, request_id: 'spec')

      expect(result[:status]).to eq('success')
      expect(bill_order.reload.status).to eq('completed')
    end

    it 'treats use_commission "false" as false for balance checks' do
      allow(Config::Bills).to receive(:validate!).and_return(true)
      allow(Config::Bills).to receive(:base_url).and_return('http://example.test')
      allow(Config::Bills).to receive(:token).and_return('token')

      user = create(:user)
      wallet = user.wallet
      wallet.update!(commission: 0)
      Transaction.create!(
        wallet: wallet,
        amount: 50,
        bonus: 0,
        status: :approved,
        transaction_type: :deposit
      )

      bill_order = BillOrder.create!(
        user: user,
        meter_number: '08012345678',
        meter_type: 'PREPAID',
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
        payment_method: 'wallet'
      )

      expect(described_class).not_to receive(:post)
      result = described_class.new.confirm_subscription(bill_order, 'wallet', 'false', request_id: 'spec')

      expect(result[:status]).to eq('error')
      expect(result[:response]).to eq('Insufficient funds')
    end

    it 'treats use_commission false as false for balance checks' do
      allow(Config::Bills).to receive(:validate!).and_return(true)
      allow(Config::Bills).to receive(:base_url).and_return('http://example.test')
      allow(Config::Bills).to receive(:token).and_return('token')

      user = create(:user)
      wallet = user.wallet
      wallet.update!(commission: 0)
      Transaction.create!(
        wallet: wallet,
        amount: 50,
        bonus: 0,
        status: :approved,
        transaction_type: :deposit
      )

      bill_order = BillOrder.create!(
        user: user,
        meter_number: '08012345678',
        meter_type: 'PREPAID',
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
        payment_method: 'wallet'
      )

      expect(described_class).not_to receive(:post)
      result = described_class.new.confirm_subscription(bill_order, 'wallet', false, request_id: 'spec')

      expect(result[:status]).to eq('error')
      expect(result[:response]).to eq('Insufficient funds')
    end
  end
end
