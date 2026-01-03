# frozen_string_literal: true

FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "user#{n}@example.com" }
    password { 'password123' }
    password_confirmation { 'password123' }

    trait :tier2 do
      kyc_level { 'tier_2' }
    end

    trait :with_pin do
      after(:create) { |u| u.set_transaction_pin!('1234') }
    end
  end
end
