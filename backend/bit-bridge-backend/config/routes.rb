# frozen_string_literal: true

Rails.application.routes.draw do
  resources :cards
  resources :bank_transactions
  resources :commissions
  resources :bill_orders

  get 'users/index'
  get 'users/update'
  get 'users/delete'
  get 'health', to: 'health#index'

  devise_for :users, path: '', path_names: {
    sign_in: 'login',
    sign_out: 'logout',
    registration: 'signup'
  }, controllers: {
    sessions: 'users/sessions',
    confirmations: 'users/confirmations',
    registrations: 'users/registrations'
  }

  # 👇 refresh token endpoint – frontend calls POST `${baseUrl}refresh`
  devise_scope :user do
    get 'confirmation', to: 'users/confirmations#show'
    post 'refresh', to: 'users/sessions#refresh'   # <-- changed from refresh_token to refresh
  end

  get 'tokens', to: 'api/v1/tokens#token'

  # Health check
  get 'up' => 'rails/health#show', as: :rails_health_check

  namespace :api do
    namespace :v1 do
      post 'monnify/webhook', to: 'webhooks#monnify'
      post 'anchor/webhook', to: 'webhooks#anchor'

      # ✅ ONBOARDING + KYC ROUTES
      namespace :onboarding, path: 'onboarding' do
        patch 'profile',  to: 'onboarding#update_profile'
        patch 'use_case', to: 'onboarding#update_use_case'
        post  'kyc',      to: 'onboarding#submit_kyc'
      end

      resources :cards do
        collection do
          post :fund_wallet
          post :register_cardholder
          get  :user_card
          post :create_card
        end
      end

      # ❌ `resources :refresh` removed – we now use top-level POST /refresh

      resources :accounts do
        collection do
          post :verify_kyc
          get  :get_account_number
          get  :user_accounts
          get  :get_user_account_detail
          get  :get_account_details
          get  :get_banks

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
        collection do
          get :get_currency
        end
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
        collection do
          get :user
        end
      end

      resources :products
      resources :provisions
      resources :gift_cards

      resources :transactions do
        collection do
          post :initialize_transaction
          post :create_user
          get  :user
        end
      end

      resources :wallets do
        collection do
          get :user
        end
      end

      resources :order_items

      resources :order_details do
        collection do
          get :user
        end
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
        collection do
          get :user
        end
      end

      resources :users do
        collection do
          get  :user_profile
          patch :user_update
          patch :update_password          # used by reset-password form
          patch :user_password_update
          post  :password_reset           # send reset email
          get   :password_reset           # optional: supports GET /users/password_reset?email=...
          patch :activate_user
          get   :resend_confirmation_token
          patch :onboarding_stage
          patch :basic_profile
          patch :use_case                # <- existing use_case route kept
          patch :update_kyc_level
        end
      end

      resources :statistics
    end
  end

  # root "posts#index"
end
