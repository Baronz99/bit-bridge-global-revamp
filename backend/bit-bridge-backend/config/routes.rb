# frozen_string_literal: true

require "sidekiq/web"

Rails.application.routes.draw do
  # --- non-API (legacy / admin / misc) ---
  resources :cards
  resources :bank_transactions
  resources :commissions
  resources :bill_orders

  mount Sidekiq::Web => "/sidekiq"

  get "users/index"
  get "users/update"
  get "users/delete"
  get "health", to: "health#index"

  devise_for :users,
             path: "",
             path_names: {
               sign_in: "login",
               sign_out: "logout",
               registration: "signup"
             },
             controllers: {
               sessions: "users/sessions",
               confirmations: "users/confirmations",
               registrations: "users/registrations"
             }

  devise_scope :user do
    get  "confirmation", to: "users/confirmations#show"
    get  "api/v1/confirmation", to: "users/confirmations#show", defaults: { format: :json }
    post "refresh",      to: "users/sessions#refresh"
    post "api/v1/signup", to: "users/registrations#create", defaults: { format: :json }
  end

  get "tokens", to: "api/v1/tokens#token"

  get "up" => "rails/health#show", as: :rails_health_check

  # --- API v1 ---
  namespace :api do
    namespace :v1 do
      # Webhooks
      post "monnify/webhook",    to: "webhooks#monnify"
      post "anchor/webhook",     to: "webhooks#anchor"
      post "bridgecard/webhook", to: "webhooks#bridgecard"
      post "webhooks/buypower",  to: "webhooks/buypower#create"

      # Auth
      post   "/login",        to: "sessions#create"
      post   "refresh",       to: "users/sessions#refresh"
      delete "logout",        to: "users/sessions#destroy"
      post   "auth/verify_password", to: "auth#verify_password"

      # Timeline
      get "timeline",     to: "timeline#index"
      get "timeline/:id", to: "timeline#show"

      # Service availability (unknown-first signal)
      get "service_availability", to: "service_availability#index"
      get "service_catalog", to: "service_catalog#index"

      scope :funding do
        get "anchor_pooled_account", to: "funding#anchor_pooled_account"
        resources :intents, only: %i[create show], controller: "funding"
      end
      # ✅ Termii delivery receipts (DLR)
      post "termii/dlr", to: "termii_webhooks#dlr"

      # Onboarding + KYC
      patch "onboarding/profile",  to: "onboarding#update_profile"
      patch "onboarding/use_case", to: "onboarding#update_use_case"
      post  "onboarding/kyc",      to: "onboarding#submit_kyc"

      # ✅ Phone verification (Termii OTP)
      post "phone_verification/request", to: "phone_verifications#request_code"
      post "phone_verification/verify",  to: "phone_verifications#verify_code"
      get  "phone_verification/status",  to: "phone_verifications#status"

      # ✅ BVN verification (Prembly)
      namespace :kyc do
        post "bvn/verify", to: "bvn#verify"
        get  "bvn/status", to: "bvn#status"
        post "nin/verify", to: "nin#verify"
        get  "nin/status", to: "nin#status"
      end

      # ✅ Transaction PIN (single canonical routing)
      resource :transaction_pin, only: [] do
        get   :status         # GET   /api/v1/transaction_pin/status
        post  :set            # POST  /api/v1/transaction_pin/set
        post  :verify         # POST  /api/v1/transaction_pin/verify
        patch :change         # PATCH /api/v1/transaction_pin/change

        post "reset/request", to: "transaction_pins#reset_request"
        post "reset/confirm", to: "transaction_pins#reset_confirm"
        post "app_lock/enable", to: "transaction_pins#enable_app_lock"
        post "app_lock/disable", to: "transaction_pins#disable_app_lock"
      end

      namespace :notifications do
        resources :devices, only: [:create]
        delete "devices", to: "devices#destroy"
        delete "devices/:token", to: "devices#destroy"
      end

      # Cards
      resources :cards do
        collection do
          post :setup_cardholder
          post :setup_card
          get  :setup_status
          post :fund_wallet
          post :unload_wallet
          post :register_cardholder
          get  :get_all_states
          get  :user_card
          post :create_card
        end

        member do
          get :details
          get :balance
          get :funding_status
          get :history
          get :insights
          patch :freeze
          patch :unfreeze
        end
      end

      resources :rewards, only: [:index]

      namespace :pci do
        resources :cards, only: [] do
          post :reveal, to: "cards_reveal#create", on: :member
        end
      end

      # ✅ Tier 3 Biometric Verification
      namespace :verification do
        namespace :tier3 do
          post :start     # POST /api/v1/verification/tier3/start
          post :liveness  # POST /api/v1/verification/tier3/liveness
          get  :status    # GET  /api/v1/verification/tier3/status
        end
      end

      # Accounts
      resources :accounts do
        collection do
          post :verify_kyc
          post :setup_anchor_onboarding
          get  :get_account_number
          post :provision_account_number
          get  :anchor_onboarding_state
          get  :account_summary
          get  :user_accounts
          get  :get_user_account_detail
          get  :get_account_details
          get  :get_banks
          get  :beneficiaries
          post :resolve

          get  :verify_transfer
          post :initiate_fund_transfer
          post :create_counter_party
          get  :transfer_quote
        end

        member do
          get :verify_transfer
        end
      end

      resources :transaction_records

      resource :currencies do
        collection { get :get_currency }
      end

      resources :payment_processors do
        collection do
          post :payment_order
          post :verify_meter
          post :verify_tv_account
          post :process_payment
          get  :get_balance
          get  :get_price_list
        end

        member do
          get :approve_data
          get :update_status
          get :get_ref_order
          get :confirm_payment
          get :query_transaction
          get :repurchase
        end
      end

      resources :card_tokens do
        collection { get :user }
      end

      resources :products
      resources :provisions
      resources :gift_cards

      resources :transactions do
        collection do
          post :initialize_transaction
          post :create_user
          get  :user
          get  :verify
        end

        member do
          get :receipt
        end
      end

      # ✅ Unified receipts endpoint
      resources :receipts, only: [:show]

      resources :fees, only: [:index]

      resources :wallets, controller: "bridge/wallets" do
        collection do
          get :user, to: "bridge/wallets#user"
          post "tunnel/activate",     to: "tunnel/wallet#activate_tunnel"
          post "tunnel/convert",      to: "tunnel/fx_conversions#convert_ngn_to_usd"
          post "tunnel/quote",        to: "tunnel/fx_quotes#quote_ngn_to_usd"
          post "tunnel/convert-back", to: "tunnel/fx_conversions#convert_usd_to_ngn"
          post "tunnel/quote-back",   to: "tunnel/fx_quotes#quote_usd_to_ngn"
          post "send_money",          to: "bridge/wallet_transfers#send_money"
        end
      end

      resources :order_items

      resources :order_details do
        collection { get :user }
      end

      resources :bill_orders do
        collection do
          get :user
          get :user_recent
        end

        member do
          get   :initialize_confirm_payment
          patch :initialize_confirm_payment
          patch :confirm_bill_payment
        end
      end

      resources :bill_payment_intents, only: %i[create show] do
        member do
          post :execute
        end
      end

      resources :paystack_transactions do
        collection do
          post :initialize_payment
          get  :verify_payment
          get  :list_payments
        end

        member do
          get :fetch_payment
        end
      end

      resources :user_profiles do
        collection { get :user }
      end

      resources :users do
        collection do
          get   :user_profile, to: "core/users#user_profile"
          patch :user_update, to: "core/users#user_update"
          patch :update_password, to: "core/user_security#update_password"
          patch :user_password_update, to: "core/user_security#user_password_update"
          post  :password_reset, to: "core/user_security#password_reset"
          get   :password_reset, to: "core/user_security#password_reset"
          patch :activate_user
          get   :resend_confirmation_token
          patch :onboarding_stage, to: "core/onboarding_progress#onboarding_stage"
          patch :basic_profile, to: "core/users#basic_profile"
          patch :use_case, to: "core/onboarding_progress#use_case"
          patch :update_kyc_level, to: "core/kyc_profile#update_kyc_level"
        end

        member do
          patch :clear_pin_lockout
        end
      end

      # ✅ Shared Circles + mini-wallet + activities + audit/export
      resources :circles, only: %i[index show create] do
        member do
          post :fund
          post :withdraw
          get  :timeline,       to: "circles/timeline#index"
          get  :audit,          to: "circle_audits#show", constraints: ->(req) { req.format == :json }
          get  :audit,          to: "circle_audits#csv",  constraints: ->(req) { req.format == :csv }
          get  :audit_summary
          get  :export_csv
        end

        resources :activities,
                  controller: "circle_activities",
                  only: %i[index show create]

        resources :memberships,
                  controller: "circle_memberships",
                  only: [:create] do
          collection do
            patch :me, to: "circle_memberships#update_me"
          end
        end
      end

      # ✅ Reactions for circle transactions
      resources :circle_transactions, only: [] do
        member do
          post   :react,   to: "circle_transaction_reactions#react"
          delete :unreact, to: "circle_transaction_reactions#unreact"
        end
      end

      resources :disputes, only: [:create]

      # Bridge/Tunnel/Core alias groups
      scope :bridge, as: :bridge do
        get "catalog", to: "service_catalog#index", defaults: { section: "bridge" }, as: :catalog
        get "timeline",     to: "timeline#index", as: :timeline
        get "timeline/:id", to: "timeline#show",  as: :timeline_item

        scope :utilities, as: :utilities do
          post "verify/meter",      to: "payment_processors#verify_meter",      as: :verify_meter
          post "verify/tv",         to: "payment_processors#verify_tv_account", as: :verify_tv_account
          post "process_payment",   to: "payment_processors#process_payment",   as: :process_payment
          get  "balance",           to: "payment_processors#get_balance",       as: :balance
          get  "catalog",           to: "payment_processors#get_price_list",    as: :catalog
          get  "orders/history",    to: "bill_orders#user",                     as: :orders_history
          get  "orders/recent",     to: "bill_orders#user_recent",              as: :orders_recent
          post "intents",           to: "bill_payment_intents#create",          as: :intents
          get  "intents/:id",       to: "bill_payment_intents#show",            as: :intent
          post "intents/:id/execute", to: "bill_payment_intents#execute",       as: :execute_intent
        end

        resources :circles, only: %i[index show create], controller: "circles", as: :circles do
          member do
            post :fund,        to: "circles#fund"
            post :withdraw,    to: "circles#withdraw"
            get  :timeline,    to: "circles/timeline#index"
            get  :audit,       to: "circle_audits#show", constraints: ->(req) { req.format == :json }
            get  :audit,       to: "circle_audits#csv",  constraints: ->(req) { req.format == :csv }
            get  :audit_summary, to: "circles#audit_summary"
            get  :export_csv,  to: "circles#export_csv"
          end

          resources :activities,
                    controller: "circle_activities",
                    only: %i[index show create],
                    as: :activities

          resources :memberships,
                    controller: "circle_memberships",
                    only: [:create],
                    as: :memberships do
            collection do
              patch :me, to: "circle_memberships#update_me"
            end
          end
        end

        resources :circle_transactions, only: [], controller: "circle_transactions", as: :circle_transactions do
          member do
            post   :react,   to: "circle_transaction_reactions#react"
            delete :unreact, to: "circle_transaction_reactions#unreact"
          end
        end

        resources :rewards, only: [:index], controller: "rewards", as: :rewards
        resources :disputes, only: [:create], controller: "disputes", as: :disputes
      end

      scope :tunnel, as: :tunnel do
        get "catalog", to: "service_catalog#index", defaults: { section: "tunnel" }, as: :catalog
        scope :funding, as: :funding do
          get  "pooled_account", to: "funding#anchor_pooled_account", as: :pooled_account
          post "intents",        to: "funding#create",                as: :intents
          get  "intents/:id",    to: "funding#show",                  as: :intent
        end

        post "cardholders/setup",          to: "cards#setup_cardholder",    as: :setup_cardholder
        get  "cardholders/setup_status",   to: "cards#setup_status",        as: :cardholder_setup_status
        post "cardholders/register",       to: "cards#register_cardholder", as: :register_cardholder

        get   "cards",                    to: "cards#index",          as: :cards
        get   "cards/current",            to: "cards#user_card",      as: :current_card
        post  "cards/setup",              to: "cards#setup_card",     as: :setup_card
        post  "cards",                    to: "cards#create_card",    as: :create_card
        post  "cards/fund_wallet",        to: "cards#fund_wallet",    as: :fund_wallet
        post  "cards/unload_wallet",      to: "cards#unload_wallet",  as: :unload_wallet
        get   "cards/:id",                to: "cards#show",           as: :card
        get   "cards/:id/details",        to: "cards#details",        as: :card_details
        get   "cards/:id/balance",        to: "cards#balance",        as: :card_balance
        get   "cards/:id/funding_status", to: "cards#funding_status", as: :card_funding_status
        get   "cards/:id/history",        to: "cards#history",        as: :card_history
        get   "cards/:id/insights",       to: "cards#insights",       as: :card_insights
        patch "cards/:id/freeze",         to: "cards#freeze",         as: :freeze_card
        patch "cards/:id/unfreeze",       to: "cards#unfreeze",       as: :unfreeze_card

        scope :pci, as: :pci do
          post "cards/:id/reveal", to: "pci/cards_reveal#create", as: :card_reveal
        end

        scope :onboarding, as: :onboarding do
          post "rail_customer/verify_kyc", to: "accounts#verify_kyc",              as: :verify_kyc
          post "rail_customer/setup",      to: "accounts#setup_anchor_onboarding",  as: :setup
          get  "rail_customer/state",      to: "accounts#anchor_onboarding_state",  as: :state
        end

        scope :virtual_accounts, as: :virtual_accounts do
          get  "account_number", to: "accounts#get_account_number",      as: :account_number
          post "provision",      to: "accounts#provision_account_number", as: :provision
        end

        scope :transfers, as: :transfers do
          get  "banks",            to: "accounts#get_banks",             as: :banks
          get  "beneficiaries",    to: "accounts#beneficiaries",         as: :beneficiaries
          post "resolve_account",  to: "accounts#resolve",               as: :resolve_account
          get  "verify",           to: "accounts#verify_transfer",       as: :verify
          post "",                 to: "accounts#initiate_fund_transfer", as: :create
          post "counter_parties",  to: "accounts#create_counter_party",  as: :counter_parties
          get  "quote",            to: "accounts#transfer_quote",        as: :quote
          get  ":id/verify",       to: "accounts#verify_transfer",       as: :member_verify
        end

        scope :wallet, as: :wallet do
          post "activate", to: "tunnel/wallet#activate_tunnel", as: :activate
        end

        scope :fx, as: :fx do
          post "quote/ngn-usd",   to: "tunnel/fx_quotes#quote_ngn_to_usd",      as: :quote_ngn_usd
          post "convert/ngn-usd", to: "tunnel/fx_conversions#convert_ngn_to_usd", as: :convert_ngn_usd
          post "quote/usd-ngn",   to: "tunnel/fx_quotes#quote_usd_to_ngn",      as: :quote_usd_ngn
          post "convert/usd-ngn", to: "tunnel/fx_conversions#convert_usd_to_ngn", as: :convert_usd_ngn
        end

        scope :payments, as: :payments do
          scope :paystack, as: :paystack do
            post "initialize", to: "paystack_transactions#initialize_payment", as: :initialize
            get  "verify",     to: "paystack_transactions#verify_payment",     as: :verify
            get  "",           to: "paystack_transactions#list_payments",      as: :list
            get  ":id",        to: "paystack_transactions#fetch_payment",      as: :fetch
          end
        end
      end

      scope :core, as: :core do
        get "catalog", to: "service_catalog#index", defaults: { section: "core" }, as: :catalog
        scope :auth, as: :auth do
          post   "login",           to: "sessions#create",         as: :login
          post   "refresh",         to: "users/sessions#refresh", as: :refresh
          delete "logout",          to: "users/sessions#destroy", as: :logout
          post   "verify_password", to: "auth#verify_password",   as: :verify_password
        end

        scope :onboarding, as: :onboarding do
          patch "profile",  to: "onboarding#update_profile", as: :profile
          patch "use_case", to: "onboarding#update_use_case", as: :use_case
          post  "kyc",      to: "onboarding#submit_kyc",     as: :kyc
        end

        scope :phone_verification, as: :phone_verification do
          post "request", to: "phone_verifications#request_code", as: :request
          post "verify",  to: "phone_verifications#verify_code",  as: :verify
          get  "status",  to: "phone_verifications#status",       as: :status
        end

        namespace :kyc, as: :kyc do
          post "bvn/verify",    to: "bvn#verify",           as: :bvn_verify
          get  "bvn/status",    to: "bvn#status",           as: :bvn_status
          post "nin/verify",    to: "nin#verify",           as: :nin_verify
          get  "nin/status",    to: "nin#status",           as: :nin_status
          post "tier3/start",   to: "verification/tier3#start",    as: :tier3_start
          post "tier3/liveness", to: "verification/tier3#liveness", as: :tier3_liveness
          get  "tier3/status",  to: "verification/tier3#status",   as: :tier3_status
        end

        resource :transaction_pin, only: [], controller: "transaction_pins", as: :transaction_pin do
          get   :status
          post  :set
          post  :verify
          patch :change
        end
        post "transaction_pin/reset/request",   to: "transaction_pins#reset_request",   as: :transaction_pin_reset_request
        post "transaction_pin/reset/confirm",   to: "transaction_pins#reset_confirm",   as: :transaction_pin_reset_confirm
        post "transaction_pin/app_lock/enable", to: "transaction_pins#enable_app_lock", as: :transaction_pin_app_lock_enable
        post "transaction_pin/app_lock/disable", to: "transaction_pins#disable_app_lock", as: :transaction_pin_app_lock_disable

        scope :notifications, as: :notifications do
          post   "devices",        to: "notifications/devices#create",  as: :devices
          delete "devices",        to: "notifications/devices#destroy", as: :destroy_devices
          delete "devices/:token", to: "notifications/devices#destroy", as: :destroy_device
        end

        get "service_availability", to: "service_availability#index", as: :service_availability
        get "receipts/:id",         to: "receipts#show",              as: :receipt

        scope :webhooks, as: :webhooks do
          post "monnify",   to: "webhooks#monnify",       as: :monnify
          post "anchor",    to: "webhooks#anchor",        as: :anchor
          post "bridgecard", to: "webhooks#bridgecard",   as: :bridgecard
          post "buypower",  to: "webhooks/buypower#create", as: :buypower
          post "termii/dlr", to: "termii_webhooks#dlr",   as: :termii_dlr
        end
      end

      # Admin
      namespace :admin do
        resources :statistics, only: [:index]
        resources :kyc_reviews, only: %i[index update]
        get "pricing-spec", to: "pricing_spec#show"
        get "ops/health",   to: "ops#health"
        get "ops/health/users/:user_id", to: "ops#user_kyc_reuse"
        get "ops/summary",  to: "ops#summary"
        resources :transaction_records, only: [:index]
        resources :refund_requests, only: %i[index create update]
        resources :unmatched_credits, only: %i[index update] do
          member do
            post :apply
          end
        end

        resource :fx_settings, path: "fx-settings", only: %i[show update] do
          post :refresh_provider
          post :apply_provider
        end

        post "fx-settings/refresh-provider", to: "fx_settings#refresh_provider"
        post "fx-settings/apply-provider",   to: "fx_settings#apply_provider"
        post "fx-settings/provider/refresh", to: "fx_settings#refresh_exchange_rate"
        post "fx-settings/provider/apply",   to: "fx_settings#apply_exchange_rate"

        resources :cards, only: [] do
          post :mock_debit,               on: :member
          post :refresh_status,           on: :member
          post :sync_transactions,        on: :member
          post :enrich_transaction,       on: :member
          get  :provider_details,         on: :member
          post :refresh_provider_status,  on: :member
          get  :provider_transactions,    on: :member
          get  :provider_transaction,     on: :member
          get  :provider_transaction_status, on: :member
          get  :events,                   on: :member
        end

        # (kept your explicit routes exactly as-is)
        get  "cards/:id/provider-details",         to: "cards#provider_details"
        post "cards/:id/refresh-provider-status",  to: "cards#refresh_provider_status"
        post "cards/:id/sync-transactions",        to: "cards#sync_transactions"
        post "cards/:id/enrich-transaction",       to: "cards#enrich_transaction"
        get  "cards/:id/provider-transactions",    to: "cards#provider_transactions"
        get  "cards/:id/provider-transaction",     to: "cards#provider_transaction"
        get  "cards/:id/provider-transaction-status", to: "cards#provider_transaction_status"

        resources :users, only: [:index] do
          post :reveal, on: :member
        end
      end
    end
  end
end

