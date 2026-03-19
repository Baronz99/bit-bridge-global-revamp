# frozen_string_literal: true

require 'rails_helper'

RSpec.describe UserKyc, type: :model do
  it 'computes a stable nin fingerprint from the encrypted nin' do
    user = create(:user, :confirmed, email: 'nin-fingerprint-spec@example.com')
    kyc = user.create_user_kyc!

    kyc.assign_nin_identity!('12345678901')
    kyc.save!

    expect(kyc.nin_last4).to eq('8901')
    expect(kyc.nin_fingerprint).to eq(Kyc::NinFingerprint.generate('12345678901'))
  end
end
