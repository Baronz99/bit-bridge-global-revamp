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
      expect(WalletLedgerEntry.where(bill_order: bill_order).hold.count).to eq(1)
      expect(WalletLedgerEntry.where(bill_order: bill_order).release.count).to eq(1)
      expect(WalletLedgerEntry.where(bill_order: bill_order).debit.count).to eq(1)
    end

    it 'applies commission once for VTU and does not double-apply on retry' do
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
      wallet.update!(commission: 0)
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

      described_class.new.confirm_subscription(bill_order, 'wallet', false, request_id: 'spec')
      expect(wallet.reload.commission.to_f).to eq(10.0)

      expect do
        described_class.new.confirm_subscription(bill_order, 'wallet', false, request_id: 'spec')
      end.not_to change { wallet.reload.commission }
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

    it 'does not decline card/online orders when vend fails' do
      allow(Config::Bills).to receive(:validate!).and_return(true)
      allow(Config::Bills).to receive(:base_url).and_return('http://example.test')
      allow(Config::Bills).to receive(:token).and_return('token')

      response = { 'message' => 'Vend failed' }
      def response.success?
        false
      end

      allow(described_class).to receive(:post).and_return(response)

      user = create(:user)
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
        payment_method: 'card'
      )

      result = described_class.new.confirm_subscription(bill_order, 'card', false, request_id: 'spec')

      expect(result[:status]).to eq('error')
      expect(bill_order.reload.status).to eq('initialized')
      expect(bill_order.reason).to include('Vend failed')
    end

    it 'does not apply commission for non-VTU/DATA orders' do
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
      wallet.update!(commission: 0)
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
        service_type: 'TV',
        email: user.email,
        amount: 1000,
        phone: '08012345678',
        biller: 'DSTV',
        description: 'TV',
        payment_type: 'online',
        payment_method: 'wallet'
      )

      described_class.new.confirm_subscription(bill_order, 'wallet', false, request_id: 'spec')
      expect(wallet.reload.commission.to_f).to eq(0.0)
    end

    it 'keeps wallet orders processing on non-terminal provider response' do
      allow(Config::Bills).to receive(:validate!).and_return(true)
      allow(Config::Bills).to receive(:base_url).and_return('http://example.test')
      allow(Config::Bills).to receive(:token).and_return('token')

      response = { 'message' => 'Provider timeout' }
      def response.success?
        false
      end

      allow(described_class).to receive(:post).and_return(response)

      user = create(:user)
      wallet = user.wallet
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

      expect(result[:status]).to eq('pending')
      expect(bill_order.reload.status).to eq('processing')
      expect(WalletLedgerEntry.where(bill_order: bill_order).hold.count).to eq(1)
      expect(WalletLedgerEntry.where(bill_order: bill_order).release.count).to eq(0)
    end

    it 'releases hold on provider refund response' do
      allow(Config::Bills).to receive(:validate!).and_return(true)
      allow(Config::Bills).to receive(:base_url).and_return('http://example.test')
      allow(Config::Bills).to receive(:token).and_return('token')

      response = { 'data' => { 'status' => 'REFUNDED' }, 'message' => 'Refunded' }
      def response.success?
        false
      end

      allow(described_class).to receive(:post).and_return(response)

      user = create(:user)
      wallet = user.wallet
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

      expect(result[:status]).to eq('error')
      expect(bill_order.reload.status).to eq('refunded')
      expect(WalletLedgerEntry.where(bill_order: bill_order).release.count).to eq(1)
      expect(WalletLedgerEntry.where(bill_order: bill_order).refund.count).to eq(1)
    end
  end
end
