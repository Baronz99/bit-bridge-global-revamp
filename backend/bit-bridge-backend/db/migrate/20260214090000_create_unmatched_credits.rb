class CreateUnmatchedCredits < ActiveRecord::Migration[7.1]
  def change
    create_table :unmatched_credits, id: :uuid do |t|
      t.string :provider, null: false
      t.string :reference
      t.string :provider_reference, null: false
      t.string :account_number
      t.string :account_name
      t.string :bank_code
      t.string :bank_name
      t.decimal :amount, precision: 18, scale: 2
      t.string :currency, null: false, default: 'NGN'
      t.string :reason, null: false
      t.string :status, null: false, default: 'pending'
      t.jsonb :payload, null: false, default: {}
      t.datetime :resolved_at
      t.uuid :user_id
      t.uuid :wallet_id

      t.timestamps
    end

    add_index :unmatched_credits, [:provider, :provider_reference], unique: true
    add_index :unmatched_credits, :status
    add_index :unmatched_credits, :created_at
  end
end

