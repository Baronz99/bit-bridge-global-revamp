# frozen_string_literal: true

require 'rails_helper'

RSpec.describe SendTransactionReceiptJob, type: :job do
  include ActiveJob::TestHelper

  let(:user) do
    User.create!(
      email: "tx-receipt-#{SecureRandom.hex(4)}@example.com",
      password: 'password123',
      password_confirmation: 'password123'
    )
  end

  def ensure_wallet(user, wallet_type:, currency:)
    wallet = Wallet.find_or_initialize_by(user: user, wallet_type: wallet_type)
    wallet.currency = currency
    wallet.balance_cents ||= 100_000_00
    wallet.save!
    wallet
  end

  before do
    clear_enqueued_jobs
    clear_performed_jobs
    ActionMailer::Base.deliveries.clear
  end

  after do
    clear_enqueued_jobs
    clear_performed_jobs
    ActionMailer::Base.deliveries.clear
  end

  it 'sends receipt email for approved non-conversion deposit' do
    wallet = ensure_wallet(user, wallet_type: :ngn, currency: 'NGN')
    tx = Transaction.create!(
      wallet: wallet,
      amount: 5000,
      transaction_type: :deposit,
      coin_type: :bank,
      status: :approved,
      address: 'Wallet funding'
    )

    described_class.perform_now(tx.id)

    tx.reload
    expect(ActionMailer::Base.deliveries.size).to eq(1)
    expect(tx.metadata.dig('receipt_email', 'status')).to eq('sent')
  end

  it 'sends one receipt email for conversion withdrawal leg' do
    wallet = ensure_wallet(user, wallet_type: :ngn, currency: 'NGN')
    quote = FxQuote.create!(
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
      amount_out: 6.2857,
      amount_out_raw: 6.2857,
      expires_at: 5.minutes.from_now,
      executed_at: Time.current
    )
    tx = Transaction.create!(
      wallet: wallet,
      amount: 10_000,
      transaction_type: :withdrawal,
      coin_type: :bank,
      status: :approved,
      address: 'Tunnel Conversion (NGN -> USD)',
      metadata: {
        ledger_hold_reserved: true,
        fx_quote_token: quote.token,
        fx_execution_reference: SecureRandom.uuid
      }
    )
    described_class.perform_now(tx.id)

    expect(ActionMailer::Base.deliveries.size).to eq(1)
  end

  it 'does not send conversion email for deposit leg' do
    wallet = ensure_wallet(user, wallet_type: :usd, currency: 'USD')
    tx = Transaction.create!(
      wallet: wallet,
      amount: 6.2,
      transaction_type: :deposit,
      coin_type: :bank,
      status: :approved,
      address: 'Tunnel Conversion (NGN -> USD)',
      metadata: { fx_quote_token: 'token-123' }
    )

    perform_enqueued_jobs

    tx.reload
    expect(ActionMailer::Base.deliveries).to be_empty
    expect(tx.metadata.dig('receipt_email', 'status')).to be_nil
  end

  it 'is idempotent when already sent' do
    wallet = ensure_wallet(user, wallet_type: :ngn, currency: 'NGN')
    tx = Transaction.create!(
      wallet: wallet,
      amount: 5000,
      transaction_type: :deposit,
      coin_type: :bank,
      status: :approved,
      address: 'Wallet funding',
      metadata: { 'receipt_email' => { 'status' => 'sent', 'attempts' => 1 } }
    )

    perform_enqueued_jobs
    expect(ActionMailer::Base.deliveries).to be_empty

    described_class.perform_now(tx.id)
    expect(ActionMailer::Base.deliveries).to be_empty
  end
end
