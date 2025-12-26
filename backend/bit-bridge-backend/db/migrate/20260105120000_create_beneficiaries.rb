# frozen_string_literal: true

class CreateBeneficiaries < ActiveRecord::Migration[7.1]
  def change
    create_table :beneficiaries, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.uuid :user_id, null: false
      t.string :vendor, null: false, default: 'anchor'
      t.string :bank_code, null: false
      t.string :bank_name
      t.string :account_number, null: false
      t.string :account_name
      t.string :counter_party_id, null: false
      t.timestamps
    end

    add_index :beneficiaries, [:user_id, :vendor, :bank_code, :account_number],
              unique: true, name: 'index_beneficiaries_on_user_vendor_bank_account'
    add_index :beneficiaries, :counter_party_id
    add_foreign_key :beneficiaries, :users
  end
end
