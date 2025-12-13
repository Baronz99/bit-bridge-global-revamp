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

  devise_scope :user do
    get  'confirmation', to: 'users/confirmations#show'
    post 'refresh',      to: 'users/sessions#refresh'
  end

  get 'tokens', to: 'api/v1/tokens#token'

  # Health check
  get 'up' => 'rails/health#show', as: :rails_health_check

  namespace :api do
    namespace :v1 do
      # Webhooks
      post 'monnify/webhook', to: 'webhooks#monnify'
      post 'anchor/webhook',  to: 'webhooks#anchor'

      # Onboarding + KYC
      patch 'onboarding/profile',  to: 'onboarding#update_profile'
      patch 'onboarding/use_case', to: 'onboarding#update_use_case'
      post  'onboarding/kyc',      to: 'onboarding#submit_kyc'

      resources :cards do
        collection do
          post :fund_wallet
          post :register_cardholder
          get  :user_card
          post :create_card
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
      end

      # ✅ Shared Circles Route + mini-wallet + member invites
      resources :circles, only: %i[index show create] do
        member do
          post :fund   # POST /api/v1/circles/:id/fund
        end

        # nested memberships: /api/v1/circles/:circle_id/memberships
        resources :memberships,
                  controller: 'circle_memberships',
                  only: [:create]
      end

      resources :statistics
    end
  end

  # root "posts#index"
end
