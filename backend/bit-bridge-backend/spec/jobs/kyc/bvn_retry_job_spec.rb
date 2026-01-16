# frozen_string_literal: true

require "rails_helper"

RSpec.describe Kyc::BvnRetryJob, type: :job do
  include ActiveJob::TestHelper

  let(:user) { create(:user) }
  let(:bvn) { "12345678901" }

  before do
    user.create_user_profile!(
      first_name: "Test",
      last_name: "User",
      date_of_birth: Date.new(1990, 1, 1)
    )
    user.create_user_kyc!(
      bvn_status: "pending",
      bvn_encrypted: bvn,
      bvn_fingerprint: Kyc::BvnFingerprint.generate(bvn),
      bvn_last4: "8901",
      bvn_retry_attempt: 0,
      bvn_retry_next_at: nil,
      bvn_retry_locked_at: nil
    )
  end

  it "finalizes to verified when provider recovers" do
    result = {
      ok: true,
      reference: "prembly-ref",
      first_name: "Test",
      last_name: "User",
      date_of_birth: "01-Jan-1990",
      watchlisted: false
    }

    allow(Kyc::PremblyBvnVerification).to receive(:new).with(bvn)
      .and_return(double(call: result))

    described_class.new.perform(user.user_kyc.id, user.user_kyc.bvn_fingerprint)

    user.user_kyc.reload
    expect(user.user_kyc.bvn_status).to eq("verified")
    expect(user.user_kyc.bvn_snapshot_first_name).to eq("Test")
    expect(KycBvnRetryEvent.where(user_kyc_id: user.user_kyc.id).count).to be >= 2
  end

  it "stops after max attempts and marks timeout" do
    result = { ok: false, error: "Timeout", status_code: 500 }
    allow(Kyc::PremblyBvnVerification).to receive(:new).with(bvn)
      .and_return(double(call: result))

    perform_enqueued_jobs do
      user.user_kyc.update!(bvn_retry_attempt: 5)
      described_class.new.perform(user.user_kyc.id, user.user_kyc.bvn_fingerprint)
    end

    user.user_kyc.reload
    expect(user.user_kyc.bvn_status).to eq("unverified")
    expect(user.user_kyc.bvn_last_result_reason).to eq("provider_unavailable_timeout")
    last_event = KycBvnRetryEvent.where(user_kyc_id: user.user_kyc.id).order(created_at: :desc).first
    expect(last_event&.reason).to eq("provider_unavailable_timeout")
  end

  it "writes retry events when rescheduling" do
    result = { ok: false, error: "Timeout", status_code: 500 }
    allow(Kyc::PremblyBvnVerification).to receive(:new).with(bvn)
      .and_return(double(call: result))

    described_class.new.perform(user.user_kyc.id, user.user_kyc.bvn_fingerprint)

    events = KycBvnRetryEvent.where(user_kyc_id: user.user_kyc.id).order(created_at: :desc)
    expect(events.first&.status).to eq("retry_scheduled")
    expect(events.first&.next_wait_seconds).to be_present
  end

  it "skips provider call when retry lock is held" do
    user.user_kyc.update!(bvn_retry_locked_at: Time.current)
    expect(Kyc::PremblyBvnVerification).not_to receive(:new)

    described_class.new.perform(user.user_kyc.id, user.user_kyc.bvn_fingerprint)
  end
end
