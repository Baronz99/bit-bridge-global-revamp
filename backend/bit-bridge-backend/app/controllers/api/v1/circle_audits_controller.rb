# frozen_string_literal: true

require 'csv'

module Api
  module V1
    class CircleAuditsController < ApplicationController
      before_action :authenticate_user!
      before_action :set_circle
      before_action :ensure_circle_access_gate!

      # GET /api/v1/circles/:id/audit
      def show
        tx_scope = @circle.circle_transactions
        txs = tx_scope
                .includes(:user, :circle_activity)
                .order(occurred_at: :desc)
                .limit(500)
        membership_by_user_id = @circle.circle_memberships.where(user_id: txs.map(&:user_id).uniq).index_by(&:user_id)

        total_in_cents  = tx_scope.where(direction: CircleTransaction.directions[:credit]).sum(:amount_cents)
        total_out_cents = tx_scope.where(direction: CircleTransaction.directions[:debit]).sum(:amount_cents)

        render json: {
          circle: {
            id: @circle.id,
            name: @circle.name,
            balance_cents: @circle.balance_cents,
            currency: @circle.currency
          },
          totals: {
            total_in_cents: total_in_cents,
            total_out_cents: total_out_cents,
            tx_count: tx_scope.count
          },
          transactions: txs.map { |tx|
            email = mask_email(tx.user&.email)
            username = membership_by_user_id[tx.user_id]&.username
            {
              id: tx.id,
              occurred_at: tx.occurred_at,
              username: username,
              user_email: email,
              direction: tx.direction,
              amount_cents: tx.amount_cents,
              kind: tx.kind,
              description: tx.description,
              reference: tx.reference,
              circle_activity_id: tx.circle_activity_id,
              circle_activity_name: tx.circle_activity&.name
            }
          }
        }, status: :ok
      end

      # GET /api/v1/circles/:id/audit.csv
      def csv
        txs = @circle.circle_transactions
                     .includes(:user, :circle_activity)
                     .order(occurred_at: :desc)
                     .limit(2000)
        membership_by_user_id = @circle.circle_memberships.where(user_id: txs.map(&:user_id).uniq).index_by(&:user_id)

        csv_str = CSV.generate(headers: true) do |csv|
          csv << %w[
            occurred_at username user_email direction amount_cents kind description reference activity_id activity_name
          ]

          txs.each do |tx|
            email = mask_email(tx.user&.email)
            username = membership_by_user_id[tx.user_id]&.username
            csv << [
              tx.occurred_at,
              username,
              email,
              tx.direction,
              tx.amount_cents,
              tx.kind,
              tx.description,
              tx.reference,
              tx.circle_activity_id,
              tx.circle_activity&.name
            ]
          end
        end

        send_data csv_str,
                  filename: "circle-audit-#{@circle.id}.csv",
                  type: 'text/csv; charset=utf-8'
      end

      private

      def set_circle
        @circle = current_user.circles.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { error: 'Circle not found' }, status: :not_found
      end

      def mask_email(email)
        return '' if email.blank?
        local, domain = email.split('@', 2)
        return email if domain.blank?
        local_mask = local.length <= 1 ? '*' : "#{local[0]}***"
        domain_name, tld = domain.split('.', 2)
        domain_mask = domain_name.present? ? "#{domain_name[0]}***" : '***'
        tld_part = tld.present? ? ".#{tld}" : ''
        "#{local_mask}@#{domain_mask}#{tld_part}"
      end

      def ensure_circle_access_gate!
        ensure_circle_access!(@circle, message: 'Complete Tier 2 verification to use shared groups.')
      end
    end
  end
end
