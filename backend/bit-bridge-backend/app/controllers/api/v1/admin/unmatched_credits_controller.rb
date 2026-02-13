# frozen_string_literal: true

module Api
  module V1
    module Admin
      class UnmatchedCreditsController < ApplicationController
        before_action :authenticate_user!
        before_action :ensure_super_admin!
        before_action :set_unmatched_credit, only: %i[update apply]

        def index
          scope = UnmatchedCredit.order(created_at: :desc)
          scope = scope.where(status: params[:status].to_s) if params[:status].present?
          scope = scope.limit(parse_limit(params[:limit]))
          return if performed?

          render json: {
            data: scope.map { |credit| serialize_credit(credit) }
          }, status: :ok
        end

        def update
          action = params[:action_type].to_s
          unless action == 'reviewed'
            return render json: {
              message: 'action_type must be reviewed',
              error_code: 'ACTION_INVALID'
            }, status: :unprocessable_entity
          end

          @unmatched_credit.with_lock do
            if @unmatched_credit.status == 'resolved'
              return render json: {
                message: 'Credit already applied',
                error_code: 'ALREADY_APPLIED'
              }, status: :conflict
            end

            @unmatched_credit.update!(
              status: 'ignored',
              resolved_at: Time.current
            )
          end

          render json: { data: serialize_credit(@unmatched_credit.reload) }, status: :ok
        end

        def apply
          wallet = Wallet.find_by(id: params[:wallet_id])
          return render_wallet_missing unless wallet

          if @unmatched_credit.amount.blank? || @unmatched_credit.amount.to_d <= 0
            return render json: {
              message: 'Unmatched credit amount is invalid',
              error_code: 'UNMATCHED_CREDIT_INVALID'
            }, status: :unprocessable_entity
          end

          @unmatched_credit.with_lock do
            if @unmatched_credit.status == 'resolved'
              return render json: {
                message: 'Credit already applied',
                error_code: 'ALREADY_APPLIED'
              }, status: :conflict
            end

            ActiveRecord::Base.transaction do
              wallet.lock!
              txn = wallet.transactions.create!(
                status: :approved,
                transaction_type: :deposit,
                amount: @unmatched_credit.amount.to_d,
                address: @unmatched_credit.account_number.presence || 'Unmatched credit apply',
                account_name: @unmatched_credit.account_name,
                bank_code: @unmatched_credit.bank_code,
                bank: @unmatched_credit.bank_name,
                coin_type: :bank,
                unique_transaction_id: "unmatched-credit-#{@unmatched_credit.id}",
                metadata: {
                  source: 'unmatched_credit_apply',
                  unmatched_credit_id: @unmatched_credit.id,
                  provider: @unmatched_credit.provider,
                  provider_reference: @unmatched_credit.provider_reference
                }
              )

              @unmatched_credit.update!(
                status: 'resolved',
                resolved_at: Time.current,
                user_id: wallet.user_id,
                wallet_id: wallet.id,
                payload: (@unmatched_credit.payload.is_a?(Hash) ? @unmatched_credit.payload : {}).merge(
                  'applied_transaction_id' => txn.id
                )
              )
            end
          end

          render json: { data: serialize_credit(@unmatched_credit.reload) }, status: :ok
        end

        private

        def set_unmatched_credit
          @unmatched_credit = UnmatchedCredit.find(params[:id])
        end

        def parse_limit(raw)
          value = raw.present? ? Integer(raw) : 100
          return [value, 200].min if value.positive?

          render json: { message: 'limit must be between 1 and 200', error_code: 'LIMIT_INVALID' }, status: :unprocessable_entity
          nil
        rescue ArgumentError, TypeError
          render json: { message: 'limit must be an integer', error_code: 'LIMIT_INVALID' }, status: :unprocessable_entity
          nil
        end

        def render_wallet_missing
          render json: {
            message: 'wallet_id is required and must be valid',
            error_code: 'WALLET_INVALID'
          }, status: :unprocessable_entity
        end

        def serialize_credit(credit)
          {
            id: credit.id,
            provider: credit.provider,
            reference: credit.reference,
            provider_reference: credit.provider_reference,
            amount: credit.amount,
            currency: credit.currency,
            reason: credit.reason,
            status: credit.status,
            account_number: credit.account_number,
            account_name: credit.account_name,
            bank_code: credit.bank_code,
            bank_name: credit.bank_name,
            user_id: credit.user_id,
            wallet_id: credit.wallet_id,
            resolved_at: credit.resolved_at,
            created_at: credit.created_at,
            updated_at: credit.updated_at
          }
        end
      end
    end
  end
end

