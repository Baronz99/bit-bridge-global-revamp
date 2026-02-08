# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Tunnel conversions', type: :request do
  include AuthHelpers

  let(:user) { create(:user, :tier2, :with_pin) }

  before do
    FxSetting.delete_all
    FxSetting.create!(base_usd_ngn_rate: 1500)
    user.ngn_wallet.transactions.create!(
      transaction_type: 'deposit',
      status: 'approved',
      amount: 20_000,
      coin_type: 'bank'
    )
  end

  it 'locks conversion values with quote_token' do
    fx_quote = FxQuote.create!(
      user: user,
      direction: 'ngn_to_usd',
      base_rate: 1500,
      markup: 75,
      execution_rate: 1575,
      base_rate_raw: 1500,
      markup_raw: 75,
      execution_rate_raw: 1575,
      fee_amount: 100,
      fee_amount_raw: 100,
      fee_currency: 'NGN',
      amount_in: 10_000,
      amount_in_raw: 10_000,
      amount_after_fee: 9_900,
      amount_after_fee_raw: 9_900,
      amount_out: 6.25,
      amount_out_raw: 6.25,
      expires_at: 5.minutes.from_now
    )

    post '/api/v1/wallets/tunnel/convert',
         params: {
           amount_ngn: 10_000,
           transaction_pin: '1234',
           quote_token: fx_quote.token
         },
         headers: auth_headers(user)

    expect(response).to have_http_status(:ok)

    body = JSON.parse(response.body)
    quote = body.dig('data', 'quote') || {}

    expect(quote['amount_in']).to eq(10_000.0)
    expect(quote['amount_out']).to be_within(0.0001).of(6.25)

    user.usd_wallet.reload
    expect(user.usd_wallet.balance).to be_within(0.01).of(6.25)
  end

  it 'returns quote schema with expected keys' do
    post '/api/v1/wallets/tunnel/quote',
         params: { amount_ngn: 12_345 },
         headers: auth_headers(user)

    expect(response).to have_http_status(:ok)

    body = JSON.parse(response.body)
    %w[
      from to amount_in fee_amount fee_currency amount_after_fee base_rate markup execution_rate amount_out quote_token as_of
    ].each do |key|
      expect(body).to have_key(key)
    end
    expect(body['from']).to eq('NGN')
    expect(body['to']).to eq('USD')
  end

  it 'uses quote values even after base rate changes' do
    quote = FxDesk::Pricing.new.quote_ngn_to_usd(10_000)
    fx_quote = FxQuote.create!(
      user: user,
      direction: 'ngn_to_usd',
      base_rate: quote[:base_rate],
      markup: quote[:markup],
      execution_rate: quote[:execution_rate],
      base_rate_raw: quote[:base_rate_raw],
      markup_raw: quote[:markup_raw],
      execution_rate_raw: quote[:execution_rate_raw],
      fee_amount: quote[:fee_amount],
      fee_amount_raw: quote[:fee_amount_raw],
      fee_currency: quote[:fee_currency],
      amount_in: quote[:amount_in],
      amount_in_raw: quote[:amount_in_raw],
      amount_after_fee: quote[:amount_after_fee],
      amount_after_fee_raw: quote[:amount_after_fee_raw],
      amount_out: quote[:amount_out],
      amount_out_raw: quote[:amount_out_raw],
      expires_at: 5.minutes.from_now
    )

    FxSetting.current.update!(base_usd_ngn_rate: 2000)

    post '/api/v1/wallets/tunnel/convert',
         params: {
           amount_ngn: 10_000,
           transaction_pin: '1234',
           quote_token: fx_quote.token
         },
         headers: auth_headers(user)

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    quote_payload = body.dig('data', 'quote') || {}
    expect(quote_payload['execution_rate']).to eq(quote[:execution_rate].to_f)
  end

  it 'converts without a quote token' do
    post '/api/v1/wallets/tunnel/convert',
         params: {
           amount_ngn: 5_000,
           transaction_pin: '1234'
         },
         headers: auth_headers(user)

    expect(response).to have_http_status(:ok)

    body = JSON.parse(response.body)
    quote_payload = body.dig('data', 'quote') || {}
    expect(quote_payload['amount_in']).to eq(5_000.0)
  end

  it 'converts USD to NGN after USD wallet is funded' do
    post '/api/v1/wallets/tunnel/convert',
         params: {
           amount_ngn: 10_000,
           transaction_pin: '1234'
         },
         headers: auth_headers(user)

    expect(response).to have_http_status(:ok)

    ngn_before = user.ngn_wallet.reload.balance.to_d
    usd_before = user.usd_wallet.reload.balance.to_d
    expect(usd_before).to be > 0

    post '/api/v1/wallets/tunnel/convert-back',
         params: {
           amount_usd: 2,
           transaction_pin: '1234'
         },
         headers: auth_headers(user)

    expect(response).to have_http_status(:ok)

    body = JSON.parse(response.body)
    quote_payload = body.dig('data', 'quote') || {}
    expect(quote_payload['from']).to eq('USD')
    expect(quote_payload['to']).to eq('NGN')
    expect(quote_payload['amount_in']).to eq(2.0)

    expect(user.usd_wallet.reload.balance.to_d).to be < usd_before
    expect(user.ngn_wallet.reload.balance.to_d).to be > ngn_before
  end

  it 'executes conversion only once per quote token' do
    fx_quote = FxQuote.create!(
      user: user,
      direction: 'ngn_to_usd',
      base_rate: 1500,
      markup: 75,
      execution_rate: 1575,
      base_rate_raw: 1500,
      markup_raw: 75,
      execution_rate_raw: 1575,
      fee_amount: 100,
      fee_amount_raw: 100,
      fee_currency: 'NGN',
      amount_in: 10_000,
      amount_in_raw: 10_000,
      amount_after_fee: 9_900,
      amount_after_fee_raw: 9_900,
      amount_out: 6.25,
      amount_out_raw: 6.25,
      expires_at: 5.minutes.from_now
    )

    post '/api/v1/wallets/tunnel/convert',
         params: {
           amount_ngn: 10_000,
           transaction_pin: '1234',
           quote_token: fx_quote.token
         },
         headers: auth_headers(user)

    expect(response).to have_http_status(:ok)
    fx_quote.reload
    expect(fx_quote.executed_at).to be_present
    expect(fx_quote.execution_reference).to be_present

    transaction_count = Transaction.count
    ngn_balance = user.ngn_wallet.balance.to_d
    usd_balance = user.usd_wallet.balance.to_d

    post '/api/v1/wallets/tunnel/convert',
         params: {
           amount_ngn: 10_000,
           transaction_pin: '1234',
           quote_token: fx_quote.token
         },
         headers: auth_headers(user)

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body.dig('data', 'replayed')).to eq(true)
    expect(Transaction.count).to eq(transaction_count)
    expect(user.ngn_wallet.reload.balance.to_d).to eq(ngn_balance)
    expect(user.usd_wallet.reload.balance.to_d).to eq(usd_balance)
  end
end
