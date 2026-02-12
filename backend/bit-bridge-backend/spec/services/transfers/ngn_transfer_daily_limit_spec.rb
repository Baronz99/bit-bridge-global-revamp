# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transfers::NgnTransferDailyLimit do
  include ActiveSupport::Testing::TimeHelpers

  let(:user) { create(:user, :tier2, :confirmed, email: "limit-#{SecureRandom.hex(4)}@example.com") }
  let(:wallet) { user.ngn_wallet }

  before do
    wallet.transactions.create!(
      transaction_type: 'deposit',
      status: 'approved',
      amount: 5_000_000,
      coin_type: 'bank',
      address: 'Daily limit seed'
    )
  end

  def create_anchor_withdrawal!(amount:, status:, subtype:, created_at: Time.current, provider: 'anchor')
    wallet.transactions.create!(
      transaction_type: 'withdrawal',
      status: status,
      amount: amount,
      coin_type: 'bank',
      address: "Anchor #{subtype}",
      created_at: created_at,
      updated_at: created_at,
      metadata: {
        provider: provider,
        subtype: subtype,
        transfer_reference: SecureRandom.uuid
      }
    )
  end

  it 'sums only approved anchor principal and fee withdrawals for today' do
    create_anchor_withdrawal!(amount: 100_000, status: 'approved', subtype: 'principal')
    create_anchor_withdrawal!(amount: 200, status: 'approved', subtype: 'fee')
    create_anchor_withdrawal!(amount: 500, status: 'pending', subtype: 'fee')
    create_anchor_withdrawal!(amount: 700, status: 'approved', subtype: 'principal', provider: 'other')

    spent = described_class.daily_spent_for(user: user)
    expect(spent).to eq(100_200.to_d)
  end

  it 'uses business-day boundary (Africa/Lagos) for midnight cutover' do
    lagos_zone = Time.find_zone!(Transfers::NgnTransferDailyLimit::BUSINESS_TIMEZONE)
    travel_to lagos_zone.parse('2026-02-12 00:05:00') do
      create_anchor_withdrawal!(
        amount: 100,
        status: 'approved',
        subtype: 'principal',
        created_at: lagos_zone.parse('2026-02-11 23:59:00')
      )
      create_anchor_withdrawal!(
        amount: 200,
        status: 'approved',
        subtype: 'fee',
        created_at: lagos_zone.parse('2026-02-12 00:01:00')
      )

      spent = described_class.daily_spent_for(user: user)
      expect(spent).to eq(200.to_d)
    end
  end

  it 'does not count non-transfer withdrawals' do
    create_anchor_withdrawal!(amount: 120, status: 'approved', subtype: 'virtual_card_funding')
    create_anchor_withdrawal!(amount: 230, status: 'approved', subtype: 'principal', provider: 'other')
    create_anchor_withdrawal!(amount: 340, status: 'approved', subtype: 'principal')

    spent = described_class.daily_spent_for(user: user)
    expect(spent).to eq(340.to_d)
  end

  it 'returns tier-aware limits and exceeded snapshot values' do
    user.update!(kyc_level: 'tier_3')
    create_anchor_withdrawal!(amount: 2_999_500, status: 'approved', subtype: 'principal')

    snapshot = described_class.snapshot(user: user, attempted_amount: 600)

    expect(snapshot[:daily_limit]).to eq(3_000_000.to_d)
    expect(snapshot[:daily_spent]).to eq(2_999_500.to_d)
    expect(snapshot[:daily_remaining]).to eq(500.to_d)
    expect(snapshot[:attempted_amount]).to eq(600.to_d)
    expect(snapshot[:exceeded]).to eq(true)
    expect(snapshot[:business_timezone]).to eq('Africa/Lagos')
    expect(snapshot[:day_start]).to eq(snapshot[:as_of].beginning_of_day)
    expect(snapshot[:day_end]).to eq(snapshot[:as_of].end_of_day)
    expect(snapshot[:as_of]).to be_present
  end
end
