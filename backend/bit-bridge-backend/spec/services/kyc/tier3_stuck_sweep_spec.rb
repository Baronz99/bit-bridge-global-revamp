# frozen_string_literal: true

require "rails_helper"

RSpec.describe Kyc::Tier3StuckSweep do
  let(:user) { create(:user) }

  def create_kyc!(status:, updated_at:)
    user.create_user_kyc!(
      bvn_status: "verified",
      bvn_verified_at: Time.current,
      bvn_encrypted: "12345678901",
      tier3_status: status,
      updated_at: updated_at
    )
  end

  it "marks stale processing records as failed and writes tier3 event" do
    kyc = create_kyc!(status: "processing", updated_at: 3.hours.ago)
    summary = described_class.new.call

    expect(summary[:candidates]).to eq(1)
    expect(summary[:updated]).to eq(1)

    kyc.reload
    expect(kyc.tier3_status).to eq("failed")
    expect(kyc.tier3_error).to include("timed out")

    event = KycTier3Event.where(user_kyc_id: kyc.id).order(created_at: :desc).first
    expect(event).to be_present
    expect(event.status).to eq("timed_out")
    expect(event.stage).to eq("sweeper")
  end

  it "does not update recent processing records" do
    create_kyc!(status: "processing", updated_at: 10.minutes.ago)
    summary = described_class.new.call

    expect(summary[:candidates]).to eq(0)
    expect(summary[:updated]).to eq(0)
  end
end
