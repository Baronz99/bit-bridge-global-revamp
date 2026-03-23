# frozen_string_literal: true

require 'rails_helper'
require 'securerandom'

RSpec.describe RefreshSession, type: :model do
  let(:user) { create(:user, :confirmed, email: "refresh_session_#{SecureRandom.hex(6)}@example.com") }

  it 'issues distinct active sessions for the same user' do
    first = described_class.issue_for!(user: user, ttl: 30.days)
    second = described_class.issue_for!(user: user, ttl: 30.days)

    expect(first).to be_present
    expect(second).to be_present
    expect(first).not_to eq(second)
    expect(user.refresh_sessions.active.count).to eq(2)
  end
end
