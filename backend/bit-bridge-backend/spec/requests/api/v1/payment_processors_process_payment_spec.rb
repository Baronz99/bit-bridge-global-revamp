# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'PaymentProcessors process_payment (TV)', type: :request do
  include AuthHelpers

  before do
    allow(Config::Bills).to receive(:validate!).and_return(true)
    allow(Config::Bills).to receive(:base_url).and_return('http://example.test')
    allow(Config::Bills).to receive(:token).and_return('token')
  end

  it 'uses provider name and stores provider_response for TV' do
    user = create(:user)

    provider_payload = { 'data' => { 'customerName' => 'Verified Customer' }, 'responseCode' => '00' }
    allow_any_instance_of(BuyPowerPaymentService).to receive(:verify_tv_account)
      .and_return({ status: 'success', response: provider_payload })

    headers = auth_headers(user)
    params = {
      billersCode: '1234567890',
      amount: 1000,
      tariff_class: 'A',
      service_type: 'TV',
      biller: 'DSTV',
      email: user.email
    }

    post '/api/v1/payment_processors/process_payment', params: params, headers: headers

    expect(response).to have_http_status(:created)
    data = response.parsed_body['data']
    expect(data['name']).to eq('Verified Customer')
    expect(data['provider_response']).to include('responseCode' => '00')
    order = BillOrder.find(data['id'])
    expect(order.provider_response).to include('responseCode' => '00')
    expect(data['service_charge'].to_f).to eq(0)
    expect(data['total_amount'].to_f).to eq(1000)
  end

  it 'keeps name blank when verify does not return one' do
    user = create(:user)

    allow_any_instance_of(BuyPowerPaymentService).to receive(:verify_tv_account)
      .and_return({ status: 'error', response: { 'message' => 'Invalid decoder', 'responseCode' => 'E01' } })

    headers = auth_headers(user)
    params = {
      billersCode: '0987654321',
      amount: 1500,
      tariff_class: 'A',
      service_type: 'TV',
      biller: 'DSTV',
      email: user.email
    }

    post '/api/v1/payment_processors/process_payment', params: params, headers: headers

    expect(response).to have_http_status(:created)
    data = response.parsed_body['data']
    expect(data['name']).to be_nil
    expect(data['provider_response']).to include('message' => 'Invalid decoder', 'responseCode' => 'E01')
    order = BillOrder.find(data['id'])
    expect(order.provider_response).to include('message' => 'Invalid decoder', 'responseCode' => 'E01')
    expect(data['service_charge'].to_f).to eq(0)
    expect(data['total_amount'].to_f).to eq(1500)
  end
end
