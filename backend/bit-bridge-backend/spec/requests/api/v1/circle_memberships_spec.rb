# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Circle memberships', type: :request do
  let(:owner) { create(:user, :tier2, :with_pin) }
  let(:member) { create(:user, :tier2, :with_pin) }

  it 'allows a member to set their circle username' do
    circle = Circle.create!(name: 'Alpha', owner: owner)
    CircleMembership.create!(circle: circle, user: owner, role: :admin)
    CircleMembership.create!(circle: circle, user: member, role: :member)

    patch "/api/v1/circles/#{circle.id}/memberships/me",
          params: { membership: { username: 'member_handle' } },
          headers: auth_headers(member)

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body.dig('user', 'username')).to eq('member_handle')
    expect(body.dig('user', 'email')).to include('***@')
    expect(body.dig('user', 'email')).not_to eq(member.email)
  end
end
