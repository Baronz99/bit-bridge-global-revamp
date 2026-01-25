# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Circle Money Flow', type: :request do
  def create_circle_for(user, balance_cents: nil)
    attrs = { name: 'Alpha', owner: user }
    attrs[:balance_cents] = balance_cents if balance_cents
    circle = Circle.create!(**attrs)
    CircleMembership.create!(circle: circle, user: user, role: :admin)
    circle
  end

  describe 'POST /api/v1/circles/:id/fund' do
    it 'returns 401 when no auth header' do
      circle = Circle.create!(name: 'Alpha', owner: create(:user))

      post "/api/v1/circles/#{circle.id}/fund", params: { amount_cents: 1000 }

      expect(response).to have_http_status(:unauthorized)
    end

    it 'returns 403 when user is not tier2' do
      user = create(:user)
      circle = create_circle_for(user)

      post "/api/v1/circles/#{circle.id}/fund",
           params: { amount_cents: 1000, pin: '1234' },
           headers: auth_headers(user)

      expect(response).to have_http_status(:forbidden)
    end

    it 'returns 403 when transaction PIN not set' do
      user = create(:user, :tier2)
      circle = create_circle_for(user)

      post "/api/v1/circles/#{circle.id}/fund",
           params: { amount_cents: 1000, pin: '1234' },
           headers: auth_headers(user)

      expect(response).to have_http_status(:forbidden)
    end

    it 'returns 422 when PIN is missing or invalid' do
      user = create(:user, :tier2, :with_pin)
      circle = create_circle_for(user)

      post "/api/v1/circles/#{circle.id}/fund",
           params: { amount_cents: 1000 },
           headers: auth_headers(user)

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it 'returns 200 on success' do
      user = create(:user, :tier2, :with_pin)
      circle = create_circle_for(user)
      wallet = user.ngn_wallet
      wallet.transactions.create!(
        transaction_type: :deposit,
        status: :approved,
        coin_type: :bank,
        amount: 100
      )

      post "/api/v1/circles/#{circle.id}/fund",
           params: { amount_cents: 1000, pin: '1234' },
           headers: auth_headers(user)

      expect(response).to have_http_status(:ok)
    end

    it 'is idempotent with idempotency_key' do
      user = create(:user, :tier2, :with_pin)
      circle = create_circle_for(user)
      wallet = user.ngn_wallet
      wallet.transactions.create!(
        transaction_type: :deposit,
        status: :approved,
        coin_type: :bank,
        amount: 100
      )

      key = 'idem-123'
      post "/api/v1/circles/#{circle.id}/fund",
           params: { amount_cents: 1000, pin: '1234', idempotency_key: key },
           headers: auth_headers(user)

      expect(response).to have_http_status(:ok)
      first_balance = circle.reload.balance_cents
      tx_count = circle.circle_transactions.count
      wallet_tx_count = wallet.transactions.count

      post "/api/v1/circles/#{circle.id}/fund",
           params: { amount_cents: 1000, pin: '1234', idempotency_key: key },
           headers: auth_headers(user)

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['replayed']).to eq(true)
      expect(circle.reload.balance_cents).to eq(first_balance)
      expect(circle.circle_transactions.count).to eq(tx_count)
      expect(wallet.transactions.count).to eq(wallet_tx_count)
    end

  end

  describe 'POST /api/v1/circles/:id/withdraw' do
    it 'returns 401 when no auth header' do
      circle = Circle.create!(name: 'Alpha', owner: create(:user))

      post "/api/v1/circles/#{circle.id}/withdraw", params: { amount_cents: 1000 }

      expect(response).to have_http_status(:unauthorized)
    end

    it 'returns 403 when user is not tier2' do
      user = create(:user)
      circle = create_circle_for(user, balance_cents: 5000)

      post "/api/v1/circles/#{circle.id}/withdraw",
           params: { amount_cents: 1000, pin: '1234' },
           headers: auth_headers(user)

      expect(response).to have_http_status(:forbidden)
    end

    it 'returns 403 when transaction PIN not set' do
      user = create(:user, :tier2)
      circle = create_circle_for(user, balance_cents: 5000)

      post "/api/v1/circles/#{circle.id}/withdraw",
           params: { amount_cents: 1000, pin: '1234' },
           headers: auth_headers(user)

      expect(response).to have_http_status(:forbidden)
    end

    it 'returns 422 when PIN is missing or invalid' do
      user = create(:user, :tier2, :with_pin)
      circle = create_circle_for(user, balance_cents: 5000)

      post "/api/v1/circles/#{circle.id}/withdraw",
           params: { amount_cents: 1000 },
           headers: auth_headers(user)

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it 'returns 200 on success' do
      user = create(:user, :tier2, :with_pin)
      circle = create_circle_for(user, balance_cents: 5000)

      post "/api/v1/circles/#{circle.id}/withdraw",
           params: { amount_cents: 1000, pin: '1234' },
           headers: auth_headers(user)

      expect(response).to have_http_status(:ok)
    end

    it 'blocks withdraw when open disputes exist' do
      user = create(:user, :tier2, :with_pin)
      circle = create_circle_for(user, balance_cents: 5000)
      tx = circle.circle_transactions.create!(
        user: user,
        amount_cents: 1000,
        direction: 'credit',
        kind: 'fund',
        description: 'Fund'
      )
      Dispute.create!(circle_transaction: tx, raised_by: user, reason: 'Issue')

      post "/api/v1/circles/#{circle.id}/withdraw",
           params: { amount_cents: 1000, pin: '1234' },
           headers: auth_headers(user)

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it 'is idempotent with idempotency_key' do
      user = create(:user, :tier2, :with_pin)
      circle = create_circle_for(user, balance_cents: 5000)

      key = 'idem-456'
      post "/api/v1/circles/#{circle.id}/withdraw",
           params: { amount_cents: 1000, pin: '1234', idempotency_key: key },
           headers: auth_headers(user)

      expect(response).to have_http_status(:ok)
      first_balance = circle.reload.balance_cents
      tx_count = circle.circle_transactions.count
      wallet_tx_count = user.ngn_wallet.transactions.count

      post "/api/v1/circles/#{circle.id}/withdraw",
           params: { amount_cents: 1000, pin: '1234', idempotency_key: key },
           headers: auth_headers(user)

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['replayed']).to eq(true)
      expect(circle.reload.balance_cents).to eq(first_balance)
      expect(circle.circle_transactions.count).to eq(tx_count)
      expect(user.ngn_wallet.transactions.count).to eq(wallet_tx_count)
    end
  end
end
