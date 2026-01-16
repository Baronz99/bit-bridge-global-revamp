# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'BVN verification caching', type: :request do
  include ActiveJob::TestHelper
  let(:user) { create(:user) }
  let(:headers) { auth_headers(user) }
  let(:bvn) { '12345678901' }

  def profile_fingerprint(profile)
    raw = [profile.first_name, profile.last_name, profile.date_of_birth]
          .map { |value| value.to_s.strip.downcase }
          .join('|')
    pepper = ENV['KYC_FINGERPRINT_PEPPER'].to_s
    pepper = Rails.application.secret_key_base if pepper.empty?
    Digest::SHA256.hexdigest("#{pepper}|#{raw}")
  end

  before do
    user.create_user_profile!(
      first_name: 'Test',
      last_name: 'User',
      date_of_birth: Date.new(1990, 1, 1)
    )
    user.create_user_kyc!
    allow(Kyc::PremblyBvnBasicValidation).to receive(:new).and_return(double(call: { ok: true }))
  end

  it 'returns cached mismatch without calling provider' do
    fingerprint = Kyc::BvnFingerprint.generate(bvn)
    profile_fp = profile_fingerprint(user.user_profile)

    user.user_kyc.update!(
      bvn_status: 'mismatch',
      bvn_fingerprint: fingerprint,
      bvn_last_result_status: 'mismatch',
      bvn_last_result_reason: 'mismatch',
      bvn_last_checked_at: 1.hour.ago,
      bvn_last_profile_fingerprint: profile_fp
    )

    expect(Kyc::PremblyBvnVerification).not_to receive(:new)

    post '/api/v1/kyc/bvn/verify', params: { bvn: bvn }, headers: headers

    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    expect(json['status']).to eq('mismatch')
    expect(json['reason']).to eq('cached_mismatch')
    expect(json['cached']).to eq(true)
    expect(json['retryable']).to eq(false)
  end

  it 'calls provider when profile has changed' do
    fingerprint = Kyc::BvnFingerprint.generate(bvn)

    user.user_kyc.update!(
      bvn_status: 'mismatch',
      bvn_fingerprint: fingerprint,
      bvn_last_result_status: 'mismatch',
      bvn_last_result_reason: 'mismatch',
      bvn_last_checked_at: 1.hour.ago,
      bvn_last_profile_fingerprint: 'old-profile-fingerprint'
    )

    result = {
      ok: true,
      reference: 'prembly-ref',
      first_name: 'Other',
      last_name: 'User',
      date_of_birth: '01-Jan-1990',
      watchlisted: false
    }

    expect(Kyc::PremblyBvnVerification).to receive(:new).with(bvn)
      .and_return(double(call: result))

    post '/api/v1/kyc/bvn/verify', params: { bvn: bvn }, headers: headers

    expect(response).to have_http_status(:ok)
  end

  it 'calls provider when BVN changes' do
    fingerprint = Kyc::BvnFingerprint.generate(bvn)
    profile_fp = profile_fingerprint(user.user_profile)

    user.user_kyc.update!(
      bvn_status: 'mismatch',
      bvn_fingerprint: fingerprint,
      bvn_last_result_status: 'mismatch',
      bvn_last_result_reason: 'mismatch',
      bvn_last_checked_at: 1.hour.ago,
      bvn_last_profile_fingerprint: profile_fp
    )

    new_bvn = '10987654321'
    result = {
      ok: true,
      reference: 'prembly-ref',
      first_name: 'Other',
      last_name: 'User',
      date_of_birth: '01-Jan-1990',
      watchlisted: false
    }

    expect(Kyc::PremblyBvnVerification).to receive(:new).with(new_bvn)
      .and_return(double(call: result))

    post '/api/v1/kyc/bvn/verify', params: { bvn: new_bvn }, headers: headers

    expect(response).to have_http_status(:ok)
  end

  it 'refreshes mismatch after TTL when snapshot is missing' do
    fingerprint = Kyc::BvnFingerprint.generate(bvn)
    profile_fp = profile_fingerprint(user.user_profile)

    user.user_profile.update!(last_name: 'User-Updated')

    user.user_kyc.update!(
      bvn_status: 'mismatch',
      bvn_fingerprint: fingerprint,
      bvn_last_result_status: 'mismatch',
      bvn_last_result_reason: 'mismatch',
      bvn_last_checked_at: 2.days.ago,
      bvn_last_profile_fingerprint: profile_fp,
      bvn_snapshot_first_name: nil,
      bvn_snapshot_last_name: nil,
      bvn_snapshot_dob: nil,
      bvn_snapshot_expires_at: nil
    )

    result = {
      ok: true,
      reference: 'prembly-ref',
      first_name: 'Test',
      last_name: 'User',
      date_of_birth: '01-Jan-1990',
      watchlisted: false
    }

    expect(Kyc::PremblyBvnVerification).to receive(:new).with(bvn)
      .and_return(double(call: result))

    post '/api/v1/kyc/bvn/verify', params: { bvn: bvn }, headers: headers

    expect(response).to have_http_status(:ok)
  end

  it 'keeps cached mismatch when profile fingerprint is unchanged' do
    fingerprint = Kyc::BvnFingerprint.generate(bvn)
    profile_fp = profile_fingerprint(user.user_profile)

    user.user_kyc.update!(
      bvn_status: 'mismatch',
      bvn_fingerprint: fingerprint,
      bvn_last_result_status: 'mismatch',
      bvn_last_result_reason: 'mismatch',
      bvn_last_checked_at: 1.hour.ago,
      bvn_last_profile_fingerprint: profile_fp,
      bvn_snapshot_first_name: nil,
      bvn_snapshot_last_name: nil,
      bvn_snapshot_dob: nil,
      bvn_snapshot_expires_at: nil
    )

    expect(Kyc::PremblyBvnVerification).not_to receive(:new)

    post '/api/v1/kyc/bvn/verify', params: { bvn: bvn }, headers: headers

    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    expect(json['status']).to eq('mismatch')
    expect(json['cached']).to eq(true)
  end

  it 'refreshes mismatch after TTL even when profile fingerprint is unchanged' do
    fingerprint = Kyc::BvnFingerprint.generate(bvn)
    profile_fp = profile_fingerprint(user.user_profile)

    user.user_kyc.update!(
      bvn_status: 'mismatch',
      bvn_fingerprint: fingerprint,
      bvn_last_result_status: 'mismatch',
      bvn_last_result_reason: 'mismatch',
      bvn_last_checked_at: 2.days.ago,
      bvn_last_profile_fingerprint: profile_fp,
      bvn_snapshot_first_name: nil,
      bvn_snapshot_last_name: nil,
      bvn_snapshot_dob: nil,
      bvn_snapshot_expires_at: nil
    )

    result = {
      ok: true,
      reference: 'prembly-ref',
      first_name: 'Test',
      last_name: 'User',
      date_of_birth: '01-Jan-1990',
      watchlisted: false
    }

    expect(Kyc::PremblyBvnVerification).to receive(:new).with(bvn)
      .and_return(double(call: result))

    post '/api/v1/kyc/bvn/verify', params: { bvn: bvn }, headers: headers

    expect(response).to have_http_status(:ok)
  end

  it 'rechecks snapshot and auto-verifies without provider call' do
    fingerprint = Kyc::BvnFingerprint.generate(bvn)
    profile_fp = profile_fingerprint(user.user_profile)

    user.user_kyc.update!(
      bvn_status: 'mismatch',
      bvn_fingerprint: fingerprint,
      bvn_last_result_status: 'mismatch',
      bvn_last_result_reason: 'mismatch',
      bvn_last_checked_at: 1.hour.ago,
      bvn_last_profile_fingerprint: profile_fp,
      bvn_snapshot_first_name: 'Test',
      bvn_snapshot_last_name: 'User',
      bvn_snapshot_dob: '1990-01-01',
      bvn_snapshot_watchlisted: false,
      bvn_snapshot_reference: 'prembly-ref',
      bvn_snapshot_captured_at: 1.hour.ago,
      bvn_snapshot_expires_at: 1.day.from_now
    )

    expect(Kyc::PremblyBvnVerification).not_to receive(:new)

    post '/api/v1/kyc/bvn/verify', params: { bvn: bvn }, headers: headers

    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    expect(json['status']).to eq('verified')
    expect(json['cached']).to eq(true)
  end

  it 'matches last name with hyphens or spaces using snapshot' do
    fingerprint = Kyc::BvnFingerprint.generate(bvn)
    profile = user.user_profile
    profile.update!(last_name: 'Ade Bisi')
    profile_fp = profile_fingerprint(profile)

    user.user_kyc.update!(
      bvn_status: 'mismatch',
      bvn_fingerprint: fingerprint,
      bvn_last_result_status: 'mismatch',
      bvn_last_result_reason: 'mismatch',
      bvn_last_checked_at: 1.hour.ago,
      bvn_last_profile_fingerprint: profile_fp,
      bvn_snapshot_first_name: 'Test',
      bvn_snapshot_last_name: 'Ade-Bisi',
      bvn_snapshot_dob: '1990-01-01',
      bvn_snapshot_watchlisted: false,
      bvn_snapshot_reference: 'prembly-ref',
      bvn_snapshot_captured_at: 1.hour.ago,
      bvn_snapshot_expires_at: 1.day.from_now
    )

    expect(Kyc::PremblyBvnVerification).not_to receive(:new)

    post '/api/v1/kyc/bvn/verify', params: { bvn: bvn }, headers: headers

    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    expect(json['status']).to eq('verified')
    expect(json['cached']).to eq(true)
  end

  it 'skips provider call during transient backoff window' do
    fingerprint = Kyc::BvnFingerprint.generate(bvn)
    profile_fp = profile_fingerprint(user.user_profile)

    user.user_kyc.update!(
      bvn_status: 'unverified',
      bvn_fingerprint: fingerprint,
      bvn_last_result_reason: 'provider_unavailable',
      bvn_last_checked_at: Time.current - 30,
      bvn_last_profile_fingerprint: profile_fp
    )

    before_attempts = user.user_kyc.bvn_failed_attempts_count
    expect(Kyc::PremblyBvnVerification).not_to receive(:new)

    expect do
      post '/api/v1/kyc/bvn/verify', params: { bvn: bvn }, headers: headers
    end.to have_enqueued_job(Kyc::BvnRetryJob)

    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    expect(json['status']).to eq('pending')
    expect(json['cached']).to eq(false)
    expect(json['retryable']).to eq(false)
    expect(json['reason']).to eq('provider_unavailable')
    expect(json['message']).to match(/pending/i)
    expect(json['next_check_seconds']).to be_present
    expect(json['next_check_seconds']).to be > 0
    expect(response.headers['Retry-After']).to be_present
    expect(response.headers['Retry-After']).to eq(json['next_check_seconds'].to_s)

    user.user_kyc.reload
    expect(user.user_kyc.bvn_failed_attempts_count).to eq(before_attempts)
  end

  it 'does not persist mismatch when provider is unavailable' do
    user.user_kyc.update!(
      bvn_status: 'mismatch',
      bvn_last_result_status: 'mismatch',
      bvn_last_result_reason: 'mismatch'
    )

    result = { ok: false, error: 'Timeout while connecting', status_code: 500 }
    expect(Kyc::PremblyBvnVerification).to receive(:new).with(bvn)
      .and_return(double(call: result))

    expect do
      post '/api/v1/kyc/bvn/verify', params: { bvn: bvn }, headers: headers
    end.to have_enqueued_job(Kyc::BvnRetryJob)

    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    expect(json['status']).to eq('pending')
    expect(json['reason']).to eq('provider_unavailable')
    expect(json['retryable']).to eq(false)

    user.user_kyc.reload
    expect(user.user_kyc.bvn_status).to eq('pending')
    expect(user.user_kyc.bvn_last_result_status).to eq('failed')
    expect(user.user_kyc.bvn_last_result_reason).to eq('provider_unavailable')
  end

  it 'queues pending retry when provider errors' do
    result = { ok: false, error: 'Timeout while connecting', status_code: 500 }
    expect(Kyc::PremblyBvnVerification).to receive(:new).with(bvn)
      .and_return(double(call: result))

    before_attempts = user.user_kyc.bvn_failed_attempts_count
    expect do
      post '/api/v1/kyc/bvn/verify', params: { bvn: bvn }, headers: headers
    end.to have_enqueued_job(Kyc::BvnRetryJob)

    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    expect(json['reason']).to eq('provider_unavailable')
    expect(json['status']).to eq('pending')
    expect(json['next_check_seconds']).to eq(120)
    expect(response.headers['Retry-After']).to eq('120')

    user.user_kyc.reload
    expect(user.user_kyc.bvn_last_result_reason).to eq('provider_unavailable')
    expect(user.user_kyc.bvn_failed_attempts_count).to eq(before_attempts)
  end

  it 'does not enqueue duplicate retry jobs while pending' do
    result = { ok: false, error: 'Timeout while connecting', status_code: 500 }
    expect(Kyc::PremblyBvnVerification).to receive(:new).with(bvn).once
      .and_return(double(call: result))

    clear_enqueued_jobs

    expect do
      post '/api/v1/kyc/bvn/verify', params: { bvn: bvn }, headers: headers
    end.to have_enqueued_job(Kyc::BvnRetryJob)

    expect do
      post '/api/v1/kyc/bvn/verify', params: { bvn: bvn }, headers: headers
    end.not_to have_enqueued_job(Kyc::BvnRetryJob)

    expect(enqueued_jobs.size).to eq(1)
  end

  it 'returns 422 when basic validation reports invalid BVN' do
    allow(Kyc::PremblyBvnBasicValidation).to receive(:new).with(bvn)
      .and_return(double(call: { ok: false, invalid: true, status_code: 400 }))
    expect(Kyc::PremblyBvnVerification).not_to receive(:new)

    expect do
      post '/api/v1/kyc/bvn/verify', params: { bvn: bvn }, headers: headers
    end.not_to have_enqueued_job(Kyc::BvnRetryJob)

    expect(response).to have_http_status(:unprocessable_entity)
    json = JSON.parse(response.body)
    expect(json['reason']).to eq('bvn_invalid')
  end

  it 'returns pending when basic is ok and advance is unavailable' do
    allow(Kyc::PremblyBvnBasicValidation).to receive(:new).with(bvn)
      .and_return(double(call: { ok: true }))
    result = { ok: false, error: 'Timeout', status_code: 500 }
    allow(Kyc::PremblyBvnVerification).to receive(:new).with(bvn)
      .and_return(double(call: result))

    expect do
      post '/api/v1/kyc/bvn/verify', params: { bvn: bvn }, headers: headers
    end.to have_enqueued_job(Kyc::BvnRetryJob)

    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    expect(json['status']).to eq('pending')
    expect(json['reason']).to eq('provider_unavailable')
  end

  it 'returns next_check_seconds while pending' do
    user.user_kyc.update!(
      bvn_status: 'pending',
      bvn_last_result_reason: 'provider_unavailable',
      bvn_retry_next_at: Time.current + 90
    )

    get '/api/v1/kyc/bvn/status', headers: headers

    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    expect(json['status']).to eq('pending')
    expect(json['next_check_seconds']).to be_present
    expect(json['next_check_seconds']).to be > 0
  end

  it 'omits next_check_seconds when not pending' do
    user.user_kyc.update!(
      bvn_status: 'mismatch',
      bvn_last_result_reason: 'mismatch',
      bvn_retry_next_at: Time.current + 90
    )

    get '/api/v1/kyc/bvn/status', headers: headers

    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    expect(json['status']).to eq('mismatch')
    expect(json.key?('next_check_seconds')).to eq(false)
  end

  it 'normalizes mismatch reason fallback' do
    result = {
      ok: true,
      reference: 'prembly-ref',
      first_name: 'Other',
      last_name: 'User',
      date_of_birth: '01-Jan-1990',
      watchlisted: false
    }

    allow_any_instance_of(Api::V1::Kyc::BvnController).to receive(:resolve_match_outcome).and_return(
      { status: 'mismatch', reason: 'something_unexpected' }
    )
    expect(Kyc::PremblyBvnVerification).to receive(:new).with(bvn)
      .and_return(double(call: result))

    post '/api/v1/kyc/bvn/verify', params: { bvn: bvn }, headers: headers

    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    expect(json['reason']).to eq('mismatch')
  end

  it 'normalizes pending_review reason fallback' do
    result = {
      ok: true,
      reference: 'prembly-ref',
      first_name: 'Other',
      last_name: 'User',
      date_of_birth: '01-Jan-1990',
      watchlisted: false
    }

    allow_any_instance_of(Api::V1::Kyc::BvnController).to receive(:resolve_match_outcome).and_return(
      { status: 'pending_review', reason: 'weird_reason' }
    )
    expect(Kyc::PremblyBvnVerification).to receive(:new).with(bvn)
      .and_return(double(call: result))

    post '/api/v1/kyc/bvn/verify', params: { bvn: bvn }, headers: headers

    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    expect(json['reason']).to eq('provider_incomplete')
  end
end
