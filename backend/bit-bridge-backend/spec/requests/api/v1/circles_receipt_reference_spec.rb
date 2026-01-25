# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Circle receipt references', type: :request do
  let(:user) { create(:user, :tier2, :with_pin) }
  let(:headers) { auth_headers(user) }

  it 'does not expose wallet transaction id as receipt reference' do
    circle = Circle.create!(name: 'Alpha', owner: user)
    CircleMembership.create!(circle: circle, user: user, role: :admin)

    wallet_tx = user.ngn_wallet.transactions.create!(
      transaction_type: :deposit,
      status: :approved,
      coin_type: :bank,
      amount: 10,
      address: 'Test funding'
    )

    circle_tx = circle.circle_transactions.create!(
      user: user,
      amount_cents: 1000,
      direction: :credit,
      kind: 'fund',
      description: 'Fund',
      wallet_transaction_id: wallet_tx.id
    )

    get "/api/v1/circles/#{circle.id}", headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    recent = body['recent_transactions'].find { |tx| tx['id'] == circle_tx.id }

    expect(recent['wallet_transaction_reference']).to be_nil
    expect(recent['wallet_transaction_reference']).not_to eq(wallet_tx.id)
  end
end
