# frozen_string_literal: true

require 'rails_helper'

RSpec.describe BuyPowerPaymentService do
  describe '#process_payment' do
    before do
      allow(Config::Bills).to receive(:validate!).and_return(true)
      allow(Config::Bills).to receive(:base_url).and_return('http://example.test')
      allow(Config::Bills).to receive(:token).and_return('token')
    end

    it 'fails electricity purchase with invalid vendType' do
      user = create(:user)
      service = described_class.new

      allow(service).to receive(:verify_meter).and_raise(
        'Invalid vendType provided. Valid types are PREPAID or POSTPAID'
      )

      result = service.process_payment(user, {
        billersCode: '1234567890',
        amount: 1000,
        meter_type: 'INVALID',
        service_type: 'ELECTRICITY',
        biller: 'ikeja',
        email: user.email
      })

      expect(result[:status]).to eq('error')
      expect(result[:response]).to include('Invalid vendType provided')
    end

    it 'defaults vendType to PREPAID for TV purchase without vendType' do
      user = create(:user)
      service = described_class.new

      expect(service).not_to receive(:verify_meter)
      allow(service).to receive(:verify_tv_account).and_return({
        status: 'success',
        response: { 'responseCode' => '00', 'error' => false, 'name' => 'John Doe' }
      })

      result = service.process_payment(user, {
        billersCode: '9876543210',
        amount: 2500,
        tariff_class: 'A',
        service_type: 'TV',
        biller: 'dstv',
        email: user.email
      })

      expect(result[:status]).to eq('success')
      expect(result[:response].meter_type).to eq('PREPAID')
      expect(result[:response].name).to eq('John Doe')
      expect(result[:response].service_type).to eq('TV')
    end

    it 'uses provided vendType for TV purchase' do
      user = create(:user)
      service = described_class.new

      expect(service).not_to receive(:verify_meter)
      allow(service).to receive(:verify_tv_account).and_return({
        status: 'success',
        response: { 'responseCode' => '00', 'error' => false, 'name' => 'John Doe' }
      })

      result = service.process_payment(user, {
        billersCode: '9876543210',
        amount: 2500,
        meter_type: 'PREPAID',
        tariff_class: 'A',
        service_type: 'TV',
        biller: 'dstv',
        email: user.email
      })

      expect(result[:status]).to eq('success')
      expect(result[:response].meter_type).to eq('PREPAID')
      expect(result[:response].name).to eq('John Doe')
      expect(result[:response].service_type).to eq('TV')
    end

    it 'sets TV name only on business-success verify payload' do
      user = create(:user)
      service = described_class.new

      allow(service).to receive(:verify_tv_account).and_return({
        status: 'success',
        response: { 'responseCode' => 'E01', 'error' => true, 'name' => 'John Doe' }
      })

      result = service.process_payment(user, {
        billersCode: '9876543210',
        amount: 2500,
        tariff_class: 'A',
        service_type: 'TV',
        biller: 'dstv',
        email: user.email
      })

      expect(result[:status]).to eq('success')
      expect(result[:response].name).to be_nil
    end

    it 'persists provider_response for TV verify failure' do
      user = create(:user)
      service = described_class.new

      allow(service).to receive(:verify_tv_account).and_return({
        status: 'success',
        response: { 'responseCode' => 'E01', 'error' => true, 'message' => 'Invalid decoder' }
      })

      result = service.process_payment(user, {
        billersCode: '9876543210',
        amount: 2500,
        tariff_class: 'A',
        service_type: 'TV',
        biller: 'dstv',
        email: user.email
      })

      expect(result[:status]).to eq('success')
      expect(result[:response].name).to be_nil
      order = BillOrder.find(result[:response].id)
      expect(order.provider_response).to include('responseCode' => 'E01', 'message' => 'Invalid decoder')
    end

    it 'accepts TV verify success payload with extra keys' do
      user = create(:user)
      service = described_class.new

      allow(service).to receive(:verify_tv_account).and_return({
        status: 'success',
        response: {
          'responseCode' => '00',
          'error' => false,
          'name' => 'Jane Doe',
          'vendType' => 'PREPAID',
          'status' => 'success'
        }
      })

      result = service.process_payment(user, {
        billersCode: '9876543210',
        amount: 2500,
        tariff_class: 'A',
        service_type: 'TV',
        biller: 'dstv',
        email: user.email
      })

      expect(result[:status]).to eq('success')
      expect(result[:response].name).to eq('Jane Doe')
    end

    it 'returns error without calling verify when TV amount is blank' do
      user = create(:user)
      service = described_class.new

      expect(service).not_to receive(:verify_tv_account)

      result = service.process_payment(user, {
        billersCode: '9876543210',
        amount: '',
        tariff_class: 'A',
        service_type: 'TV',
        biller: 'dstv',
        email: user.email
      })

      expect(result[:status]).to eq('error')
      expect(result[:response]).to eq('Amount is required')
    end
  end

  describe '#confirm_subscription' do
    it 'returns success when wallet commission is nil and vend succeeds' do
      allow(Config::Bills).to receive(:validate!).and_return(true)
      allow(Config::Bills).to receive(:base_url).and_return('http://example.test')
      allow(Config::Bills).to receive(:token).and_return('token')

      response = {
        'data' => { 'units' => '1', 'token' => 'abc', 'id' => 'txn_1' },
        'message' => 'OK'
      }
      def response.success?
        true
      end

      allow(described_class).to receive(:post).and_return(response)

      user = create(:user)
      wallet = user.wallet
      wallet.update!(commission: nil)
      Transaction.create!(
        wallet: wallet,
        amount: 10_000,
        bonus: 0,
        status: :approved,
        transaction_type: :deposit
      )

      bill_order = BillOrder.create!(
        user: user,
        meter_number: '08012345678',
        meter_type: 'PREPAID',
        address: 'Test Address',
        name: 'Test User',
        tariff_class: 'A',
        service_type: 'VTU',
        email: user.email,
        amount: 1000,
        phone: '08012345678',
        biller: 'MTN',
        description: 'Airtime',
        payment_type: 'online',
        payment_method: 'wallet'
      )

      result = described_class.new.confirm_subscription(bill_order, 'wallet', false, request_id: 'spec')

      expect(result[:status]).to eq('success')
      expect(bill_order.reload.status).to eq('completed')
      expect(WalletLedgerEntry.where(bill_order: bill_order).hold.count).to eq(1)
      expect(WalletLedgerEntry.where(bill_order: bill_order).release.count).to eq(0)
      expect(WalletLedgerEntry.where(bill_order: bill_order).debit.count).to eq(1)
    end

    it 'applies commission once for VTU and does not double-apply on retry' do
      allow(Config::Bills).to receive(:validate!).and_return(true)
      allow(Config::Bills).to receive(:base_url).and_return('http://example.test')
      allow(Config::Bills).to receive(:token).and_return('token')

      response = {
        'data' => { 'units' => '1', 'token' => 'abc', 'id' => 'txn_1' },
        'message' => 'OK'
      }
      def response.success?
        true
      end

      allow(described_class).to receive(:post).and_return(response)

      user = create(:user)
      wallet = user.wallet
      wallet.update!(commission: 0)
      Transaction.create!(
        wallet: wallet,
        amount: 10_000,
        bonus: 0,
        status: :approved,
        transaction_type: :deposit
      )

      bill_order = BillOrder.create!(
        user: user,
        meter_number: '08012345678',
        meter_type: 'PREPAID',
        address: 'Test Address',
        name: 'Test User',
        tariff_class: 'A',
        service_type: 'VTU',
        email: user.email,
        amount: 1000,
        phone: '08012345678',
        biller: 'MTN',
        description: 'Airtime',
        payment_type: 'online',
        payment_method: 'wallet'
      )

      described_class.new.confirm_subscription(bill_order, 'wallet', false, request_id: 'spec')
      expect(wallet.reload.commission.to_f).to eq(10.0)

      expect do
        described_class.new.confirm_subscription(bill_order, 'wallet', false, request_id: 'spec')
      end.not_to change { wallet.reload.commission }
    end

    it 'treats use_commission "false" as false for balance checks' do
      allow(Config::Bills).to receive(:validate!).and_return(true)
      allow(Config::Bills).to receive(:base_url).and_return('http://example.test')
      allow(Config::Bills).to receive(:token).and_return('token')

      user = create(:user)
      wallet = user.wallet
      wallet.update!(commission: 0)
      Transaction.create!(
        wallet: wallet,
        amount: 50,
        bonus: 0,
        status: :approved,
        transaction_type: :deposit
      )

      bill_order = BillOrder.create!(
        user: user,
        meter_number: '08012345678',
        meter_type: 'PREPAID',
        address: 'Test Address',
        name: 'Test User',
        tariff_class: 'A',
        service_type: 'VTU',
        email: user.email,
        amount: 1000,
        phone: '08012345678',
        biller: 'MTN',
        description: 'Airtime',
        payment_type: 'online',
        payment_method: 'wallet'
      )

      expect(described_class).not_to receive(:post)
      result = described_class.new.confirm_subscription(bill_order, 'wallet', 'false', request_id: 'spec')

      expect(result[:status]).to eq('error')
      expect(result[:response]).to eq('Insufficient funds')
    end

    it 'treats use_commission false as false for balance checks' do
      allow(Config::Bills).to receive(:validate!).and_return(true)
      allow(Config::Bills).to receive(:base_url).and_return('http://example.test')
      allow(Config::Bills).to receive(:token).and_return('token')

      user = create(:user)
      wallet = user.wallet
      wallet.update!(commission: 0)
      Transaction.create!(
        wallet: wallet,
        amount: 50,
        bonus: 0,
        status: :approved,
        transaction_type: :deposit
      )

      bill_order = BillOrder.create!(
        user: user,
        meter_number: '08012345678',
        meter_type: 'PREPAID',
        address: 'Test Address',
        name: 'Test User',
        tariff_class: 'A',
        service_type: 'VTU',
        email: user.email,
        amount: 1000,
        phone: '08012345678',
        biller: 'MTN',
        description: 'Airtime',
        payment_type: 'online',
        payment_method: 'wallet'
      )

      expect(described_class).not_to receive(:post)
      result = described_class.new.confirm_subscription(bill_order, 'wallet', false, request_id: 'spec')

      expect(result[:status]).to eq('error')
      expect(result[:response]).to eq('Insufficient funds')
    end

    it 'blocks wallet purchase when ledger holds already use available balance' do
      allow(Config::Bills).to receive(:validate!).and_return(true)
      allow(Config::Bills).to receive(:base_url).and_return('http://example.test')
      allow(Config::Bills).to receive(:token).and_return('token')

      user = create(:user)
      wallet = user.wallet
      Transaction.create!(
        wallet: wallet,
        amount: 10_000,
        bonus: 0,
        status: :approved,
        transaction_type: :deposit
      )

      other_bill_order = BillOrder.create!(
        user: user,
        meter_number: '08012345679',
        meter_type: 'PREPAID',
        address: 'Hold Address',
        name: 'Hold User',
        tariff_class: 'A',
        service_type: 'VTU',
        email: user.email,
        amount: 9_000,
        phone: '08012345670',
        biller: 'MTN',
        description: 'Airtime',
        payment_type: 'online',
        payment_method: 'wallet'
      )

      WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: other_bill_order, amount: 9_000)

      bill_order = BillOrder.create!(
        user: user,
        meter_number: '08012345678',
        meter_type: 'PREPAID',
        address: 'Test Address',
        name: 'Test User',
        tariff_class: 'A',
        service_type: 'VTU',
        email: user.email,
        amount: 1_500,
        phone: '08012345678',
        biller: 'MTN',
        description: 'Airtime',
        payment_type: 'online',
        payment_method: 'wallet'
      )

      result = described_class.new.confirm_subscription(bill_order, 'wallet', false, request_id: 'spec')
      expect(result[:status]).to eq('error')
      expect(result[:response]).to eq('Insufficient funds')
      expect(bill_order.reload.status).to eq('initialized')
    end

    it 'does not decline card/online orders when vend fails' do
      allow(Config::Bills).to receive(:validate!).and_return(true)
      allow(Config::Bills).to receive(:base_url).and_return('http://example.test')
      allow(Config::Bills).to receive(:token).and_return('token')

      response = { 'message' => 'Vend failed' }
      def response.success?
        false
      end

      allow(described_class).to receive(:post).and_return(response)

      user = create(:user)
      bill_order = BillOrder.create!(
        user: user,
        meter_number: '08012345678',
        meter_type: 'PREPAID',
        address: 'Test Address',
        name: 'Test User',
        tariff_class: 'A',
        service_type: 'VTU',
        email: user.email,
        amount: 1000,
        phone: '08012345678',
        biller: 'MTN',
        description: 'Airtime',
        payment_type: 'online',
        payment_method: 'card'
      )

      result = described_class.new.confirm_subscription(bill_order, 'card', false, request_id: 'spec')

      expect(result[:status]).to eq('error')
      expect(bill_order.reload.status).to eq('initialized')
      expect(bill_order.reason).to include('Vend failed')
    end

    it 'does not apply commission for non-VTU/DATA orders' do
      allow(Config::Bills).to receive(:validate!).and_return(true)
      allow(Config::Bills).to receive(:base_url).and_return('http://example.test')
      allow(Config::Bills).to receive(:token).and_return('token')

      response = {
        'data' => { 'units' => '1', 'token' => 'abc', 'id' => 'txn_1' },
        'message' => 'OK'
      }
      def response.success?
        true
      end

      allow(described_class).to receive(:post).and_return(response)

      user = create(:user)
      wallet = user.wallet
      wallet.update!(commission: 0)
      Transaction.create!(
        wallet: wallet,
        amount: 10_000,
        bonus: 0,
        status: :approved,
        transaction_type: :deposit
      )

      bill_order = BillOrder.create!(
        user: user,
        meter_number: '08012345678',
        meter_type: 'PREPAID',
        address: 'Test Address',
        name: 'Test User',
        tariff_class: 'A',
        service_type: 'TV',
        email: user.email,
        amount: 1000,
        phone: '08012345678',
        biller: 'DSTV',
        description: 'TV',
        payment_type: 'online',
        payment_method: 'wallet'
      )

      described_class.new.confirm_subscription(bill_order, 'wallet', false, request_id: 'spec')
      expect(wallet.reload.commission.to_f).to eq(0.0)
    end

    it 'keeps wallet orders processing on non-terminal provider response' do
      allow(Config::Bills).to receive(:validate!).and_return(true)
      allow(Config::Bills).to receive(:base_url).and_return('http://example.test')
      allow(Config::Bills).to receive(:token).and_return('token')

      response = { 'message' => 'Provider timeout' }
      def response.success?
        false
      end

      allow(described_class).to receive(:post).and_return(response)

      user = create(:user)
      wallet = user.wallet
      Transaction.create!(
        wallet: wallet,
        amount: 10_000,
        bonus: 0,
        status: :approved,
        transaction_type: :deposit
      )

      bill_order = BillOrder.create!(
        user: user,
        meter_number: '08012345678',
        meter_type: 'PREPAID',
        address: 'Test Address',
        name: 'Test User',
        tariff_class: 'A',
        service_type: 'VTU',
        email: user.email,
        amount: 1000,
        phone: '08012345678',
        biller: 'MTN',
        description: 'Airtime',
        payment_type: 'online',
        payment_method: 'wallet'
      )

      result = described_class.new.confirm_subscription(bill_order, 'wallet', false, request_id: 'spec')

      expect(result[:status]).to eq('pending')
      expect(bill_order.reload.status).to eq('processing')
      expect(WalletLedgerEntry.where(bill_order: bill_order).hold.count).to eq(1)
      expect(WalletLedgerEntry.where(bill_order: bill_order).release.count).to eq(0)
    end

    it 'releases hold and marks failed on hard provider error' do
      allow(Config::Bills).to receive(:validate!).and_return(true)
      allow(Config::Bills).to receive(:base_url).and_return('http://example.test')
      allow(Config::Bills).to receive(:token).and_return('token')

      response = { 'error' => true, 'message' => 'Invalid Phone Number. Please Check.' }
      def response.success?
        false
      end

      allow(described_class).to receive(:post).and_return(response)

      user = create(:user)
      wallet = user.wallet
      Transaction.create!(
        wallet: wallet,
        amount: 10_000,
        bonus: 0,
        status: :approved,
        transaction_type: :deposit
      )

      bill_order = BillOrder.create!(
        user: user,
        meter_number: '08012345678',
        meter_type: 'PREPAID',
        address: 'Test Address',
        name: 'Test User',
        tariff_class: 'A',
        service_type: 'VTU',
        email: user.email,
        amount: 1000,
        phone: '08012345678',
        biller: 'MTN',
        description: 'Airtime',
        payment_type: 'online',
        payment_method: 'wallet'
      )

      result = described_class.new.confirm_subscription(bill_order, 'wallet', false, request_id: 'spec')

      expect(result[:status]).to eq('error')
      expect(bill_order.reload.status).to eq('failed')
      expect(WalletLedgerEntry.where(bill_order: bill_order).hold.count).to eq(1)
      expect(WalletLedgerEntry.where(bill_order: bill_order).release.count).to eq(1)
      expect(WalletLedgerEntry.where(bill_order: bill_order).debit.count).to eq(0)
      expect(WalletLedgerEntry.where(bill_order: bill_order).refund.count).to eq(0)
    end

    it 'skips releasing the hold if a debit already exists' do
      allow(Config::Bills).to receive(:validate!).and_return(true)
      allow(Config::Bills).to receive(:base_url).and_return('http://example.test')
      allow(Config::Bills).to receive(:token).and_return('token')

      user = create(:user)
      wallet = user.wallet
      Transaction.create!(
        wallet: wallet,
        amount: 10_000,
        bonus: 0,
        status: :approved,
        transaction_type: :deposit
      )

      bill_order = BillOrder.create!(
        user: user,
        meter_number: '08012345678',
        meter_type: 'PREPAID',
        address: 'Test Address',
        name: 'Test User',
        tariff_class: 'A',
        service_type: 'VTU',
        email: user.email,
        amount: 1_000,
        phone: '08012345678',
        biller: 'MTN',
        description: 'Airtime',
        payment_type: 'online',
        payment_method: 'wallet'
      )

      WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: bill_order, amount: 1_000)
      WalletLedgerEntry.record_debit!(wallet: wallet, bill_order: bill_order, amount: 1_000)

      service = described_class.new
      result = service.send(:handle_wallet_failure, bill_order, 'wallet', 'provider error', {}, status: 'failed')

      expect(result[:status]).to eq('error')
      expect(WalletLedgerEntry.where(bill_order: bill_order, entry_type: :release)).to be_empty
      expect(WalletLedgerEntry.where(bill_order: bill_order, entry_type: :debit).count).to eq(1)
    end

    it 'does not duplicate ledger entries on retry after hard error' do
      allow(Config::Bills).to receive(:validate!).and_return(true)
      allow(Config::Bills).to receive(:base_url).and_return('http://example.test')
      allow(Config::Bills).to receive(:token).and_return('token')

      response = { 'error' => true, 'message' => 'Invalid Phone Number. Please Check.' }
      def response.success?
        false
      end

      allow(described_class).to receive(:post).and_return(response)

      user = create(:user)
      wallet = user.wallet
      Transaction.create!(
        wallet: wallet,
        amount: 10_000,
        bonus: 0,
        status: :approved,
        transaction_type: :deposit
      )

      bill_order = BillOrder.create!(
        user: user,
        meter_number: '08012345678',
        meter_type: 'PREPAID',
        address: 'Test Address',
        name: 'Test User',
        tariff_class: 'A',
        service_type: 'VTU',
        email: user.email,
        amount: 1000,
        phone: '08012345678',
        biller: 'MTN',
        description: 'Airtime',
        payment_type: 'online',
        payment_method: 'wallet'
      )

      described_class.new.confirm_subscription(bill_order, 'wallet', false, request_id: 'spec')
      described_class.new.confirm_subscription(bill_order, 'wallet', false, request_id: 'spec')

      expect(WalletLedgerEntry.where(bill_order: bill_order).hold.count).to eq(1)
      expect(WalletLedgerEntry.where(bill_order: bill_order).release.count).to eq(1)
      expect(WalletLedgerEntry.where(bill_order: bill_order).refund.count).to eq(0)
      expect(WalletLedgerEntry.where(bill_order: bill_order).debit.count).to eq(0)
    end

    it 'does not run wallet ledger for non-wallet orders' do
      allow(Config::Bills).to receive(:validate!).and_return(true)
      allow(Config::Bills).to receive(:base_url).and_return('http://example.test')
      allow(Config::Bills).to receive(:token).and_return('token')

      user = create(:user)
      bill_order = BillOrder.create!(
        user: user,
        meter_number: '08012345678',
        meter_type: 'PREPAID',
        address: 'Test Address',
        name: 'Test User',
        tariff_class: 'A',
        service_type: 'VTU',
        email: user.email,
        amount: 1000,
        phone: '08012345678',
        biller: 'MTN',
        description: 'Airtime',
        payment_type: 'online',
        payment_method: 'card'
      )

      expect(WalletLedgerEntry).not_to receive(:ensure_hold!)
      expect(WalletLedgerEntry).not_to receive(:record_debit!)
      expect(WalletLedgerEntry).not_to receive(:release_hold!)
      expect(WalletLedgerEntry).not_to receive(:record_refund!)

      described_class.new.confirm_subscription(bill_order, 'wallet', false, request_id: 'spec')
    end

    it 'releases hold on provider refund response' do
      allow(Config::Bills).to receive(:validate!).and_return(true)
      allow(Config::Bills).to receive(:base_url).and_return('http://example.test')
      allow(Config::Bills).to receive(:token).and_return('token')

      response = { 'data' => { 'status' => 'REFUNDED' }, 'message' => 'Refunded' }
      def response.success?
        false
      end

      allow(described_class).to receive(:post).and_return(response)

      user = create(:user)
      wallet = user.wallet
      Transaction.create!(
        wallet: wallet,
        amount: 10_000,
        bonus: 0,
        status: :approved,
        transaction_type: :deposit
      )

      bill_order = BillOrder.create!(
        user: user,
        meter_number: '08012345678',
        meter_type: 'PREPAID',
        address: 'Test Address',
        name: 'Test User',
        tariff_class: 'A',
        service_type: 'VTU',
        email: user.email,
        amount: 1000,
        phone: '08012345678',
        biller: 'MTN',
        description: 'Airtime',
        payment_type: 'online',
        payment_method: 'wallet'
      )

      result = described_class.new.confirm_subscription(bill_order, 'wallet', false, request_id: 'spec')

      expect(result[:status]).to eq('error')
      expect(bill_order.reload.status).to eq('refunded')
      expect(WalletLedgerEntry.where(bill_order: bill_order).release.count).to eq(1)
      expect(WalletLedgerEntry.where(bill_order: bill_order).refund.count).to eq(1)
    end
  end
end
