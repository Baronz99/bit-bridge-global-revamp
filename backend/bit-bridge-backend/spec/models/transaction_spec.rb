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
end
