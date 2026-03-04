# frozen_string_literal: true

FactoryBot.define do
  factory :notification_device do
    association :user
    provider { 'expo' }
    token { "ExponentPushToken[#{SecureRandom.hex(8)}]" }
    platform { 'ios' }
    app_version { '1.0.0' }
    active { true }
    last_seen_at { Time.current }
    metadata { {} }
  end
end
