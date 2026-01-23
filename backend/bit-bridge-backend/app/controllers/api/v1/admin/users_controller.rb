# frozen_string_literal: true

module Api
  module V1
    module Admin
      class UsersController < ApplicationController
        before_action :authenticate_user!
        before_action :set_user, only: [:reveal]
        before_action :ensure_compliance!
        before_action :ensure_fresh_admin_session!

        # GET /api/v1/admin/users
        def index
          users = User
                  .includes(:wallet) # loads NGN wallet without N+1
                  .order(created_at: :desc)

          wallet_ids = users.filter_map { |u| u.wallet&.id }
          balances = compute_ngn_balances(wallet_ids)

          data = users.map do |user|
            {
              id: user.id,
              email: user.email,
              created_at: user.created_at,
              active: user.active,
              ngn_wallet_balance: user.wallet ? balances[user.wallet.id][:available] : nil,
              ngn_wallet_raw_balance: user.wallet ? balances[user.wallet.id][:raw] : nil
            }
          end

          render json: { data: data }, status: :ok
        end

        # POST /api/v1/admin/users/:id/reveal
        def reveal
          payload = {
            email: @user.email,
            phone_number: @user.user_profile&.phone_number,
            virtual_accounts: @user.accounts.map do |account|
              {
                id: account.id,
                vendor: account.vendor,
                bank_name: account.bank_name,
                account_number: account.account_number
              }
            end
          }

          log_admin_audit('reveal_pii', metadata: { fields: %w[email phone_number virtual_accounts] })

          render json: { data: payload }, status: :ok
        end

        private

        def set_user
          @user = User.find_by(id: params[:id])
          return if @user

          render json: { message: 'User not found' }, status: :not_found
          return
        end

        def ensure_compliance!
          return if current_user&.compliance? || current_user&.super_admin?

          render json: { message: 'Not authorized' }, status: :forbidden
        end

        def ensure_fresh_admin_session!
          return if current_user&.admin_session_fresh?

          render json: { message: 'Re-auth required' }, status: :unauthorized
        end

        def log_admin_audit(action, metadata: {})
          AdminAuditEvent.create!(
            admin_user_id: current_user.id,
            target_user_id: @user.id,
            action: action,
            ip: request.remote_ip.to_s,
            user_agent: request.user_agent.to_s,
            metadata: metadata
          )
        rescue StandardError
          nil
        end

        def compute_ngn_balances(wallet_ids)
          return {} if wallet_ids.empty?

          deposits = Transaction
                     .unscope(:order)
                     .where(wallet_id: wallet_ids, transaction_type: :deposit, status: :approved)
                     .group(:wallet_id)
                     .sum(:amount)

          withdrawals = Transaction
                        .unscope(:order)
                        .where(wallet_id: wallet_ids, transaction_type: :withdrawal, status: %i[pending approved])
                        .group(:wallet_id)
                        .sum(:amount)

          refunds = WalletLedgerEntry
                    .where(wallet_id: wallet_ids, entry_type: :refund)
                    .group(:wallet_id)
                    .sum(:amount)

          debits = WalletLedgerEntry
                   .where(wallet_id: wallet_ids, entry_type: :debit)
                   .group(:wallet_id)
                   .sum(:amount)

          bill_sums = WalletLedgerEntry
                      .where(wallet_id: wallet_ids, entry_type: %i[hold release debit])
                      .where.not(bill_order_id: nil)
                      .group(:wallet_id, :bill_order_id, :entry_type)
                      .sum(:amount)

          outstanding_by_wallet = Hash.new { |h, k| h[k] = {} }
          bill_sums.each do |(wallet_id, bill_order_id, entry_type), amount|
            outstanding_by_wallet[wallet_id] ||= {}
            outstanding_by_wallet[wallet_id][bill_order_id] ||= { hold: 0.to_d, release: 0.to_d, debit: 0.to_d }
            key =
              if entry_type.is_a?(Integer)
                WalletLedgerEntry.entry_types.key(entry_type)
              else
                entry_type.to_s
              end
            next unless %w[hold release debit].include?(key)

            case key.to_sym
            when :hold then outstanding_by_wallet[wallet_id][bill_order_id][:hold] = amount.to_d
            when :release then outstanding_by_wallet[wallet_id][bill_order_id][:release] = amount.to_d
            when :debit then outstanding_by_wallet[wallet_id][bill_order_id][:debit] = amount.to_d
            end
          end

          outstanding_per_wallet = {}
          outstanding_by_wallet.each do |wallet_id, bills|
            total = bills.values.sum do |totals|
              delta = totals[:hold] - totals[:release] - totals[:debit]
              delta.positive? ? delta : 0.to_d
            end
            outstanding_per_wallet[wallet_id] = total
          end

          wallet_ids.index_with do |wid|
            raw =
              deposits[wid].to_d +
              refunds[wid].to_d -
              withdrawals[wid].to_d -
              debits[wid].to_d
            available = raw - outstanding_per_wallet[wid].to_d
            {
              available: available.positive? ? available.to_f : 0.0,
              raw: raw.to_f
            }
          end
        end
      end
    end
  end
end
