# frozen_string_literal: true

class Beneficiary < ApplicationRecord
  belongs_to :user

  validates :vendor, :bank_code, :account_number, :counter_party_id, presence: true
  validates :account_number, uniqueness: { scope: %i[user_id vendor bank_code] }

  def counter_party_payload
    {
      'id' => counter_party_id,
      'type' => 'CounterParty',
      'attributes' => {
        'accountName' => account_name,
        'accountNumber' => account_number,
        'bankCode' => bank_code,
        'bank' => {
          'name' => bank_name.presence || bank_code
        }
      }
    }
  end
end
