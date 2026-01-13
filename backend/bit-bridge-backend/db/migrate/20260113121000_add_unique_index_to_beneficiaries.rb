# frozen_string_literal: true

class AddUniqueIndexToBeneficiaries < ActiveRecord::Migration[7.0]
  def change
    return if index_exists?(:beneficiaries, %i[user_id vendor bank_code account_number],
                            unique: true, name: 'index_beneficiaries_on_user_vendor_bank_account')

    add_index :beneficiaries, %i[user_id vendor bank_code account_number],
              unique: true, name: 'index_beneficiaries_on_user_vendor_bank_account'
  end
end
