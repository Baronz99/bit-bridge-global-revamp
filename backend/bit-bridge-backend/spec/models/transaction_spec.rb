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

    it 'finalizes USD withdrawal snapshots after wallet debit in the same transaction' do
      skip 'transaction balance snapshot columns not migrated in this DB' unless
        Transaction.column_names.include?('before_book_balance')

      user = create(:user, email: "txn-usd-snapshot-#{SecureRandom.hex(4)}@example.com")
      wallet = user.usd_wallet
      wallet.update!(balance_cents: 10_000)
      tx = nil

      ActiveRecord::Base.transaction do
        tx = described_class.create!(
          wallet: wallet,
          amount: 25,
          transaction_type: :withdrawal,
          status: :approved,
          coin_type: :bank,
          address: 'USD payout'
        )
        wallet.debit_cents!(2_500)
      end

      tx.reload
      expect(tx.before_book_balance.to_d).to eq(100.to_d)
      expect(tx.after_book_balance.to_d).to eq(75.to_d)
      expect(tx.before_available_balance.to_d).to eq(100.to_d)
      expect(tx.after_available_balance.to_d).to eq(75.to_d)
    end

    it 'finalizes snapshots when a USD withdrawal transitions from pending to approved' do
      skip 'transaction balance snapshot columns not migrated in this DB' unless
        Transaction.column_names.include?('before_book_balance')

      user = create(:user, email: "txn-usd-pending-#{SecureRandom.hex(4)}@example.com")
      wallet = user.usd_wallet
      wallet.update!(balance_cents: 8_000)

      tx = described_class.create!(
        wallet: wallet,
        amount: 20,
        transaction_type: :withdrawal,
        status: :pending,
        coin_type: :bank,
        address: 'Pending USD debit'
      )

      ActiveRecord::Base.transaction do
        wallet.debit_cents!(2_000)
        tx.update!(status: :approved)
      end

      tx.reload
      expect(tx.before_book_balance.to_d).to eq(80.to_d)
      expect(tx.after_book_balance.to_d).to eq(60.to_d)
      expect(tx.before_available_balance.to_d).to eq(80.to_d)
      expect(tx.after_available_balance.to_d).to eq(60.to_d)
    end

    it 'does not post additional wallet debits when an approved USD withdrawal is retried' do
      skip 'transaction balance snapshot columns not migrated in this DB' unless
        Transaction.column_names.include?('before_book_balance')

      user = create(:user, email: "txn-usd-retry-#{SecureRandom.hex(4)}@example.com")
      wallet = user.usd_wallet
      wallet.update!(balance_cents: 5_000)
      tx = nil

      ActiveRecord::Base.transaction do
        tx = described_class.create!(
          wallet: wallet,
          amount: 10,
          transaction_type: :withdrawal,
          status: :approved,
          coin_type: :bank,
          address: 'USD retry debit'
        )
        wallet.debit_cents!(1_000)
      end

      balance_after_first_commit = wallet.reload.balance_cents
      snapshot_before_retry = [tx.reload.before_book_balance, tx.after_book_balance]

      expect do
        tx.update!(address: 'USD retry debit updated')
      end.not_to change { wallet.reload.balance_cents }

      expect([tx.reload.before_book_balance, tx.after_book_balance]).to eq(snapshot_before_retry)
      expect(balance_after_first_commit).to eq(4_000)
    end

    it 'uses total debit from fee_breakdown for principal-like USD transactions' do
      skip 'transaction balance snapshot columns not migrated in this DB' unless
        Transaction.column_names.include?('before_book_balance')

      user = create(:user, email: "txn-usd-total-#{SecureRandom.hex(4)}@example.com")
      wallet = user.usd_wallet
      wallet.update!(balance_cents: 10_000)
      tx = nil

      ActiveRecord::Base.transaction do
        tx = described_class.create!(
          wallet: wallet,
          amount: 10,
          transaction_type: :withdrawal,
          status: :approved,
          coin_type: :bank,
          address: 'USD funding principal',
          metadata: {
            'subtype' => 'card_funding_principal',
            'fee_breakdown' => {
              'principal_usd' => 10.0,
              'funding_fee_usd' => 1.0,
              'total_debit_usd' => 11.0
            }
          }
        )
        wallet.debit_cents!(1_100)
      end

      tx.reload
      expect(tx.before_book_balance.to_d).to eq(100.to_d)
      expect(tx.after_book_balance.to_d).to eq(89.to_d)
      expect(tx.before_available_balance.to_d).to eq(100.to_d)
      expect(tx.after_available_balance.to_d).to eq(89.to_d)
    end

    it 'finalizes USD snapshots under wallet lock for approved withdrawals' do
      skip 'transaction balance snapshot columns not migrated in this DB' unless
        Transaction.column_names.include?('before_book_balance')

      user = create(:user, email: "txn-usd-lock-#{SecureRandom.hex(4)}@example.com")
      wallet = user.usd_wallet
      wallet.update!(balance_cents: 3_000)

      expect_any_instance_of(Wallet).to receive(:with_lock).at_least(:once).and_call_original

      ActiveRecord::Base.transaction do
        described_class.create!(
          wallet: wallet,
          amount: 10,
          transaction_type: :withdrawal,
          status: :approved,
          coin_type: :bank,
          address: 'USD lock check'
        )
        wallet.debit_cents!(1_000)
      end
    end
  end
end
