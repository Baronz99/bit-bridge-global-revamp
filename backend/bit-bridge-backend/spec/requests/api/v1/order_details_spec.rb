require 'rails_helper'

RSpec.describe 'OrderDetails', type: :request do
  let(:user) { create(:user) }
  let(:headers) { auth_headers(user) }
  let(:payload) { { order_detail: { order_type: 'VTU' } } }

  describe 'POST /api/v1/order_details' do
    it 'creates VTU order with normalized order_type' do
      post '/api/v1/order_details', params: payload, headers: headers

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body.dig('data', 'order_type')).to eq('vtu')
    end

    it 'creates VTU when legacy service_type is sent' do
      post '/api/v1/order_details',
           params: { order_detail: { service_type: 'UTILITY' } },
           headers: headers

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body.dig('data', 'order_type')).to eq('vtu')
    end

    it 'returns 422 on invalid order_type' do
      post '/api/v1/order_details',
           params: { order_detail: { order_type: 'foobar' } },
           headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body['message']).to match(/Invalid order_type/i)
    end

    it 'returns 422 when order_type missing' do
      post '/api/v1/order_details',
           params: { order_detail: { extra_info: 'none' } },
           headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body['message']).to match(/Invalid order_type/i)
    end
  end
end
"
    it 'returns 422 for invalid amount strings instead of 500' do
      post '/api/v1/order_details',
           params: {
             order_detail: {
               order_type: 'VTU',
               order_items_attributes: [{ amount: 'abc', currency: 'ngn' }]
             }
           },
           headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body['message']).to match(/invalid/i)
    end
"
