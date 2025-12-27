# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.1].define(version: 2026_01_06_100000) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pgcrypto"
  enable_extension "plpgsql"

  create_table "accounts", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "vendor"
    t.string "bvn"
    t.uuid "user_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "account_number"
    t.string "bank_code"
    t.string "bank_name"
    t.string "account_name"
    t.string "currency"
    t.string "account_id"
    t.integer "account_type", default: 0
    t.string "address"
    t.string "city"
    t.string "state"
    t.string "postal_code"
    t.string "country", default: "NG"
    t.boolean "active", default: false
    t.integer "status", default: 0
    t.integer "gender", default: 0
    t.date "dob"
    t.string "useable_id"
    t.index ["account_id"], name: "index_accounts_on_account_id", unique: true
    t.index ["user_id"], name: "index_accounts_on_user_id"
  end

  create_table "active_storage_attachments", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "name", null: false
    t.string "record_type", null: false
    t.uuid "record_id", null: false
    t.uuid "blob_id", null: false
    t.datetime "created_at", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "key", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.text "metadata"
    t.string "service_name", null: false
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.datetime "created_at", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "bank_transactions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "description"
    t.decimal "amount"
    t.string "recipient_id"
    t.string "transaction_id"
    t.uuid "account_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id"], name: "index_bank_transactions_on_account_id"
  end

  create_table "beneficiaries", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.string "vendor", default: "anchor", null: false
    t.string "bank_code", null: false
    t.string "bank_name"
    t.string "account_number", null: false
    t.string "account_name"
    t.string "counter_party_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["counter_party_id"], name: "index_beneficiaries_on_counter_party_id"
    t.index ["user_id", "vendor", "bank_code", "account_number"], name: "index_beneficiaries_on_user_vendor_bank_account", unique: true
  end

  create_table "bill_orders", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.integer "status", default: 0
    t.string "meter_number"
    t.decimal "amount"
    t.decimal "total_amount"
    t.integer "meter_type", default: 0
    t.string "phone"
    t.string "biller"
    t.string "service_type"
    t.integer "payment_type", default: 0
    t.string "email"
    t.string "tariff_class"
    t.string "name"
    t.uuid "order_detail_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "address"
    t.string "units"
    t.string "transaction_id"
    t.string "token"
    t.uuid "user_id"
    t.decimal "usd_amount"
    t.integer "payment_method", default: 0
    t.decimal "service_charge", default: "0.0"
    t.string "description"
    t.boolean "use_commission"
    t.text "reason"
    t.index ["order_detail_id"], name: "index_bill_orders_on_order_detail_id"
    t.index ["user_id"], name: "index_bill_orders_on_user_id"
  end

  create_table "card_tokens", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.boolean "reveal", default: false
    t.uuid "order_item_id", null: false
    t.string "token"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["order_item_id"], name: "index_card_tokens_on_order_item_id"
  end

  create_table "cards", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "cardholder_id"
    t.string "card_id"
    t.string "transaction_reference"
    t.string "card_type"
    t.string "card_brand"
    t.string "card_currency"
    t.decimal "card_limit"
    t.decimal "amount"
    t.string "pin"
    t.string "status"
    t.jsonb "meta_data"
    t.uuid "user_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "address"
    t.string "city"
    t.string "state"
    t.string "postal"
    t.string "house_no"
    t.string "bvn"
    t.string "account_source"
    t.string "first_name"
    t.string "last_name"
    t.string "id_type"
    t.string "phone"
    t.index ["user_id"], name: "index_cards_on_user_id"
  end

  create_table "circle_activities", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "circle_id", null: false
    t.uuid "created_by_id", null: false
    t.string "name", null: false
    t.integer "target_amount_cents", null: false
    t.datetime "deadline_at", null: false
    t.integer "contribution_frequency", default: 0, null: false
    t.integer "status", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["circle_id", "status"], name: "index_circle_activities_on_circle_id_and_status"
    t.index ["circle_id"], name: "index_circle_activities_on_circle_id"
    t.index ["created_by_id"], name: "index_circle_activities_on_created_by_id"
  end

  create_table "circle_memberships", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "circle_id", null: false
    t.uuid "user_id", null: false
    t.integer "role", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["circle_id", "user_id"], name: "index_circle_memberships_on_circle_id_and_user_id", unique: true
    t.index ["circle_id"], name: "index_circle_memberships_on_circle_id"
    t.index ["user_id"], name: "index_circle_memberships_on_user_id"
  end

  create_table "circle_transaction_reactions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "circle_transaction_id", null: false
    t.uuid "user_id", null: false
    t.string "emoji", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["circle_transaction_id", "user_id", "emoji"], name: "idx_circle_tx_reactions_unique", unique: true
    t.index ["circle_transaction_id"], name: "index_circle_transaction_reactions_on_circle_transaction_id"
    t.index ["user_id"], name: "index_circle_transaction_reactions_on_user_id"
  end

  create_table "circle_transactions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "circle_id", null: false
    t.uuid "user_id", null: false
    t.integer "amount_cents", default: 0, null: false
    t.integer "direction", default: 0, null: false
    t.string "kind", default: "manual", null: false
    t.string "description"
    t.string "reference"
    t.datetime "occurred_at", null: false
    t.jsonb "metadata", default: {}, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.uuid "circle_activity_id"
    t.index ["circle_activity_id"], name: "index_circle_transactions_on_circle_activity_id"
    t.index ["circle_id", "circle_activity_id"], name: "index_circle_transactions_on_circle_id_and_circle_activity_id"
    t.index ["circle_id", "occurred_at"], name: "index_circle_transactions_on_circle_id_and_occurred_at"
    t.index ["circle_id"], name: "index_circle_transactions_on_circle_id"
    t.index ["user_id"], name: "index_circle_transactions_on_user_id"
  end

  create_table "circles", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "name", null: false
    t.string "purpose"
    t.text "description"
    t.uuid "owner_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "balance_cents", default: 0, null: false
    t.string "currency", default: "NGN", null: false
    t.index ["owner_id"], name: "index_circles_on_owner_id"
  end

  create_table "currencies", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.text "currency_rates"
    t.string "rate_time_stamp"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.jsonb "exchange_rates"
  end

  create_table "disputes", force: :cascade do |t|
    t.uuid "circle_transaction_id", null: false
    t.uuid "raised_by_id", null: false
    t.integer "status", default: 0, null: false
    t.string "reason", null: false
    t.text "note"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["circle_transaction_id"], name: "index_disputes_on_circle_transaction_id"
    t.index ["raised_by_id"], name: "index_disputes_on_raised_by_id"
  end

  create_table "electric_bill_orders", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "meter_number"
    t.string "meter_type"
    t.string "meter_address"
    t.string "customer_name"
    t.string "email"
    t.string "request_id"
    t.string "phone"
    t.string "serviceID"
    t.uuid "order_detail_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "status", default: 0
    t.string "transaction_id"
    t.decimal "amount"
    t.string "token"
    t.decimal "total_amount"
    t.index ["order_detail_id"], name: "index_electric_bill_orders_on_order_detail_id"
  end

  create_table "gift_cards", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "provider"
    t.string "provision"
    t.decimal "value"
    t.text "header_info"
    t.text "description"
    t.integer "rating"
    t.text "notice_info"
    t.text "alert_info"
    t.decimal "value_max"
    t.decimal "value_min"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "monify_tokens", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "token"
    t.datetime "expires_in"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "order_details", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.decimal "total_amount"
    t.integer "status", default: 0
    t.integer "payment_method", default: 0
    t.boolean "viewed", default: false
    t.decimal "net_total"
    t.uuid "user_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "order_type", default: 0
    t.text "extra_info"
    t.index ["user_id"], name: "index_order_details_on_user_id"
  end

  create_table "order_items", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.integer "quantity", default: 1
    t.decimal "amount"
    t.uuid "product_id", null: false
    t.uuid "order_detail_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.uuid "provision_id"
    t.index ["order_detail_id"], name: "index_order_items_on_order_detail_id"
    t.index ["product_id"], name: "index_order_items_on_product_id"
    t.index ["provision_id"], name: "index_order_items_on_provision_id"
  end

  create_table "phone_verification_codes", force: :cascade do |t|
    t.uuid "user_id", null: false
    t.string "phone_e164", null: false
    t.string "otp_digest", null: false
    t.datetime "expires_at", null: false
    t.datetime "last_sent_at"
    t.integer "attempts", default: 0, null: false
    t.integer "send_count", default: 0, null: false
    t.string "status", default: "pending", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "provider"
    t.string "provider_message_id"
    t.string "provider_status"
    t.datetime "last_status_at"
    t.string "ip_address"
    t.string "user_agent"
    t.index ["expires_at"], name: "index_phone_verification_codes_on_expires_at"
    t.index ["phone_e164", "created_at"], name: "index_phone_verification_codes_on_phone_e164_and_created_at"
    t.index ["provider_message_id"], name: "index_phone_verification_codes_on_provider_message_id"
    t.index ["status"], name: "index_phone_verification_codes_on_status"
    t.index ["user_id", "created_at"], name: "index_phone_verification_codes_on_user_id_and_created_at"
    t.index ["user_id", "phone_e164"], name: "index_phone_verification_codes_on_user_id_and_phone_e164"
    t.index ["user_id"], name: "index_phone_verification_codes_on_user_id"
  end

  create_table "products", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.boolean "featured", default: false
    t.string "extra_info"
    t.string "provider"
    t.string "image"
    t.string "provision"
    t.decimal "min_value"
    t.decimal "max_value"
    t.text "header_info"
    t.text "description"
    t.integer "rate", default: 5
    t.integer "category", default: 0
    t.integer "currency", default: 0
    t.text "info"
    t.text "attention"
    t.text "notice_info"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "provisions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "name"
    t.string "min_value"
    t.string "max_value"
    t.integer "provision_value_type"
    t.uuid "product_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.decimal "value"
    t.text "description"
    t.integer "currency", default: 0
    t.text "info"
    t.text "notice"
    t.decimal "value_range", default: [], array: true
    t.string "service_type"
    t.index ["product_id"], name: "index_provisions_on_product_id"
  end

  create_table "transaction_pin_reset_codes", force: :cascade do |t|
    t.uuid "user_id", null: false
    t.string "phone_e164", null: false
    t.string "otp_digest", null: false
    t.datetime "expires_at", null: false
    t.string "status", default: "pending", null: false
    t.integer "attempts", default: 0, null: false
    t.integer "send_count", default: 0, null: false
    t.datetime "last_sent_at"
    t.string "ip_address"
    t.string "user_agent"
    t.string "provider", default: "termii"
    t.string "provider_message_id"
    t.string "provider_status"
    t.datetime "last_status_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["expires_at"], name: "index_transaction_pin_reset_codes_on_expires_at"
    t.index ["status"], name: "index_transaction_pin_reset_codes_on_status"
    t.index ["user_id", "phone_e164"], name: "index_transaction_pin_reset_codes_on_user_id_and_phone_e164"
    t.index ["user_id"], name: "index_transaction_pin_reset_codes_on_user_id"
  end

  create_table "transaction_records", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "transaction_id"
    t.string "status"
    t.string "customer_name"
    t.string "email"
    t.string "reference"
    t.string "event_type"
    t.decimal "amount"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "description"
    t.string "phone_number"
    t.uuid "bill_order_id"
    t.uuid "exchange_id"
    t.string "bank_code"
    t.string "bank"
    t.string "account_number"
    t.index ["bill_order_id"], name: "index_transaction_records_on_bill_order_id"
    t.index ["exchange_id"], name: "index_transaction_records_on_exchange_id"
    t.index ["reference"], name: "index_transaction_records_on_reference", unique: true
  end

  create_table "transactions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.integer "status", default: 0
    t.decimal "amount"
    t.string "address"
    t.integer "transaction_type", default: 0
    t.uuid "wallet_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "coin_type", default: 0
    t.string "bank"
    t.decimal "bonus", default: "0.0"
    t.string "account_name"
    t.string "bank_code"
    t.uuid "account_id"
    t.string "unique_transaction_id"
    t.string "transfer_id"
    t.index ["account_id"], name: "index_transactions_on_account_id"
    t.index ["transfer_id"], name: "index_transactions_on_transfer_id", unique: true
    t.index ["wallet_id"], name: "index_transactions_on_wallet_id"
  end

  create_table "user_profiles", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "first_name"
    t.string "last_name"
    t.string "phone_number"
    t.uuid "user_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "address_line1"
    t.string "address_line2"
    t.string "city"
    t.string "state"
    t.string "country"
    t.string "postal_code"
    t.string "proof_of_address_type"
    t.date "date_of_birth"
    t.string "phone_e164"
    t.datetime "phone_verified_at"
    t.string "bvn"
    t.string "bvn_status"
    t.datetime "bvn_verified_at"
    t.string "bvn_rejection_reason"
    t.index ["phone_e164"], name: "index_user_profiles_on_phone_e164"
    t.index ["user_id"], name: "index_user_profiles_on_user_id"
  end

  create_table "users", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "email", default: "", null: false
    t.string "encrypted_password", default: "", null: false
    t.string "reset_password_token"
    t.datetime "reset_password_sent_at"
    t.datetime "remember_created_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "jti", null: false
    t.string "role", default: "client"
    t.boolean "active", default: true
    t.string "confirmation_token"
    t.datetime "confirmed_at"
    t.datetime "confirmation_sent_at"
    t.string "unconfirmed_email"
    t.string "refresh_token"
    t.datetime "refresh_token_expires_at"
    t.string "onboarding_stage"
    t.string "primary_use_case"
    t.string "kyc_level"
    t.string "id_type"
    t.string "id_number"
    t.string "transaction_pin_digest"
    t.datetime "transaction_pin_set_at"
    t.integer "transaction_pin_attempts", default: 0, null: false
    t.datetime "transaction_pin_locked_until"
    t.string "refresh_token_digest"
    t.index ["confirmation_token"], name: "index_users_on_confirmation_token", unique: true
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["jti"], name: "index_users_on_jti", unique: true
    t.index ["refresh_token_digest"], name: "index_users_on_refresh_token_digest", unique: true
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
    t.index ["transaction_pin_locked_until"], name: "index_users_on_transaction_pin_locked_until"
  end

  create_table "vendors", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "bvn"
    t.uuid "user_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_vendors_on_user_id"
  end

  create_table "wallets", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "wallet_type", default: 0
    t.decimal "commission"
    t.string "currency", default: "NGN", null: false
    t.integer "balance_cents", default: 0, null: false
    t.index ["user_id", "currency"], name: "index_wallets_on_user_id_and_currency"
    t.index ["user_id", "wallet_type"], name: "index_wallets_on_user_id_and_wallet_type", unique: true
    t.index ["user_id"], name: "index_wallets_on_user_id"
  end

  add_foreign_key "accounts", "users"
  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "bank_transactions", "accounts"
  add_foreign_key "beneficiaries", "users"
  add_foreign_key "bill_orders", "order_details"
  add_foreign_key "bill_orders", "users", on_delete: :nullify
  add_foreign_key "card_tokens", "order_items"
  add_foreign_key "cards", "users"
  add_foreign_key "circle_activities", "circles"
  add_foreign_key "circle_activities", "users", column: "created_by_id"
  add_foreign_key "circle_memberships", "circles"
  add_foreign_key "circle_memberships", "users"
  add_foreign_key "circle_transaction_reactions", "circle_transactions"
  add_foreign_key "circle_transaction_reactions", "users"
  add_foreign_key "circle_transactions", "circle_activities"
  add_foreign_key "circle_transactions", "circles"
  add_foreign_key "circle_transactions", "users"
  add_foreign_key "circles", "users", column: "owner_id"
  add_foreign_key "disputes", "circle_transactions"
  add_foreign_key "disputes", "users", column: "raised_by_id"
  add_foreign_key "electric_bill_orders", "order_details"
  add_foreign_key "order_details", "users"
  add_foreign_key "order_items", "order_details"
  add_foreign_key "order_items", "products"
  add_foreign_key "order_items", "provisions"
  add_foreign_key "phone_verification_codes", "users"
  add_foreign_key "provisions", "products"
  add_foreign_key "transaction_pin_reset_codes", "users"
  add_foreign_key "transaction_records", "bill_orders"
  add_foreign_key "transaction_records", "transactions", column: "exchange_id"
  add_foreign_key "transactions", "accounts"
  add_foreign_key "transactions", "wallets"
  add_foreign_key "user_profiles", "users", on_delete: :nullify
  add_foreign_key "vendors", "users"
  add_foreign_key "wallets", "users", on_delete: :nullify
end
