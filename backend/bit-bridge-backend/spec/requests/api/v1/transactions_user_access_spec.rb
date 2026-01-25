# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Transactions user access', type: :request do
  it 'allows a normal user to fetch their transactions' do
    user = create(:user)
    wallet = user.ngn_wallet
    wallet.transactions.create!(
      transaction_type: 'deposit',
      status: 'approved',
      amount: 100,
      coin_type: 'bank',
      address: 'Seed'
    )

    get '/api/v1/transactions/user', headers: auth_headers(user)

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['data']).to be_an(Array)
  end
end
