require 'rails_helper'

RSpec.describe BuyPowerPaymentService, type: :service do
  describe '#confirm_subscription hold guard' do
    it 'does not fail fast with insufficient funds when same-order hold is already active' do
      allow(Config::Bills).to receive(:validate!).and_return(true)
      allow(Config::Bills).to receive(:base_url).and_return('http://example.test')
      allow(Config::Bills).to receive(:token).and_return('token')

      user = create(:user)
      wallet = user.wallet
      Transaction.create!(wallet: wallet, amount: 1_000, bonus: 0, status: :approved, transaction_type: :deposit)

      bill_order = BillOrder.create!(
        user: user,
        meter_number: '08012345678',
        meter_type: nil,
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

      WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: bill_order, amount: bill_order.total_amount)

      expect(described_class).to receive(:post).and_raise(RuntimeError, 'provider_marker')

      result = described_class.new.confirm_subscription(bill_order, 'wallet', false, request_id: 'spec-hold-guard')

      expect(result[:status]).to eq('error')
      expect(result[:response]).to eq('provider_marker')
      expect(bill_order.reload.status).to eq('failed')
      expect(WalletLedgerEntry.where(bill_order: bill_order, entry_type: :release).count).to eq(1)
    end
  end
end
