# frozen_string_literal: true

FactoryBot.define do
  factory :unmatched_credit do
    provider { 'monnify' }
    sequence(:provider_reference) { |n| "provider-ref-#{n}" }
    sequence(:reference) { |n| "reference-#{n}" }
    amount { 1000 }
    currency { 'NGN' }
    reason { 'user_not_found' }
    status { 'pending' }
    payload { {} }
  end
end

