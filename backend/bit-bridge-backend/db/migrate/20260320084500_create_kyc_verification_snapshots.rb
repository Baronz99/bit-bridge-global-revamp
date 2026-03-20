class CreateKycVerificationSnapshots < ActiveRecord::Migration[7.1]
  def change
    create_table :kyc_verification_snapshots, id: :uuid do |t|
      t.string :document_type, null: false
      t.string :fingerprint, null: false
      t.string :status, null: false
      t.string :provider
      t.string :first_name
      t.string :last_name
      t.string :date_of_birth
      t.boolean :watchlisted, null: false, default: false
      t.string :provider_reference
      t.datetime :captured_at
      t.datetime :expires_at
      t.jsonb :metadata, null: false, default: {}
      t.timestamps
    end

    add_index :kyc_verification_snapshots, [:document_type, :fingerprint], unique: true,
              name: "index_kyc_verification_snapshots_on_doc_and_fingerprint"
    add_index :kyc_verification_snapshots, :expires_at
  end
end
