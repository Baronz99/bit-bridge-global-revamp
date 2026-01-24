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
      wallet = create(:user).wallet
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
      wallet = create(:user).wallet
      transaction = described_class.create!(
        wallet: wallet,
        amount: 100.0,
        transaction_type: :deposit,
        status: :approved
      )

      expect(transaction.amount_cents).to eq(10_000)
    end
  end
end
