# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Timeline', type: :request do
  let(:user) do
    User.create!(
      email: 'viewer@example.com',
      password: 'password123',
      password_confirmation: 'password123'
    )
  end

  let(:headers) { auth_headers(user) }

  def auth_headers(user)
    token, = Warden::JWTAuth::UserEncoder.new.call(user, :user, nil)
    {
      'Authorization' => "Bearer #{token}",
      'ACCEPT' => 'application/json'
    }
  end

  describe 'GET /api/v1/timeline' do
    it 'returns 401 when unauthorized' do
      get '/api/v1/timeline'
      expect(response).to have_http_status(:unauthorized)
    end

    it 'returns items sorted by occurred_at desc' do
      circle = Circle.create!(name: 'Alpha', owner: user)
      CircleMembership.create!(circle: circle, user: user, role: :admin)

      older_time = 3.hours.ago
      middle_time = 2.hours.ago
      newest_time = 1.hour.ago

      old_tx =
        CircleTransaction.create!(
          circle: circle,
          user: user,
          amount_cents: 1200,
          direction: :credit,
          kind: 'fund',
          occurred_at: older_time,
          description: 'Old fund'
        )

      card_event =
        CardEvent.create!(
          user: user,
          event: 'card.authorization',
          card_id: 'card-1',
          amount: 15.50,
          status: 'successful',
          transaction_at: newest_time
        )

      mid_tx =
        CircleTransaction.create!(
          circle: circle,
          user: user,
          amount_cents: 900,
          direction: :credit,
          kind: 'fund',
          occurred_at: middle_time,
          description: 'Mid fund'
        )

      get '/api/v1/timeline', headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      ids = body.fetch('items').map { |item| item.fetch('id') }

      expect(ids).to eq(
        [
          "card-evt-#{card_event.id}",
          "circle-tx-#{mid_tx.id}",
          "circle-tx-#{old_tx.id}"
        ]
      )
    end

    it 'paginates with cursor' do
      circle = Circle.create!(name: 'Alpha', owner: user)
      CircleMembership.create!(circle: circle, user: user, role: :admin)

      newest_time = 30.minutes.ago
      older_time = 3.hours.ago

      CircleTransaction.create!(
        circle: circle,
        user: user,
        amount_cents: 1200,
        direction: :credit,
        kind: 'fund',
        occurred_at: newest_time,
        description: 'Newest fund'
      )

      older_tx =
        CircleTransaction.create!(
          circle: circle,
          user: user,
          amount_cents: 900,
          direction: :credit,
          kind: 'fund',
          occurred_at: older_time,
          description: 'Older fund'
        )

      get '/api/v1/timeline',
          params: { cursor: 1.hour.ago.iso8601, limit: 30 },
          headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      items = body.fetch('items')

      expect(items.size).to eq(1)
      expect(items.first.fetch('id')).to eq("circle-tx-#{older_tx.id}")
      expect(body.fetch('next_cursor')).to eq(older_time.iso8601)
    end

    it 'supports server-side cards type filtering' do
      circle = Circle.create!(name: 'Alpha', owner: user)
      CircleMembership.create!(circle: circle, user: user, role: :admin)
      user.ngn_wallet.transactions.create!(
        status: :approved,
        coin_type: :bank,
        transaction_type: :deposit,
        amount: 1000
      )
      card_event =
        CardEvent.create!(
          user: user,
          event: 'card.authorization',
          card_id: 'card-1',
          amount: 1550,
          status: 'successful',
          transaction_at: Time.current
        )

      get '/api/v1/timeline', params: { type: 'cards' }, headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      items = body.fetch('items')

      expect(items).not_to be_empty
      expect(items.map { |item| item.fetch('kind') }.uniq).to eq(['card_event'])
      expect(items.map { |item| item.fetch('id') }).to include("card-evt-#{card_event.id}")
    end
  end
end
