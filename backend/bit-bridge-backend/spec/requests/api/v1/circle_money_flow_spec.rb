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

    it 'returns 404 when user is not a member of the circle' do
      user = create(:user, :tier2, :with_pin)
      other_circle = Circle.create!(name: 'Beta', owner: create(:user))

      post "/api/v1/circles/#{other_circle.id}/fund",
           params: { amount_cents: 1000, pin: '1234' },
           headers: auth_headers(user)

      expect(response).to have_http_status(:not_found)
      body = JSON.parse(response.body)
      expect(body['errors']).to include(a_string_matching(/Circle not found/i))
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

    it 'returns 422 when PIN is missing' do
      user = create(:user, :tier2, :with_pin)
      circle = create_circle_for(user)

      post "/api/v1/circles/#{circle.id}/fund",
           params: { amount_cents: 1000 },
           headers: auth_headers(user)

      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body['errors']).to include('Transaction PIN is required')
    end

    it 'returns 422 when PIN is invalid' do
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
           params: { amount_cents: 1000, pin: '0000' },
           headers: auth_headers(user)

      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body['errors']).to include('Invalid transaction PIN')
    end

    it 'returns 422 when wallet balance is insufficient' do
      user = create(:user, :tier2, :with_pin)
      circle = create_circle_for(user)

      post "/api/v1/circles/#{circle.id}/fund",
           params: { amount_cents: 100_00, pin: '1234' },
           headers: auth_headers(user)

      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body['errors']).to include('Insufficient wallet balance.')
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

    it 'attaches group_reference to both legs and returns a grouped timeline item with derived status' do
      user = create(:user, :tier2, :with_pin)
      circle = create_circle_for(user)
      wallet = user.ngn_wallet
      wallet.transactions.create!(
        transaction_type: :deposit,
        status: :approved,
        coin_type: :bank,
        amount: 200
      )

      post "/api/v1/circles/#{circle.id}/fund",
           params: { amount_cents: 10_00, pin: '1234' },
           headers: auth_headers(user)

      expect(response).to have_http_status(:ok)

      wallet_tx = wallet.transactions.order(created_at: :desc).first
      circle_tx = circle.circle_transactions.order(created_at: :desc).first

      group_ref_wallet = wallet_tx.metadata&.[]('group_reference')
      group_ref_circle = circle_tx.metadata&.[]('group_reference')
      expect(group_ref_wallet).to be_present
      expect(group_ref_circle).to eq(group_ref_wallet)

      get '/api/v1/timeline', headers: auth_headers(user)
      expect(response).to have_http_status(:ok)
      timeline = JSON.parse(response.body)
      items = timeline['items']

      grouped = items.select do |i|
        i['id'].to_s.start_with?('circle-fund-') && i.dig('meta', 'group_reference') == group_ref_wallet
      end
      expect(grouped.length).to eq(1)
      grouped_item = grouped.first
      expect(grouped_item['status']).to eq('approved')
      expect(grouped_item['amount_cents']).to eq(-10_00)

      non_grouped_with_ref = items.select do |i|
        i.dig('meta', 'group_reference') == group_ref_wallet && i['kind'] != 'circle_fund_group'
      end
      expect(non_grouped_with_ref).to be_empty
    end

    it 'is idempotent with Idempotency-Key header' do
      user = create(:user, :tier2, :with_pin)
      circle = create_circle_for(user)
      wallet = user.ngn_wallet
      wallet.transactions.create!(
        transaction_type: :deposit,
        status: :approved,
        coin_type: :bank,
        amount: 100
      )

      key = 'header-idem-789'
      headers = auth_headers(user).merge('Idempotency-Key' => key)

      post "/api/v1/circles/#{circle.id}/fund",
           params: { amount_cents: 1000, pin: '1234' },
           headers: headers

      expect(response).to have_http_status(:ok)
      first_balance = circle.reload.balance_cents
      tx_count = circle.circle_transactions.count
      wallet_tx_count = wallet.transactions.count

      post "/api/v1/circles/#{circle.id}/fund",
           params: { amount_cents: 1000, pin: '1234' },
           headers: headers

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
