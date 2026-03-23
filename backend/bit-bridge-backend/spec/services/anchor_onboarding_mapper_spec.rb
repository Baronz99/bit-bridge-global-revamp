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
      profile = UserProfile.create!(
        user: user,
        first_name: 'Profile',
        last_name: 'User',
        phone_number: nil,
        address_line1: 'Profile Street',
        city: 'Lagos',
        state: 'LA',
        postal_code: '100001',
        bvn: '12345678901',
        date_of_birth: Date.new(1990, 1, 1)
      )
      profile.update_column(:phone_e164, '2348012345678')

      result = described_class.build_account_info(user: user, account_params: { vendor: 'anchor' })

      expect(result[:phone_number]).to eq('+2348012345678')
    end

    it 'normalizes state aliases to Anchor-compatible values' do
      user = create(:user, email: 'user@example.com')
      UserProfile.create!(
        user: user,
        first_name: 'Profile',
        last_name: 'User',
        phone_number: '08000000000',
        address_line1: 'Profile Street',
        city: 'Port Harcourt',
        state: 'Rivers State',
        postal_code: '500100',
        bvn: '12345678901',
        date_of_birth: Date.new(1990, 1, 1)
      )

      result = described_class.build_account_info(user: user, account_params: { vendor: 'anchor' })

      expect(result[:state]).to eq('Rivers')
    end

    it 'normalizes FCT Abuja variants to FCT' do
      user = create(:user, email: 'user@example.com')
      UserProfile.create!(
        user: user,
        first_name: 'Michael',
        last_name: 'Ayua',
        phone_number: '08000000000',
        address_line1: 'Area 1',
        city: 'Abuja',
        state: 'FCT (Abuja)',
        postal_code: '900001',
        bvn: '12345678901',
        date_of_birth: Date.new(1990, 1, 1)
      )

      result = described_class.build_account_info(user: user, account_params: { vendor: 'anchor' })

      expect(result[:state]).to eq('FCT')
    end

    it 'prefers verified bvn snapshot names over editable profile names' do
      user = create(:user, email: 'user@example.com')
      UserProfile.create!(
        user: user,
        first_name: 'Agatha',
        last_name: 'MarriedName',
        phone_number: '08000000000',
        address_line1: 'Profile Street',
        city: 'Calabar',
        state: 'Cross River',
        postal_code: '540001',
        date_of_birth: Date.new(1983, 5, 15)
      )
      UserKyc.create!(
        user: user,
        bvn_status: 'verified',
        bvn_verified_at: Time.current,
        bvn_encrypted: '12345678901',
        bvn_snapshot_first_name: 'Agatha',
        bvn_snapshot_last_name: 'Ibezimako'
      )

      result = described_class.build_account_info(user: user, account_params: { vendor: 'anchor' })

      expect(result[:first_name]).to eq('Agatha')
      expect(result[:last_name]).to eq('Ibezimako')
    end
  end
end
