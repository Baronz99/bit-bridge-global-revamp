# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Receipts', type: :request do
  let(:user) { create(:user, :tier2, :with_pin) }

  it 'does not resolve receipts by transaction id' do
    tx = user.ngn_wallet.transactions.create!(
      transaction_type: :deposit,
      status: :approved,
      coin_type: :bank,
      amount: 50,
      address: 'Test funding'
    )

    get "/api/v1/receipts/placeholder", params: { reference: tx.id }, headers: auth_headers(user)

    expect(response).to have_http_status(:not_found)
  end
end
