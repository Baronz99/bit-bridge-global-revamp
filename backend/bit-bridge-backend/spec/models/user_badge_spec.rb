# frozen_string_literal: true

require 'rails_helper'

RSpec.describe UserBadge, type: :model do
  it 'is valid with user, badge, granted_at, and source circle' do
    user = create(:user, :confirmed, email: "badge-user-#{SecureRandom.hex(4)}@example.com")
    badge = Badge.create!(key: "founding_supporter_#{SecureRandom.hex(4)}", name: 'Founding Supporter')
    circle_owner = create(:user, :confirmed, email: "badge-owner-#{SecureRandom.hex(4)}@example.com")
    circle = Circle.create!(owner: circle_owner, name: 'BitBridge Founders Circle', circle_type: 'official')

    user_badge = described_class.new(
      user: user,
      badge: badge,
      source_circle: circle,
      granted_at: Time.current
    )

    expect(user_badge).to be_valid
  end

  it 'does not allow duplicate badge grants for the same user and source circle' do
    user = create(:user, :confirmed, email: "badge-user-#{SecureRandom.hex(4)}@example.com")
    badge = Badge.create!(key: "founding_supporter_#{SecureRandom.hex(4)}", name: 'Founding Supporter')
    circle_owner = create(:user, :confirmed, email: "badge-owner-#{SecureRandom.hex(4)}@example.com")
    circle = Circle.create!(owner: circle_owner, name: "Founders #{SecureRandom.hex(2)}", circle_type: 'official')

    described_class.create!(
      user: user,
      badge: badge,
      source_circle: circle,
      granted_at: Time.current
    )

    duplicate = described_class.new(
      user: user,
      badge: badge,
      source_circle: circle,
      granted_at: Time.current
    )

    expect(duplicate).not_to be_valid
    expect(duplicate.errors[:badge_id]).to include('has already been taken')
  end
end
