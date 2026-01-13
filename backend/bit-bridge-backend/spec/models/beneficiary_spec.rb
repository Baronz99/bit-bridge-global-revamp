# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Beneficiary, type: :model do
  it 'enforces uniqueness on user/vendor/bank_code/account_number' do
    user = create(:user)
    Beneficiary.create!(
      user: user,
      vendor: 'anchor',
      bank_code: '000',
      bank_name: 'Test Bank',
      account_number: '1234567890',
      account_name: 'Jane Doe',
      counter_party_id: 'cp_1'
    )

    duplicate = Beneficiary.new(
      user: user,
      vendor: 'anchor',
      bank_code: '000',
      bank_name: 'Test Bank',
      account_number: '1234567890',
      account_name: 'Jane Doe',
      counter_party_id: 'cp_2'
    )

    expect(duplicate).not_to be_valid
    expect(duplicate.errors[:account_number]).to be_present
  end
end
