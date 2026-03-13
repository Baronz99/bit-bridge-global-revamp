# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Users email change flow', type: :request do
  let(:user) { create(:user, :confirmed, email: 'old@example.com', password: 'password123', password_confirmation: 'password123') }
  let(:headers) { auth_headers(user) }
  let(:profile) do
    user.create_user_profile!(
      first_name: 'Tochi',
      last_name: 'Amaechi',
      phone_number: '07030527419',
      phone_e164: '2347030527419',
      phone_verified_at: Time.current
    )
  end

  before do
    profile
    allow(FeatureFlags).to receive(:termii?).and_return(true)
  end

  def create_pending_phone_code!(code: '123456')
    PhoneVerificationCode.create!(
      user: user,
      phone_e164: profile.phone_e164,
      otp_digest: BCrypt::Password.create(code),
      expires_at: 5.minutes.from_now,
      status: 'pending',
      last_sent_at: Time.current - 2.minutes,
      send_count: 1,
      attempts: 0,
      provider: 'termii'
    )
  end

  it 'sends a fresh OTP to the verified phone before email change' do
    allow_any_instance_of(TermiiClient).to receive(:send_otp_sms!)
      .and_return({ ok: true, message_id: 'msg-123', provider_status: 'queued' })

    post '/api/v1/users/request_email_change',
         params: {
           new_email: 'new@example.com',
           current_password: 'password123'
         },
         headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['message']).to include('Verification code sent')

    code = PhoneVerificationCode.order(created_at: :desc).first
    expect(code.phone_e164).to eq(profile.phone_e164)
    expect(code.status).to eq('pending')
    expect(code.provider_message_id).to eq('msg-123')
  end

  it 'moves the new email into unconfirmed_email after valid password and OTP' do
    create_pending_phone_code!(code: '654321')

    post '/api/v1/users/confirm_email_change',
         params: {
           new_email: 'new@example.com',
           current_password: 'password123',
           phone_otp_code: '654321'
         },
         headers: headers

    expect(response).to have_http_status(:ok)
    user.reload

    expect(user.email).to eq('old@example.com')
    expect(user.unconfirmed_email).to eq('new@example.com')
    expect(user.confirmation_token).to be_present
  end

  it 'rejects email change confirmation when the OTP is invalid' do
    create_pending_phone_code!(code: '654321')

    post '/api/v1/users/confirm_email_change',
         params: {
           new_email: 'new@example.com',
           current_password: 'password123',
           phone_otp_code: '000000'
         },
         headers: headers

    expect(response).to have_http_status(:unprocessable_entity)
    expect(JSON.parse(response.body)['message']).to eq('Invalid verification code.')

    user.reload
    expect(user.unconfirmed_email).to be_blank
  end

  it 'can resend confirmation instructions using the pending new email address' do
    create_pending_phone_code!(code: '654321')

    post '/api/v1/users/confirm_email_change',
         params: {
           new_email: 'new@example.com',
           current_password: 'password123',
           phone_otp_code: '654321'
         },
         headers: headers

    expect(response).to have_http_status(:ok)

    get '/api/v1/users/resend_confirmation_token',
        params: { email: 'new@example.com' },
        headers: headers

    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body)['message']).to eq('Confirmation token resent')
  end
end
