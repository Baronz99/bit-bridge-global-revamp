# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Admin Users index with NGN balance', type: :request do
  let(:admin) { create(:user, role: 'admin', admin_role: 'compliance') }
  let(:headers) { auth_headers(admin) }

  def create_deposit(wallet, amount)
    Transaction.create!(
      wallet: wallet,
      transaction_type: :deposit,
      status: :approved,
      amount: amount
    )
  end

  def create_hold(wallet, bill_order, amount)
    WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: bill_order, amount: amount)
  end

  def create_debit(wallet, bill_order, amount)
    WalletLedgerEntry.record_debit!(wallet: wallet, bill_order: bill_order, amount: amount)
  end

  def count_queries
    count = 0
    callback = ->(_name, _start, _finish, _id, payload) { count += 1 unless payload[:name] == 'SCHEMA' }
    ActiveSupport::Notifications.subscribed(callback, 'sql.active_record') do
      yield
    end
    count
  end

  it 'returns NGN wallet balance for each user without N+1' do
    user1 = create(:user)
    user2 = create(:user)
    admin.update!(admin_auth_time: Time.current)

    bo1 = BillOrder.create!(
      user: user1,
      meter_number: '111',
      meter_type: 'PREPAID',
      address: 'Addr',
      name: 'U1',
      tariff_class: 'A',
      service_type: 'VTU',
      email: user1.email,
      amount: 1000,
      phone: '0800',
      biller: 'MTN',
      description: 'Airtime',
      payment_type: 'online',
      payment_method: 'wallet'
    )

    create_deposit(user1.wallet, 2000)
    create_hold(user1.wallet, bo1, 500)

    queries = count_queries do
      get '/api/v1/admin/users', headers: headers
    end

    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    data = json['data']
    expect(data.map { |u| u['id'] }).to include(user1.id, user2.id)

    user1_row = data.find { |u| u['id'] == user1.id }
    expect(user1_row['ngn_wallet_balance']).to eq(1500.0)

    expect(queries).to be < 25
  end

  it 'exposes negative raw balance for admin reporting' do
    user = create(:user)
    admin.update!(admin_auth_time: Time.current)

    bill_order = BillOrder.create!(
      user: user,
      meter_number: 'neg-raw',
      meter_type: 'PREPAID',
      address: 'Test',
      name: 'Negative Raw',
      tariff_class: 'A',
      service_type: 'VTU',
      email: user.email,
      amount: 1000,
      phone: '0800',
      biller: 'MTN',
      description: 'Ledger negative',
      payment_type: 'online',
      payment_method: 'wallet'
    )

    create_deposit(user.wallet, 500)
    WalletLedgerEntry.create!(
      wallet: user.wallet,
      bill_order: bill_order,
      entry_type: :debit,
      amount: 1000
    )

    get '/api/v1/admin/users', headers: headers

    expect(response).to have_http_status(:ok)
    data = JSON.parse(response.body)['data']
    row = data.find { |u| u['id'] == user.id }
    expect(row['ngn_wallet_balance']).to eq(0.0)
    expect(row['ngn_wallet_raw_balance']).to eq(-500.0)
  end
end
