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

ActiveRecord::Schema[7.1].define(version: 2026_03_18_170000) do
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
    t.index ["user_id"], name: "idx_unique_active_anchor_account_per_user", unique: true, where: "(((vendor)::text = 'anchor'::text) AND (active = true))"
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

  create_table "admin_audit_events", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "admin_user_id", null: false
    t.uuid "target_user_id"
    t.string "action", null: false
    t.string "ip"
    t.string "user_agent"
    t.jsonb "metadata", default: {}, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["action"], name: "index_admin_audit_events_on_action"
    t.index ["admin_user_id"], name: "index_admin_audit_events_on_admin_user_id"
    t.index ["target_user_id"], name: "index_admin_audit_events_on_target_user_id"
  end

  create_table "anchor_webhook_events", force: :cascade do |t|
    t.string "event_type", null: false
    t.string "reference", null: false
    t.jsonb "payload", default: {}, null: false
    t.string "status", default: "received", null: false
    t.datetime "processed_at"
    t.datetime "received_at"
    t.string "error_message"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["event_type", "reference"], name: "index_anchor_webhook_events_on_event_type_and_reference", unique: true
    t.index ["received_at"], name: "index_anchor_webhook_events_on_received_at"
  end

  create_table "badges", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "key", null: false
    t.string "name", null: false
    t.text "description"
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["key"], name: "index_badges_on_key", unique: true
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
    t.decimal "amount", precision: 18, scale: 2
    t.decimal "total_amount", precision: 18, scale: 2
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
    t.decimal "service_charge", precision: 18, scale: 2, default: "0.0"
    t.string "description"
    t.boolean "use_commission"
    t.text "reason"
    t.string "idempotency_key"
    t.string "provider_reference"
    t.jsonb "provider_response"
    t.decimal "reward_applied", precision: 15, scale: 2, default: "0.0", null: false
    t.decimal "wallet_amount_charged", precision: 15, scale: 2, default: "0.0", null: false
    t.decimal "commission_used", precision: 18, scale: 2, default: "0.0", null: false
    t.bigint "amount_cents"
    t.bigint "total_amount_cents"
    t.bigint "service_charge_cents"
    t.bigint "commission_used_cents"
    t.integer "reconcile_attempts", default: 0, null: false
    t.datetime "reconcile_last_attempt_at"
    t.index ["order_detail_id"], name: "index_bill_orders_on_order_detail_id"
    t.index ["user_id", "idempotency_key"], name: "index_bill_orders_on_user_id_and_idempotency_key", unique: true, where: "(idempotency_key IS NOT NULL)"
    t.index ["user_id"], name: "index_bill_orders_on_user_id"
  end

  create_table "bill_payment_intents", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.uuid "bill_order_id"
    t.string "bill_type", null: false
    t.decimal "amount", precision: 18, scale: 2, null: false
    t.decimal "fee", precision: 18, scale: 2, default: "0.0", null: false
    t.decimal "total", precision: 18, scale: 2, null: false
    t.integer "status", default: 0, null: false
    t.jsonb "metadata", default: {}, null: false
    t.string "provider_reference"
    t.datetime "expires_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["bill_order_id"], name: "index_bill_payment_intents_on_bill_order_id"
    t.index ["provider_reference"], name: "index_bill_payment_intents_on_provider_reference"
    t.index ["user_id", "status"], name: "index_bill_payment_intents_on_user_id_and_status"
    t.index ["user_id"], name: "index_bill_payment_intents_on_user_id"
  end

  create_table "card_events", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "event", null: false
    t.string "status"
    t.string "card_id"
    t.string "cardholder_id"
    t.string "currency"
    t.decimal "amount", precision: 12, scale: 2
    t.string "transaction_reference"
    t.string "card_transaction_type"
    t.string "merchant_category_code"
    t.string "description"
    t.string "decline_reason"
    t.datetime "transaction_at"
    t.boolean "livemode"
    t.jsonb "raw_payload"
    t.uuid "user_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "provider_transaction_reference"
    t.string "provider_card_id"
    t.string "event_name"
    t.string "event_status"
    t.decimal "fee_amount", precision: 12, scale: 2
    t.string "fee_currency"
    t.string "merchant_name"
    t.jsonb "metadata"
    t.decimal "merchant_amount", precision: 18, scale: 6
    t.string "merchant_currency"
    t.decimal "billing_amount", precision: 18, scale: 6
    t.string "billing_currency"
    t.decimal "fx_implied_rate", precision: 18, scale: 6
    t.decimal "fx_reference_rate", precision: 18, scale: 6
    t.decimal "fx_margin_usd", precision: 18, scale: 6
    t.decimal "fx_markup_usd", precision: 18, scale: 6
    t.index ["card_id", "provider_transaction_reference", "event_name"], name: "index_card_events_on_provider_reference", unique: true
    t.index ["card_id"], name: "index_card_events_on_card_id"
    t.index ["event"], name: "index_card_events_on_event"
    t.index ["transaction_at"], name: "index_card_events_on_transaction_at"
    t.index ["transaction_reference"], name: "index_card_events_on_transaction_reference"
    t.index ["user_id"], name: "index_card_events_on_user_id"
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
    t.integer "decline_count", default: 0, null: false
    t.datetime "last_declined_at"
    t.string "frozen_by"
    t.string "frozen_reason"
    t.string "provider_status"
    t.datetime "provider_updated_at"
    t.string "last_provider_sync_error"
    t.boolean "provider_livemode"
    t.datetime "last_synced_at"
    t.datetime "last_maintenance_fee_charged_at"
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
    t.string "username"
    t.index "circle_id, lower((username)::text)", name: "idx_circle_memberships_circle_username_unique", unique: true, where: "(username IS NOT NULL)"
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
    t.string "idempotency_key"
    t.string "request_id"
    t.string "event_type"
    t.uuid "wallet_transaction_id"
    t.index ["circle_activity_id"], name: "index_circle_transactions_on_circle_activity_id"
    t.index ["circle_id", "circle_activity_id"], name: "index_circle_transactions_on_circle_id_and_circle_activity_id"
    t.index ["circle_id", "event_type", "idempotency_key"], name: "idx_circle_tx_circle_event_idempotency", unique: true, where: "(idempotency_key IS NOT NULL)"
    t.index ["circle_id", "occurred_at"], name: "index_circle_transactions_on_circle_id_and_occurred_at"
    t.index ["circle_id"], name: "index_circle_transactions_on_circle_id"
    t.index ["user_id"], name: "index_circle_transactions_on_user_id"
    t.index ["wallet_transaction_id"], name: "index_circle_transactions_on_wallet_transaction_id"
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
    t.string "circle_type", default: "standard", null: false
    t.string "kyc_mode", default: "strict", null: false
    t.bigint "max_contribution_cents"
    t.string "badge_label"
    t.string "visibility", default: "private", null: false
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

  create_table "funding_intents", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.string "provider", default: "anchor", null: false
    t.string "reference", null: false
    t.bigint "expected_amount_cents"
    t.datetime "expires_at", null: false
    t.string "status", default: "pending", null: false
    t.jsonb "metadata", default: {}, null: false
    t.uuid "credited_transaction_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["credited_transaction_id"], name: "index_funding_intents_on_credited_transaction_id"
    t.index ["expires_at"], name: "index_funding_intents_on_expires_at"
    t.index ["reference"], name: "index_funding_intents_on_reference", unique: true
    t.index ["user_id", "status"], name: "index_funding_intents_on_user_id_and_status"
    t.index ["user_id"], name: "index_funding_intents_on_user_id"
  end

  create_table "fx_quotes", force: :cascade do |t|
    t.string "token", null: false
    t.string "direction", null: false
    t.decimal "base_rate", precision: 24, scale: 12, null: false
    t.decimal "markup", precision: 24, scale: 12, null: false
    t.decimal "execution_rate", precision: 24, scale: 12, null: false
    t.decimal "fee_amount", precision: 24, scale: 6, null: false
    t.string "fee_currency", null: false
    t.decimal "amount_in", precision: 24, scale: 6, null: false
    t.decimal "amount_after_fee", precision: 24, scale: 6, null: false
    t.decimal "amount_out", precision: 24, scale: 6, null: false
    t.datetime "expires_at", null: false
    t.uuid "user_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.decimal "base_rate_raw", precision: 24, scale: 12
    t.decimal "markup_raw", precision: 24, scale: 12
    t.decimal "execution_rate_raw", precision: 24, scale: 12
    t.decimal "fee_amount_raw", precision: 24, scale: 12
    t.decimal "amount_in_raw", precision: 24, scale: 12
    t.decimal "amount_after_fee_raw", precision: 24, scale: 12
    t.decimal "amount_out_raw", precision: 24, scale: 12
    t.datetime "executed_at"
    t.string "execution_reference"
    t.index ["expires_at"], name: "index_fx_quotes_on_expires_at"
    t.index ["token"], name: "index_fx_quotes_on_token", unique: true
    t.index ["user_id"], name: "index_fx_quotes_on_user_id"
  end

  create_table "fx_settings", force: :cascade do |t|
    t.decimal "base_usd_ngn_rate", precision: 12, scale: 4, default: "1490.0", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.decimal "provider_usd_ngn_rate", precision: 18, scale: 6
    t.bigint "provider_raw"
    t.string "provider_source", default: "bridgecard", null: false
    t.integer "provider_fx_divisor", default: 100, null: false
    t.datetime "provider_updated_at"
    t.string "provider_base", default: "USD", null: false
    t.jsonb "provider_rates", default: {}
    t.string "provider_as_of"
    t.string "provider_error"
    t.datetime "provider_next_refresh_at"
    t.jsonb "base_fx_rates", default: {}
    t.integer "card_monthly_maintenance_fee_usd_cents", default: 0, null: false
    t.integer "card_funding_fee_bps", default: 0, null: false
    t.integer "card_funding_fee_cap_usd_cents", default: 0, null: false
    t.integer "card_withdrawal_fee_bps", default: 0, null: false
    t.integer "card_withdrawal_fee_cap_usd_cents", default: 0, null: false
    t.integer "card_creation_fee_usd_cents", default: 400, null: false
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

  create_table "inbound_bank_transfers", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "provider", default: "anchor", null: false
    t.string "provider_reference", null: false
    t.bigint "amount_cents", null: false
    t.string "currency", default: "NGN", null: false
    t.string "sender_name"
    t.text "narration"
    t.datetime "received_at"
    t.string "status", default: "unmatched", null: false
    t.uuid "matched_user_id"
    t.uuid "funding_intent_id"
    t.uuid "credited_transaction_id"
    t.jsonb "raw_payload", default: {}, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["credited_transaction_id"], name: "index_inbound_bank_transfers_on_credited_transaction_id"
    t.index ["funding_intent_id"], name: "index_inbound_bank_transfers_on_funding_intent_id"
    t.index ["matched_user_id"], name: "index_inbound_bank_transfers_on_matched_user_id"
    t.index ["provider", "provider_reference"], name: "index_inbound_bank_transfers_on_provider_and_provider_reference", unique: true
    t.index ["status"], name: "index_inbound_bank_transfers_on_status"
  end

  create_table "kyc_attempts", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id"
    t.string "kyc_type", null: false
    t.string "ip_address", null: false
    t.boolean "success", default: false, null: false
    t.string "result_status"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["created_at"], name: "index_kyc_attempts_on_created_at"
    t.index ["ip_address"], name: "index_kyc_attempts_on_ip_address"
    t.index ["user_id"], name: "index_kyc_attempts_on_user_id"
  end

  create_table "kyc_audit_logs", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id"
    t.uuid "admin_id"
    t.string "action", null: false
    t.string "status"
    t.string "ip_address"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["action"], name: "index_kyc_audit_logs_on_action"
    t.index ["admin_id"], name: "index_kyc_audit_logs_on_admin_id"
    t.index ["user_id"], name: "index_kyc_audit_logs_on_user_id"
  end

  create_table "kyc_bvn_retry_events", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.uuid "user_kyc_id", null: false
    t.integer "attempt_number", null: false
    t.string "status", null: false
    t.string "reason"
    t.integer "next_wait_seconds"
    t.string "provider_reference"
    t.datetime "created_at", null: false
    t.index ["user_id"], name: "index_kyc_bvn_retry_events_on_user_id"
    t.index ["user_kyc_id"], name: "index_kyc_bvn_retry_events_on_user_kyc_id"
  end

  create_table "kyc_reviews", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.string "kyc_type", null: false
    t.string "status", default: "pending", null: false
    t.string "reason"
    t.text "notes"
    t.uuid "assigned_to_admin_id"
    t.uuid "decided_by_admin_id"
    t.datetime "decided_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["kyc_type"], name: "index_kyc_reviews_on_kyc_type"
    t.index ["status"], name: "index_kyc_reviews_on_status"
    t.index ["user_id"], name: "index_kyc_reviews_on_user_id"
  end

  create_table "kyc_tier3_events", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id"
    t.uuid "user_kyc_id"
    t.string "provider", default: "prembly", null: false
    t.string "stage", null: false
    t.string "status", null: false
    t.string "provider_code"
    t.string "provider_reference"
    t.string "message"
    t.jsonb "payload", default: {}, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["created_at"], name: "index_kyc_tier3_events_on_created_at"
    t.index ["provider"], name: "index_kyc_tier3_events_on_provider"
    t.index ["stage"], name: "index_kyc_tier3_events_on_stage"
    t.index ["status", "created_at"], name: "index_kyc_tier3_events_on_status_and_created_at"
    t.index ["status"], name: "index_kyc_tier3_events_on_status"
    t.index ["user_id"], name: "index_kyc_tier3_events_on_user_id"
    t.index ["user_kyc_id", "created_at"], name: "index_kyc_tier3_events_on_user_kyc_id_and_created_at"
    t.index ["user_kyc_id"], name: "index_kyc_tier3_events_on_user_kyc_id"
  end

  create_table "monify_tokens", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "token"
    t.datetime "expires_in"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "notification_deliveries", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "notification_event_id", null: false
    t.uuid "notification_device_id", null: false
    t.integer "status", default: 0, null: false
    t.integer "attempts", default: 0, null: false
    t.datetime "delivered_at"
    t.datetime "failed_at"
    t.string "provider_ticket_id"
    t.text "error_message"
    t.jsonb "provider_response", default: {}, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["notification_device_id"], name: "index_notification_deliveries_on_notification_device_id"
    t.index ["notification_event_id", "notification_device_id"], name: "idx_notif_deliveries_event_device", unique: true
    t.index ["notification_event_id"], name: "index_notification_deliveries_on_notification_event_id"
    t.index ["status"], name: "index_notification_deliveries_on_status"
  end

  create_table "notification_devices", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.string "provider", default: "expo", null: false
    t.string "token", null: false
    t.string "platform"
    t.string "app_version"
    t.boolean "active", default: true, null: false
    t.datetime "last_seen_at"
    t.jsonb "metadata", default: {}, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["provider", "token"], name: "index_notification_devices_on_provider_and_token", unique: true
    t.index ["user_id", "active"], name: "index_notification_devices_on_user_id_and_active"
    t.index ["user_id"], name: "index_notification_devices_on_user_id"
  end

  create_table "notification_events", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.string "event_type", null: false
    t.string "resource_type", null: false
    t.string "resource_id", null: false
    t.string "reference"
    t.string "state", null: false
    t.string "title", null: false
    t.text "body", null: false
    t.string "deeplink"
    t.string "priority", default: "normal", null: false
    t.string "idempotency_key", null: false
    t.datetime "occurred_at", null: false
    t.integer "status", default: 0, null: false
    t.integer "attempts", default: 0, null: false
    t.text "error_message"
    t.jsonb "metadata", default: {}, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["idempotency_key"], name: "index_notification_events_on_idempotency_key", unique: true
    t.index ["status"], name: "index_notification_events_on_status"
    t.index ["user_id", "created_at"], name: "index_notification_events_on_user_id_and_created_at"
    t.index ["user_id"], name: "index_notification_events_on_user_id"
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

  create_table "provider_service_statuses", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "provider", null: false
    t.string "service_key", null: false
    t.string "state", null: false
    t.integer "reliability_percent", default: 0, null: false
    t.integer "sample_size", default: 0, null: false
    t.datetime "window_started_at", null: false
    t.datetime "window_ended_at", null: false
    t.integer "avg_latency_ms"
    t.text "last_error"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["provider", "service_key"], name: "index_provider_service_statuses_on_provider_and_service_key", unique: true
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

  create_table "refund_requests", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id"
    t.string "transaction_reference", null: false
    t.string "provider"
    t.string "reason", null: false
    t.integer "status", default: 0, null: false
    t.datetime "requested_at", null: false
    t.datetime "acknowledged_at"
    t.datetime "approved_at"
    t.datetime "rejected_at"
    t.datetime "refunded_at"
    t.uuid "handled_by_admin_id"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["provider"], name: "index_refund_requests_on_provider"
    t.index ["requested_at"], name: "index_refund_requests_on_requested_at"
    t.index ["status"], name: "index_refund_requests_on_status"
    t.index ["transaction_reference"], name: "index_refund_requests_on_transaction_reference"
  end

  create_table "reward_transactions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.uuid "bill_order_id"
    t.decimal "amount", precision: 12, scale: 2, null: false
    t.decimal "source_amount", precision: 12, scale: 2
    t.decimal "reward_rate", precision: 6, scale: 4, default: "0.01", null: false
    t.string "currency", default: "NGN", null: false
    t.string "service_type"
    t.string "source_label"
    t.integer "status", default: 1, null: false
    t.datetime "earned_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["bill_order_id"], name: "index_reward_transactions_on_bill_order_id"
    t.index ["earned_at"], name: "index_reward_transactions_on_earned_at"
    t.index ["user_id", "service_type", "source_label"], name: "index_reward_txns_legacy_bonus_unique", unique: true, where: "((service_type)::text = 'legacy_bonus'::text)"
    t.index ["user_id"], name: "index_reward_transactions_on_user_id"
  end

  create_table "service_status_subscriptions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.string "provider", null: false
    t.string "service_key", null: false
    t.string "channel", default: "push", null: false
    t.boolean "active", default: true, null: false
    t.string "last_notified_state"
    t.datetime "last_notified_at"
    t.datetime "expires_at"
    t.jsonb "metadata", default: {}, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["provider", "service_key", "active"], name: "idx_service_status_subscriptions_lookup"
    t.index ["user_id", "provider", "service_key", "channel"], name: "idx_service_status_subscriptions_uniqueness", unique: true
    t.index ["user_id"], name: "index_service_status_subscriptions_on_user_id"
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
    t.string "response_code"
    t.string "response_message"
    t.string "provider_error_category"
    t.index ["bill_order_id"], name: "idx_tr_unique_bill_payment_per_bill_order", unique: true, where: "((bill_order_id IS NOT NULL) AND ((event_type)::text = 'bill_payment'::text))"
    t.index ["bill_order_id"], name: "index_transaction_records_on_bill_order_id"
    t.index ["exchange_id"], name: "index_transaction_records_on_exchange_id"
    t.index ["reference"], name: "index_transaction_records_on_reference", unique: true
  end

  create_table "transactions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.integer "status", default: 0
    t.decimal "amount", precision: 18, scale: 2
    t.string "address"
    t.integer "transaction_type", default: 0
    t.uuid "wallet_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "coin_type", default: 0
    t.string "bank"
    t.decimal "bonus", precision: 18, scale: 2, default: "0.0"
    t.string "account_name"
    t.string "bank_code"
    t.uuid "account_id"
    t.string "unique_transaction_id"
    t.string "transfer_id"
    t.string "bridge_card_id"
    t.jsonb "metadata", default: {}, null: false
    t.bigint "amount_cents"
    t.bigint "bonus_cents"
    t.decimal "before_book_balance", precision: 18, scale: 2
    t.decimal "after_book_balance", precision: 18, scale: 2
    t.decimal "before_available_balance", precision: 18, scale: 2
    t.decimal "after_available_balance", precision: 18, scale: 2
    t.index ["account_id"], name: "index_transactions_on_account_id"
    t.index ["bridge_card_id"], name: "index_transactions_on_bridge_card_id"
    t.index ["transfer_id"], name: "index_transactions_on_transfer_id", unique: true
    t.index ["wallet_id", "unique_transaction_id"], name: "idx_unique_anchor_transfer_component_per_wallet", unique: true, where: "((unique_transaction_id IS NOT NULL) AND ((metadata ->> 'provider'::text) = 'anchor'::text))"
    t.index ["wallet_id"], name: "index_transactions_on_wallet_id"
  end

  create_table "unmatched_credits", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "provider", null: false
    t.string "reference"
    t.string "provider_reference", null: false
    t.string "account_number"
    t.string "account_name"
    t.string "bank_code"
    t.string "bank_name"
    t.decimal "amount", precision: 18, scale: 2
    t.string "currency", default: "NGN", null: false
    t.string "reason", null: false
    t.string "status", default: "pending", null: false
    t.jsonb "payload", default: {}, null: false
    t.datetime "resolved_at"
    t.uuid "user_id"
    t.uuid "wallet_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.datetime "reviewed_at"
    t.uuid "reviewed_by_user_id"
    t.datetime "applied_at"
    t.uuid "applied_by_user_id"
    t.text "review_note"
    t.text "apply_note"
    t.string "last_request_id"
    t.index ["applied_by_user_id"], name: "index_unmatched_credits_on_applied_by_user_id"
    t.index ["created_at"], name: "index_unmatched_credits_on_created_at"
    t.index ["provider", "provider_reference"], name: "index_unmatched_credits_on_provider_and_provider_reference", unique: true
    t.index ["reviewed_by_user_id"], name: "index_unmatched_credits_on_reviewed_by_user_id"
    t.index ["status"], name: "index_unmatched_credits_on_status"
  end

  create_table "user_badges", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.uuid "badge_id", null: false
    t.uuid "granted_by_user_id"
    t.uuid "source_circle_id"
    t.string "source_rule"
    t.datetime "granted_at", null: false
    t.jsonb "metadata", default: {}, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["badge_id"], name: "index_user_badges_on_badge_id"
    t.index ["granted_at"], name: "index_user_badges_on_granted_at"
    t.index ["user_id", "badge_id", "source_circle_id"], name: "index_user_badges_unique_source", unique: true
    t.index ["user_id"], name: "index_user_badges_on_user_id"
  end

  create_table "user_kycs", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.string "bvn_status", default: "unverified", null: false
    t.string "bvn_last4"
    t.string "bvn_provider", default: "prembly", null: false
    t.string "bvn_provider_reference"
    t.datetime "bvn_verified_at"
    t.boolean "bvn_name_match"
    t.boolean "bvn_dob_match"
    t.boolean "bvn_first_name_match"
    t.boolean "bvn_last_name_match"
    t.decimal "bvn_match_score", precision: 4, scale: 3
    t.boolean "watchlisted"
    t.integer "bvn_attempts_count", default: 0, null: false
    t.integer "bvn_failed_attempts_count", default: 0, null: false
    t.datetime "bvn_locked_until"
    t.datetime "bvn_last_attempt_at"
    t.string "bvn_fingerprint"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "tier3_status", default: "not_started", null: false
    t.string "tier3_reference"
    t.datetime "tier3_verified_at"
    t.string "tier3_error"
    t.string "bvn_encrypted"
    t.string "bvn_last_result_status"
    t.string "bvn_last_result_reason"
    t.datetime "bvn_last_checked_at"
    t.string "bvn_last_profile_fingerprint"
    t.string "bvn_snapshot_first_name"
    t.string "bvn_snapshot_last_name"
    t.string "bvn_snapshot_dob"
    t.boolean "bvn_snapshot_watchlisted", default: false, null: false
    t.string "bvn_snapshot_reference"
    t.datetime "bvn_snapshot_captured_at"
    t.datetime "bvn_snapshot_expires_at"
    t.integer "bvn_retry_attempt", default: 0, null: false
    t.datetime "bvn_retry_next_at"
    t.datetime "bvn_retry_locked_at"
    t.string "nin_status", default: "unverified", null: false
    t.string "nin_last4"
    t.string "nin_provider", default: "prembly", null: false
    t.string "nin_provider_reference"
    t.datetime "nin_verified_at"
    t.string "nin_last_result_status"
    t.string "nin_last_result_reason"
    t.datetime "nin_last_checked_at"
    t.string "nin_encrypted"
    t.boolean "nin_name_match"
    t.boolean "nin_dob_match"
    t.boolean "nin_first_name_match"
    t.boolean "nin_last_name_match"
    t.decimal "nin_match_score", precision: 4, scale: 3
    t.index ["bvn_encrypted"], name: "index_user_kycs_on_bvn_encrypted"
    t.index ["bvn_fingerprint"], name: "index_user_kycs_on_bvn_fingerprint"
    t.index ["bvn_retry_locked_at"], name: "index_user_kycs_on_bvn_retry_locked_at"
    t.index ["bvn_snapshot_expires_at"], name: "index_user_kycs_on_bvn_snapshot_expires_at"
    t.index ["bvn_status"], name: "index_user_kycs_on_bvn_status"
    t.index ["nin_encrypted"], name: "index_user_kycs_on_nin_encrypted"
    t.index ["nin_status"], name: "index_user_kycs_on_nin_status"
    t.index ["user_id"], name: "index_user_kycs_on_user_id", unique: true
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
    t.string "gender"
    t.index ["phone_e164"], name: "index_user_profiles_on_phone_e164_unique", unique: true, where: "((phone_e164 IS NOT NULL) AND ((phone_e164)::text <> ''::text))"
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
    t.string "admin_role"
    t.datetime "admin_auth_time"
    t.boolean "transaction_pin_app_lock_enabled", default: false, null: false
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

  create_table "wallet_ledger_entries", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "wallet_id", null: false
    t.uuid "bill_order_id"
    t.integer "entry_type", null: false
    t.decimal "amount", precision: 18, scale: 2, null: false
    t.string "reference"
    t.jsonb "metadata", default: {}, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "amount_cents"
    t.decimal "before_book_balance", precision: 18, scale: 2
    t.decimal "after_book_balance", precision: 18, scale: 2
    t.decimal "before_available_balance", precision: 18, scale: 2
    t.decimal "after_available_balance", precision: 18, scale: 2
    t.index ["bill_order_id", "entry_type"], name: "index_wallet_ledger_entries_on_bill_order_id_and_entry_type", unique: true, where: "(bill_order_id IS NOT NULL)"
    t.index ["wallet_id", "bill_order_id", "entry_type"], name: "idx_unique_wallet_ledger_logical_entry", unique: true
    t.index ["wallet_id", "bill_order_id", "entry_type"], name: "idx_wallet_ledger_unique_bill_order_entry_partial", unique: true, where: "(bill_order_id IS NOT NULL)"
    t.index ["wallet_id", "entry_type", "reference"], name: "idx_wallet_ledger_unique_reference_entry", unique: true, where: "(reference IS NOT NULL)"
    t.index ["wallet_id", "entry_type"], name: "index_wallet_ledger_entries_on_wallet_id_and_entry_type"
  end

  create_table "wallets", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "wallet_type", default: 0
    t.decimal "commission", precision: 18, scale: 2
    t.string "currency", default: "NGN", null: false
    t.integer "balance_cents", default: 0, null: false
    t.bigint "commission_cents"
    t.index ["user_id", "currency"], name: "index_wallets_on_user_id_and_currency"
    t.index ["user_id", "wallet_type"], name: "index_wallets_on_user_id_and_wallet_type", unique: true
    t.index ["user_id"], name: "index_wallets_on_user_id"
  end

  create_table "webhook_events", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "source", null: false
    t.jsonb "headers"
    t.jsonb "payload"
    t.datetime "processed_at"
    t.string "processing_error"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "event_type"
    t.jsonb "payload_json"
    t.string "provider"
    t.string "reference"
    t.string "provider_event_id"
    t.datetime "received_at"
    t.boolean "signature_valid", default: false, null: false
    t.string "processing_status", default: "received", null: false
    t.index ["created_at"], name: "index_webhook_events_on_created_at"
    t.index ["processing_status"], name: "index_webhook_events_on_processing_status"
    t.index ["provider", "event_type", "reference"], name: "idx_webhook_events_provider_event_ref_unique", unique: true, where: "((reference IS NOT NULL) AND ((reference)::text <> ''::text))"
    t.index ["provider", "provider_event_id"], name: "idx_webhook_events_provider_event_id_unique", unique: true, where: "((provider_event_id IS NOT NULL) AND ((provider_event_id)::text <> ''::text))"
    t.index ["received_at"], name: "index_webhook_events_on_received_at"
    t.index ["source"], name: "index_webhook_events_on_source"
  end

  add_foreign_key "accounts", "users"
  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "admin_audit_events", "users", column: "admin_user_id"
  add_foreign_key "admin_audit_events", "users", column: "target_user_id"
  add_foreign_key "bank_transactions", "accounts"
  add_foreign_key "beneficiaries", "users"
  add_foreign_key "bill_orders", "order_details"
  add_foreign_key "bill_orders", "users", on_delete: :nullify
  add_foreign_key "bill_payment_intents", "bill_orders"
  add_foreign_key "bill_payment_intents", "users"
  add_foreign_key "card_events", "users"
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
  add_foreign_key "circle_transactions", "transactions", column: "wallet_transaction_id"
  add_foreign_key "circle_transactions", "users"
  add_foreign_key "circles", "users", column: "owner_id"
  add_foreign_key "disputes", "circle_transactions"
  add_foreign_key "disputes", "users", column: "raised_by_id"
  add_foreign_key "electric_bill_orders", "order_details"
  add_foreign_key "funding_intents", "transactions", column: "credited_transaction_id"
  add_foreign_key "funding_intents", "users"
  add_foreign_key "fx_quotes", "users"
  add_foreign_key "inbound_bank_transfers", "funding_intents"
  add_foreign_key "inbound_bank_transfers", "transactions", column: "credited_transaction_id"
  add_foreign_key "inbound_bank_transfers", "users", column: "matched_user_id"
  add_foreign_key "kyc_tier3_events", "user_kycs"
  add_foreign_key "kyc_tier3_events", "users"
  add_foreign_key "notification_deliveries", "notification_devices"
  add_foreign_key "notification_deliveries", "notification_events"
  add_foreign_key "notification_devices", "users"
  add_foreign_key "notification_events", "users"
  add_foreign_key "order_details", "users"
  add_foreign_key "order_items", "order_details"
  add_foreign_key "order_items", "products"
  add_foreign_key "order_items", "provisions"
  add_foreign_key "phone_verification_codes", "users"
  add_foreign_key "provisions", "products"
  add_foreign_key "refund_requests", "users"
  add_foreign_key "refund_requests", "users", column: "handled_by_admin_id"
  add_foreign_key "reward_transactions", "bill_orders"
  add_foreign_key "reward_transactions", "users"
  add_foreign_key "service_status_subscriptions", "users"
  add_foreign_key "transaction_pin_reset_codes", "users"
  add_foreign_key "transaction_records", "bill_orders"
  add_foreign_key "transaction_records", "transactions", column: "exchange_id"
  add_foreign_key "transactions", "accounts"
  add_foreign_key "transactions", "wallets"
  add_foreign_key "user_badges", "badges"
  add_foreign_key "user_badges", "circles", column: "source_circle_id"
  add_foreign_key "user_badges", "users"
  add_foreign_key "user_badges", "users", column: "granted_by_user_id"
  add_foreign_key "user_profiles", "users", on_delete: :nullify
  add_foreign_key "vendors", "users"
  add_foreign_key "wallet_ledger_entries", "bill_orders"
  add_foreign_key "wallet_ledger_entries", "wallets"
  add_foreign_key "wallets", "users", on_delete: :nullify
end
