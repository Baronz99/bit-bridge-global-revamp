# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Account, type: :model do
  it 'allows only one active anchor account per user' do
    user = create(:user, email: "account-model-#{SecureRandom.hex(4)}@example.com")
    Account.create!(user: user, vendor: 'anchor', active: true, status: :completed)

    duplicate = Account.new(user: user, vendor: 'anchor', active: true, status: :completed)

    expect(duplicate).not_to be_valid
    expect(duplicate.errors[:active]).to include('only one active Anchor account is allowed per user')
  end

  it 'allows additional inactive anchor accounts for reconciliation history' do
    user = create(:user, email: "account-model-inactive-#{SecureRandom.hex(4)}@example.com")
    Account.create!(user: user, vendor: 'anchor', active: true, status: :completed)

    historical = Account.new(user: user, vendor: 'anchor', active: false, status: :completed)

    expect(historical).to be_valid
  end
end
