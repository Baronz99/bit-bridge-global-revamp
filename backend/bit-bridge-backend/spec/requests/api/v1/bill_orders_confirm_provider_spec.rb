# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'BillOrders confirm with provider 5xx', type: :request do
  let(:user) { create(:user) }
  let(:wallet) { user.wallet }

  before do
    allow(Config::Bills).to receive(:validate!).and_return(true)
    allow(Config::Bills).to receive(:base_url).and_return('http://example.test')
    allow(Config::Bills).to receive(:token).and_return('token')
    WalletLedgerEntry.destroy_all
    Transaction.create!(wallet: wallet, amount: 10_000, bonus: 0, status: :approved, transaction_type: :deposit)
  end

  def provider_500_response
    Class.new do
      def success? = false
      def code = 500
      def dig(*keys)
        keys == ['message'] ? 'Unexpected error' : nil
      end
      def [](key)
        key.to_s == 'message' ? 'Unexpected error' : nil
      end
    end.new
  end

  def provider_400_meter_response
    Class.new do
      def success? = false
      def code = 400
      def dig(*keys)
        keys == ['message'] ? 'Invalid Meter Number. "meter" is required' : nil
      end
      def [](key)
        key.to_s == 'message' ? 'Invalid Meter Number. "meter" is required' : nil
      end
    end.new
  end

  def provider_200_vtu_success
    Class.new do
      def success? = true
      def code = 200
      def to_h
        { 'message' => 'Successful', 'data' => { 'id' => 'txn_vtu', 'responseCode' => 100, 'token' => 'abc', 'units' => '1' } }
      end
      def dig(*keys)
        to_h.dig(*keys)
      end
      def [](key)
        to_h[key] || to_h[key.to_s]
      end
    end.new
  end

  def provider_200_data_success
    Class.new do
      def success? = true
      def code = 200
      def to_h
        { 'message' => 'Successful', 'data' => { 'id' => 'txn_data', 'responseCode' => 100, 'token' => 'abc', 'units' => '1' } }
      end
      def dig(*keys)
        to_h.dig(*keys)
      end
      def [](key)
        to_h[key] || to_h[key.to_s]
      end
    end.new
  end

  it 'returns 503 and does not double-refund on repeated confirm' do
    bill_order = BillOrder.create!(
      user: user,
      meter_number: '08012345678',
      meter_type: nil,
      address: 'Test Address',
      name: 'Test User',
      tariff_class: nil,
      service_type: 'VTU',
      email: user.email,
      amount: 1000,
      phone: '08012345678',
      biller: 'MTN',
      description: 'Airtime',
      payment_type: 'online',
      payment_method: 'wallet'
    )

    expect(BuyPowerPaymentService).to receive(:post).with('/vend', anything).and_return(provider_500_response)

    headers = auth_headers(user)
    params = { bill_order: { payment_method: 'wallet', use_commission: false } }

    patch "/api/v1/bill_orders/#{bill_order.id}/confirm_bill_payment", params: params, headers: headers
    expect(response.status).to eq(503)
    expect(JSON.parse(response.body)['message']).to include('Provider temporarily unavailable')

    bill_order.reload
    expect(bill_order.status).to eq('failed')
    expect(WalletLedgerEntry.where(bill_order: bill_order, entry_type: :hold).count).to eq(1)
    expect(WalletLedgerEntry.where(bill_order: bill_order, entry_type: :release).count).to eq(1)
    expect(WalletLedgerEntry.where(bill_order: bill_order, entry_type: :refund).count).to eq(0)

    # second attempt should not create extra releases/refunds
    patch "/api/v1/bill_orders/#{bill_order.id}/confirm_bill_payment", params: params, headers: headers
    bill_order.reload
    expect(WalletLedgerEntry.where(bill_order: bill_order, entry_type: :release).count).to eq(1)
    expect(WalletLedgerEntry.where(bill_order: bill_order, entry_type: :refund).count).to eq(0)
  end

  it 'normalizes meter missing error for VTU to phone number required and releases hold' do
    bill_order = BillOrder.create!(
      user: user,
      meter_number: '08012345678',
      meter_type: nil,
      address: 'Test Address',
      name: 'Test User',
      tariff_class: nil,
      service_type: 'VTU',
      email: user.email,
      amount: 1000,
      phone: '08012345678',
      biller: 'MTN',
      description: 'Airtime',
      payment_type: 'online',
      payment_method: 'wallet'
    )

    expect(BuyPowerPaymentService).to receive(:post).with('/vend', anything).and_return(provider_400_meter_response)

    headers = auth_headers(user)
    params = { bill_order: { payment_method: 'wallet', use_commission: false } }

    patch "/api/v1/bill_orders/#{bill_order.id}/confirm_bill_payment", params: params, headers: headers
    expect(response.status).to eq(422)
    expect(JSON.parse(response.body)['message']).to eq('Phone number is required')

    bill_order.reload
    expect(bill_order.status).to eq('failed')
    expect(WalletLedgerEntry.where(bill_order: bill_order, entry_type: :hold).count).to eq(1)
    expect(WalletLedgerEntry.where(bill_order: bill_order, entry_type: :release).count).to eq(1)
  end

  it 'normalizes meter missing error for DATA to phone number required and releases hold' do
    bill_order = BillOrder.create!(
      user: user,
      meter_number: '08012345678',
      meter_type: nil,
      address: 'Test Address',
      name: 'Test User',
      tariff_class: 'SME',
      service_type: 'DATA',
      email: user.email,
      amount: 1000,
      phone: '08012345678',
      biller: 'MTN',
      description: 'Data',
      payment_type: 'online',
      payment_method: 'wallet'
    )

    expect(BuyPowerPaymentService).to receive(:post).with('/vend', anything).and_return(provider_400_meter_response)

    headers = auth_headers(user)
    params = { bill_order: { payment_method: 'wallet', use_commission: false } }

    patch "/api/v1/bill_orders/#{bill_order.id}/confirm_bill_payment", params: params, headers: headers
    expect(response.status).to eq(422)
    expect(JSON.parse(response.body)['message']).to eq('Phone number is required')

    bill_order.reload
    expect(bill_order.status).to eq('failed')
    expect(WalletLedgerEntry.where(bill_order: bill_order, entry_type: :hold).count).to eq(1)
    expect(WalletLedgerEntry.where(bill_order: bill_order, entry_type: :release).count).to eq(1)
  end

  it 'completes VTU vend via /vend without meter_number when provider returns responseCode 100' do
    bill_order = BillOrder.create!(
      user: user,
      meter_number: nil,
      meter_type: 'PREPAID',
      address: 'Test Address',
      name: 'Test User',
      tariff_class: nil,
      service_type: 'VTU',
      email: user.email,
      amount: 1000,
      phone: '08012345678',
      biller: 'MTN',
      description: 'Airtime',
      payment_type: 'online',
      payment_method: 'wallet'
    )

    expect(BuyPowerPaymentService).to receive(:post).with('/vend', satisfy { |payload| payload[:body].is_a?(Hash) && payload[:body][:vendType] == 'PREPAID' }).and_return(provider_200_vtu_success)

    headers = auth_headers(user)
    params = { bill_order: { payment_method: 'wallet', use_commission: false } }

    patch "/api/v1/bill_orders/#{bill_order.id}/confirm_bill_payment", params: params, headers: headers
    expect(response.status).to eq(200)

    bill_order.reload
    expect(bill_order.status).to eq('completed')
    expect(bill_order.provider_reference).to eq('txn_vtu')
  end

  it 'completes DATA vend via /vend when provider returns responseCode 100' do
    bill_order = BillOrder.create!(
      user: user,
      meter_number: '08012345678',
      meter_type: nil,
      address: 'Test Address',
      name: 'Test User',
      tariff_class: 'SME',
      service_type: 'DATA',
      email: user.email,
      amount: 1000,
      phone: '08012345678',
      biller: 'MTN',
      description: 'Data',
      payment_type: 'online',
      payment_method: 'wallet'
    )

    expect(BuyPowerPaymentService).to receive(:post).with('/vend', satisfy { |payload| payload[:body].is_a?(Hash) && payload[:body][:vendType] == 'PREPAID' }).and_return(provider_200_data_success)

    headers = auth_headers(user)
    params = { bill_order: { payment_method: 'wallet', use_commission: false } }

    patch "/api/v1/bill_orders/#{bill_order.id}/confirm_bill_payment", params: params, headers: headers
    expect(response.status).to eq(200)

    bill_order.reload
    expect(bill_order.status).to eq('completed')
    expect(bill_order.provider_reference).to eq('txn_data')
  end
end
