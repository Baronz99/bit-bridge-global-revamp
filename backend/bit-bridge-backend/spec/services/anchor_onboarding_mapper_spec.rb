# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AnchorOnboardingMapper do
  describe '.build_account_info' do
    it 'prefers account_params over profile and user data' do
      user = create(:user, email: 'user@example.com')
      UserProfile.create!(
        user: user,
        first_name: 'Profile',
        last_name: 'User',
        phone_number: '08000000000',
        address_line1: 'Profile Street',
        city: 'Lagos',
        state: 'LA',
        postal_code: '100001',
        bvn: '12345678901',
        date_of_birth: Date.new(1990, 1, 1)
      )

      account_params = {
        phone_number: '09000000000',
        address: 'Override Street',
        city: 'Abuja'
      }

      result = described_class.build_account_info(user: user, account_params: account_params)

      expect(result[:phone_number]).to eq('+2349000000000')
      expect(result[:address]).to eq('Override Street')
      expect(result[:city]).to eq('Abuja')
      expect(result[:first_name]).to eq('Profile')
      expect(result[:email]).to eq('user@example.com')
    end

    it 'falls back to profile phone_e164 and normalizes to +234 format' do
      user = create(:user, email: 'user@example.com')
      UserProfile.create!(
        user: user,
        first_name: 'Profile',
        last_name: 'User',
        phone_number: nil,
        phone_e164: '2348012345678',
        address_line1: 'Profile Street',
        city: 'Lagos',
        state: 'LA',
        postal_code: '100001',
        bvn: '12345678901',
        date_of_birth: Date.new(1990, 1, 1)
      )

      result = described_class.build_account_info(user: user, account_params: { vendor: 'anchor' })

      expect(result[:phone_number]).to eq('+2348012345678')
    end
  end
end
