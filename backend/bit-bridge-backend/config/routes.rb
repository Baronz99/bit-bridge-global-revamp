# frozen_string_literal: true

require "sidekiq/web"


Rails.application.routes.draw do
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
    post "refresh",      to: "users/sessions#refresh"
  end

  get "tokens", to: "api/v1/tokens#token"

  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      # Webhooks
      post "monnify/webhook",    to: "webhooks#monnify"
      post "anchor/webhook",     to: "webhooks#anchor"
      post "bridgecard/webhook", to: "webhooks#bridgecard"

      post "/login", to: "sessions#create"
      post "signup", to: "users/registrations#create"
      post "refresh", to: "users/sessions#refresh"
      delete "logout", to: "users/sessions#destroy"
      get "confirmation", to: "users/confirmations#show"

      get "timeline", to: "timeline#index"

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
      end

      # ✅ Transaction PIN (single canonical routing)
      resource :transaction_pin, only: [] do
        get   :status         # GET   /api/v1/transaction_pin/status
        post  :set            # POST  /api/v1/transaction_pin/set
        post  :verify         # POST  /api/v1/transaction_pin/verify
        patch :change         # PATCH /api/v1/transaction_pin/change

        post "reset/request", to: "transaction_pins#reset_request"
        post "reset/confirm", to: "transaction_pins#reset_confirm"
      end

      resources :cards do
        collection do
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
          post :start   # POST /api/v1/verification/tier3/start
          post :liveness # POST /api/v1/verification/tier3/liveness
          get  :status  # GET  /api/v1/verification/tier3/status   ✅ added
        end
      end

        resources :accounts do
          collection do
            post :verify_kyc
            get  :get_account_number
            get  :user_accounts
            get  :get_user_account_detail
            get  :get_account_details
            get  :get_banks
            get  :beneficiaries
            post :resolve

            get  :verify_transfer
            post :initiate_fund_transfer
            post :create_counter_party
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
      end

      resources :receipts, only: [:show]

      resources :fees, only: [:index]

      resources :wallets do
        collection do
          get :user
          post "tunnel/activate",     to: "wallets#activate_tunnel"
          post "tunnel/convert",      to: "wallets#convert_ngn_to_usd"
          post "tunnel/quote",        to: "wallets#quote_ngn_to_usd"
          post "tunnel/convert-back", to: "wallets#convert_usd_to_ngn"
          post "tunnel/quote-back",   to: "wallets#quote_usd_to_ngn"
          post "send_money",          to: "wallets#send_money"
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
          get   :user_profile
          patch :user_update
          patch :update_password
          patch :user_password_update
          post  :password_reset
          get   :password_reset
          patch :activate_user
          get   :resend_confirmation_token
          patch :onboarding_stage
          patch :basic_profile
          patch :use_case
          patch :update_kyc_level
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
          get  :timeline, to: "circles/timeline#index"
          get  :audit_summary
          get  :export_csv
        end

        resources :activities,
                  controller: "circle_activities",
                  only: %i[index show create]

        resources :memberships,
                  controller: "circle_memberships",
                  only: [:create]
      end

      # ✅ Reactions for circle transactions
      resources :circle_transactions, only: [] do
        member do
          post   :react,   to: "circle_transaction_reactions#react"
          delete :unreact, to: "circle_transaction_reactions#unreact"
        end
      end

      resources :disputes, only: [:create]
      resources :statistics

      namespace :admin do
        resources :kyc_reviews, only: %i[index update]
        get 'pricing-spec', to: 'pricing_spec#show'
        get 'ops/health', to: 'ops#health'
        resource :fx_settings, path: 'fx-settings', only: %i[show update] do
          post :refresh_provider
          post :apply_provider
        end
        post 'fx-settings/refresh-provider', to: 'fx_settings#refresh_provider'
        post 'fx-settings/apply-provider', to: 'fx_settings#apply_provider'
        post 'fx-settings/provider/refresh', to: 'fx_settings#refresh_exchange_rate'
        post 'fx-settings/provider/apply', to: 'fx_settings#apply_exchange_rate'
        resources :cards, only: [] do
          post :mock_debit, on: :member
          post :refresh_status, on: :member
          post :sync_transactions, on: :member
          post :enrich_transaction, on: :member
          get :provider_details, on: :member
          post :refresh_provider_status, on: :member
          get :provider_transactions, on: :member
          get :provider_transaction, on: :member
          get :provider_transaction_status, on: :member
          get :events, on: :member
        end
        get 'cards/:id/provider-details', to: 'cards#provider_details'
        post 'cards/:id/refresh-provider-status', to: 'cards#refresh_provider_status'
        post 'cards/:id/sync-transactions', to: 'cards#sync_transactions'
        post 'cards/:id/enrich-transaction', to: 'cards#enrich_transaction'
        get 'cards/:id/provider-transactions', to: 'cards#provider_transactions'
        get 'cards/:id/provider-transaction', to: 'cards#provider_transaction'
        get 'cards/:id/provider-transaction-status', to: 'cards#provider_transaction_status'
        resources :users, only: [:index] do
          post :reveal, on: :member
        end
      end
    end
  end
end
