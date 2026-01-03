# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Circle Timeline', type: :request do
  let(:user) { create(:user, :tier2) }
  let(:headers) { auth_headers(user) }

  describe 'GET /api/v1/circles/:id/timeline' do
    it 'returns items with timeline keys' do
      circle = Circle.create!(name: 'Alpha', owner: user)
      CircleMembership.create!(circle: circle, user: user, role: :admin)

      other_circle = Circle.create!(name: 'Beta', owner: user)
      CircleMembership.create!(circle: other_circle, user: user, role: :admin)

      CircleTransaction.create!(
        circle: circle,
        user: user,
        amount_cents: 1200,
        direction: :credit,
        kind: 'fund',
        occurred_at: 2.hours.ago,
        description: 'Alpha fund'
      )

      CircleTransaction.create!(
        circle: other_circle,
        user: user,
        amount_cents: 1500,
        direction: :credit,
        kind: 'fund',
        occurred_at: 1.hour.ago,
        description: 'Beta fund'
      )

      get "/api/v1/circles/#{circle.id}/timeline", headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)

      expect(body.keys).to include('items', 'next_cursor')
      expect(body.fetch('items').length).to eq(1)

      item = body.fetch('items').first
      expect(item.keys).to include(
        'id',
        'kind',
        'label',
        'amount_cents',
        'status',
        'occurred_at',
        'actor',
        'meta'
      )

      expect(item.fetch('meta').fetch('circle_id')).to eq(circle.id)
    end

    it 'paginates with cursor and returns next_cursor' do
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

      CircleTransaction.create!(
        circle: circle,
        user: user,
        amount_cents: 900,
        direction: :credit,
        kind: 'fund',
        occurred_at: older_time,
        description: 'Older fund'
      )

      get "/api/v1/circles/#{circle.id}/timeline",
          params: { limit: 1 },
          headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      items = body.fetch('items')

      expect(items.size).to eq(1)
      expect(body.fetch('next_cursor')).to eq(newest_time.iso8601)
    end
  end
end