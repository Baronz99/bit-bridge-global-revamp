# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Circle audit PII', type: :request do
  let(:owner) { create(:user, :tier2, :with_pin) }
  let(:member) { create(:user, :tier2, :with_pin) }

  def create_circle
    circle = Circle.create!(name: 'Alpha', owner: owner)
    CircleMembership.create!(circle: circle, user: owner, role: :admin)
    CircleMembership.create!(circle: circle, user: member, role: :member)
    circle
  end

  it 'masks email in circle export csv for members' do
    circle = create_circle
    circle.circle_transactions.create!(
      user: owner,
      amount_cents: 1000,
      direction: 'credit',
      kind: 'fund',
      description: 'Fund'
    )

    get "/api/v1/circles/#{circle.id}/export_csv", headers: auth_headers(member)

    expect(response).to have_http_status(:ok)
    expect(response.body).to include('***@')
    expect(response.body).not_to include(owner.email)
  end

  it 'masks email in circle export csv for owner/admin too' do
    circle = create_circle
    circle.circle_transactions.create!(
      user: owner,
      amount_cents: 1000,
      direction: 'credit',
      kind: 'fund',
      description: 'Fund'
    )

    get "/api/v1/circles/#{circle.id}/export_csv", headers: auth_headers(owner)

    expect(response).to have_http_status(:ok)
    expect(response.body).to include('***@')
    expect(response.body).not_to include(owner.email)
  end

  it 'masks email in circle audit json for members' do
    circle = create_circle
    circle.circle_transactions.create!(
      user: owner,
      amount_cents: 1000,
      direction: 'credit',
      kind: 'fund',
      description: 'Fund'
    )

    get "/api/v1/circles/#{circle.id}/audit", headers: auth_headers(member)

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    emails = body['transactions'].map { |tx| tx['user_email'] }
    expect(emails.join(' ')).to include('***@')
    expect(emails.join(' ')).not_to include(owner.email)
  end
end
