# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transaction, type: :model do
  describe '#email' do
    it 'returns nil without raising when associations are missing' do
      transaction = described_class.new(wallet: nil)

      expect { transaction.email }.not_to raise_error
      expect(transaction.email).to be_nil
    end

    it 'returns nil without raising when wallet has no user' do
      transaction = described_class.new(wallet: Wallet.new)

      expect { transaction.email }.not_to raise_error
      expect(transaction.email).to be_nil
    end
  end

  describe 'money precision' do
    it 'rejects amounts with more than 2 decimal places' do
      wallet = create(:user, email: "txn-precision-#{SecureRandom.hex(4)}@example.com").wallet
      transaction = described_class.new(
        wallet: wallet,
        amount: 0.001,
        transaction_type: :deposit,
        status: :approved
      )

      expect(transaction).not_to be_valid
      expect(transaction.errors[:amount]).to include('must have at most 2 decimal places')
    end
  end

  describe 'money cents' do
    it 'writes cents alongside decimal amounts' do
      wallet = create(:user, email: "txn-cents-#{SecureRandom.hex(4)}@example.com").wallet
      transaction = described_class.create!(
        wallet: wallet,
        amount: 100.0,
        transaction_type: :deposit,
        status: :approved
      )

      expect(transaction.amount_cents).to eq(10_000)
    end
  end

  describe 'balance snapshots' do
    it 'captures before and after wallet balances on transaction create' do
      skip 'transaction balance snapshot columns not migrated in this DB' unless
        Transaction.column_names.include?('before_book_balance')

      user = create(:user, email: "txn-snapshot-#{SecureRandom.hex(4)}@example.com")
      wallet = user.ngn_wallet
      wallet.transactions.create!(
        transaction_type: :deposit,
        status: :approved,
        amount: 100,
        coin_type: :bank,
        address: 'Seed'
      )

      tx = described_class.create!(
        wallet: wallet,
        amount: 25,
        transaction_type: :withdrawal,
        status: :approved,
        coin_type: :bank,
        address: 'Payout'
      )

      expect(tx.before_book_balance.to_d).to eq(100.to_d)
      expect(tx.after_book_balance.to_d).to eq(75.to_d)
      expect(tx.before_available_balance.to_d).to eq(100.to_d)
      expect(tx.after_available_balance.to_d).to eq(75.to_d)
    end
  end
end
