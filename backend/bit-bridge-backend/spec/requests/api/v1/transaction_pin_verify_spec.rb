require 'rails_helper'

RSpec.describe 'Transaction PIN verify', type: :request do
  let(:user) { create(:user) }
  let(:headers) { auth_headers(user) }

  before do
    user.set_transaction_pin!('1234')
  end

  it 'verifies correct pin' do
    post '/api/v1/transaction_pin/verify', params: { pin: '1234' }, headers: headers
    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['valid']).to be true
  end

  it 'rejects incorrect pin' do
    post '/api/v1/transaction_pin/verify', params: { pin: '9999' }, headers: headers
    expect(response).to have_http_status(:unprocessable_entity)
    body = JSON.parse(response.body)
    expect(body['valid']).to be false
  end

  it 'requires pin' do
    post '/api/v1/transaction_pin/verify', params: {}, headers: headers
    expect(response).to have_http_status(:unprocessable_entity)
    body = JSON.parse(response.body)
    expect(body['message']).to match(/PIN/i)
  end
end
