# frozen_string_literal: true

require 'csv'

module Api
  module V1
    class CirclesController < ApplicationController
      before_action :authenticate_user!
      before_action :set_circle, only: %i[show fund withdraw audit_summary export_csv]

      # ✅ Keep your existing withdraw authorization rule
      before_action :authorize_withdraw!, only: %i[withdraw]

      # ✅ NEW: Require transaction PIN for any circle money movement
      # (wallet debits + wallet credits)
      before_action :require_circle_transaction_pin!, only: %i[fund withdraw]

      # GET /api/v1/circles
      def index
        circles = current_user.circles.includes(:owner)

        render json: circles.as_json(
          only: %i[id name purpose description created_at balance_cents currency],
          include: { owner: { only: %i[id email] } }
        )
      end

      # GET /api/v1/circles/:id
      def show
        memberships = @circle.circle_memberships.includes(:user)

        recent_txs = @circle.circle_transactions
                            .includes(:user, :reactions, :circle_activity, dispute: :raised_by)
                            .order(occurred_at: :desc)
                            .limit(10)

        circle_json = @circle.as_json(
          only: %i[id name purpose description created_at balance_cents currency],
          include: { owner: { only: %i[id email] } }
        )

        membership_for_current = memberships.find { |m| m.user_id == current_user.id }

        current_role =
          if @circle.owner_id == current_user.id
            'owner'
          elsif membership_for_current
            membership_for_current.role
          else
            'viewer'
          end

        can_withdraw =
          (@circle.owner_id == current_user.id) ||
          (membership_for_current && membership_for_current.admin?)

        recent_transactions_json = recent_txs.map do |tx|
          reactions_grouped = tx.reactions.group(:emoji).count
          my_reactions = tx.reactions.where(user_id: current_user.id).pluck(:emoji)

          tx.as_json(
            only: %i[id amount_cents direction kind description reference occurred_at circle_activity_id],
            include: {
              user: { only: %i[id email] },
              circle_activity: { only: %i[id name status target_amount_cents deadline_at] }
            }
          ).merge(
            dispute: tx.dispute&.as_json(
              only: %i[id status reason note created_at],
              include: { raised_by: { only: %i[id email] } }
            ),
            reactions: {
              counts: reactions_grouped,
              mine: my_reactions
            }
          )
        end

        render json: circle_json.merge(
          current_user_role: current_role,
          can_withdraw: can_withdraw,
          members: memberships.map { |m|
            {
              id: m.id,
              role: m.role,
              user: { id: m.user.id, email: m.user.email }
            }
          },
          recent_transactions: recent_transactions_json
        )
      end

      # POST /api/v1/circles
      def create
        circle = Circle.new(circle_params.merge(owner: current_user))

        if circle.save
          circle.circle_memberships.find_or_create_by!(user: current_user, role: :admin)

          render json: circle.as_json(
            only: %i[id name purpose description created_at balance_cents currency],
            include: { owner: { only: %i[id email] } }
          ), status: :created
        else
          render json: { errors: circle.errors.full_messages }, status: :unprocessable_entity
        end
      end

   # POST /api/v1/circles/:id/fund
# optional circle_activity_id to tag deposit
def fund
  amount_cents        = params[:amount_cents].to_i
  note               = params[:note].to_s
  circle_activity_id = params[:circle_activity_id].presence

  if amount_cents <= 0
    return render json: { errors: ['Amount must be greater than zero'] }, status: :unprocessable_entity
  end

  # ✅ PIN required because this debits the user's wallet
  unless require_transaction_pin!
    return
  end

  wallet = current_user.wallet
  return render(json: { errors: ['You do not have a wallet yet.'] }, status: :unprocessable_entity) unless wallet

  amount_naira = amount_cents / 100.0
  if wallet.balance < amount_naira
    return render json: { errors: ['Insufficient wallet balance.'] }, status: :unprocessable_entity
  end

  activity = nil
  if circle_activity_id
    activity = @circle.circle_activities.find_by(id: circle_activity_id)
    return render(json: { errors: ['Activity not found for this circle.'] }, status: :unprocessable_entity) unless activity
  end

  ActiveRecord::Base.transaction do
    wallet.transactions.create!(
      transaction_type: :withdrawal,
      status: :approved,
      coin_type: :bank,
      amount: amount_naira,
      address: "circle:#{@circle.id}"
    )

    @circle.apply_transaction!(
      amount_cents: amount_cents,
      direction: 'credit',
      user: current_user,
      kind: 'fund',
      description: note.presence || 'Funding from main wallet',
      circle_activity: activity
    )
  end

  render json: { balance_cents: @circle.reload.balance_cents }, status: :ok
rescue ActiveRecord::RecordInvalid => e
  Rails.logger.error("[Circles#fund] validation failed: #{e.record.class} - #{e.record.errors.full_messages.join(', ')}")
  render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
rescue StandardError => e
  Rails.logger.error("[Circles#fund] #{e.class}: #{e.message}")
  render json: { errors: ['Unable to fund group at the moment. Please try again.'] }, status: :unprocessable_entity
end

# POST /api/v1/circles/:id/withdraw
def withdraw
  amount_cents = params[:amount_cents].to_i
  note         = params[:note].to_s

  if amount_cents <= 0
    return render json: { errors: ['Amount must be greater than zero'] }, status: :unprocessable_entity
  end

  # ✅ PIN required because this moves money out of the group mini-wallet
  unless require_transaction_pin!
    return
  end

  wallet = current_user.wallet
  return render(json: { errors: ['You do not have a wallet yet.'] }, status: :unprocessable_entity) unless wallet

  if @circle.balance_cents.to_i < amount_cents
    return render json: { errors: ['Group balance is not enough for this payout.'] }, status: :unprocessable_entity
  end

  amount_naira = amount_cents / 100.0

  ActiveRecord::Base.transaction do
    wallet.transactions.create!(
      transaction_type: :deposit,
      status: :approved,
      coin_type: :bank,
      amount: amount_naira,
      address: "circle:#{@circle.id}"
    )

    @circle.apply_transaction!(
      amount_cents: amount_cents,
      direction: 'debit',
      user: current_user,
      kind: 'payout',
      description: note.presence || 'Payout to main wallet'
    )
  end

  render json: { balance_cents: @circle.reload.balance_cents }, status: :ok
rescue ActiveRecord::RecordInvalid => e
  Rails.logger.error("[Circles#withdraw] validation failed: #{e.record.class} - #{e.record.errors.full_messages.join(', ')}")
  render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
rescue StandardError => e
  Rails.logger.error("[Circles#withdraw] #{e.class}: #{e.message}")
  render json: { errors: ['Unable to move money out of this group at the moment. Please try again.'] },
         status: :unprocessable_entity
end


      # GET /api/v1/circles/:id/audit_summary
      def audit_summary
        txs = @circle.circle_transactions

        total_in_cents  = txs.where(direction: CircleTransaction.directions[:credit]).sum(:amount_cents)
        total_out_cents = txs.where(direction: CircleTransaction.directions[:debit]).sum(:amount_cents)

        render json: {
          circle_id: @circle.id,
          balance_cents: @circle.balance_cents.to_i,
          total_in_cents: total_in_cents,
          total_out_cents: total_out_cents,
          tx_count: txs.count,
          last_tx_at: txs.maximum(:occurred_at)
        }
      end

      # GET /api/v1/circles/:id/export_csv
      # Export amounts as human-readable NAIRA only (single amount column).
      def export_csv
        txs = @circle.circle_transactions.includes(:user, :circle_activity).order(occurred_at: :desc)

        csv = CSV.generate(headers: true) do |out|
          out << %w[id occurred_at user_email direction kind amount description activity_id activity_name]

          txs.each do |tx|
            amount_naira = tx.amount_cents.to_i / 100.0

            out << [
              tx.id,
              tx.occurred_at,
              tx.user&.email,
              tx.direction,
              tx.kind,
              format('%.2f', amount_naira),
              tx.description,
              tx.circle_activity_id,
              tx.circle_activity&.name
            ]
          end
        end

        send_data csv,
                  filename: "circle-#{@circle.id}-transactions.csv",
                  type: 'text/csv'
      end

      private

      def set_circle
        @circle = current_user.circles.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { error: 'Circle not found' }, status: :not_found
      end

      # ✅ Withdraw permission stays exactly as you had it
      def authorize_withdraw!
        memberships = @circle.circle_memberships
        membership_for_current = memberships.find { |m| m.user_id == current_user.id }

        allowed =
          (@circle.owner_id == current_user.id) ||
          (membership_for_current && membership_for_current.admin?)

        return if allowed

        render json: { errors: ['Not authorised to withdraw from this group'] }, status: :forbidden
      end

      def extract_pin_param
  params[:pin].presence ||
    params[:transaction_pin].presence ||
    params.dig(:user, :pin).presence ||
    params.dig(:user, :transaction_pin).presence
end

def require_transaction_pin!
  pin = extract_pin_param

  unless current_user.transaction_pin_set?
    render json: { errors: ['Transaction PIN not set'] }, status: :unprocessable_entity
    return false
  end

  if pin.blank?
    render json: { errors: ['Transaction PIN is required'] }, status: :unprocessable_entity
    return false
  end

  unless current_user.valid_transaction_pin?(pin)
    render json: { errors: ['Invalid transaction PIN'] }, status: :unauthorized
    return false
  end

  true
end


      # ✅ NEW: Transaction PIN required for fund + withdraw
      # Accepts multiple param shapes so frontend can send any of these:
      # - { pin: "1234" }
      # - { circle: { pin: "1234" } }
      def require_circle_transaction_pin!
        unless current_user.transaction_pin_set?
          render json: { errors: ['Please set a transaction PIN before performing this action.'] },
                 status: :unprocessable_entity
          return false
        end

        pin =
          params[:pin].presence ||
          params[:transaction_pin].presence ||
          params.dig(:circle, :pin).presence ||
          params.dig(:circle, :transaction_pin).presence

        if pin.blank?
          render json: { errors: ['Transaction PIN is required'] }, status: :unprocessable_entity
          return false
        end

        unless current_user.valid_transaction_pin?(pin)
          render json: { errors: ['Invalid transaction PIN'] }, status: :unauthorized
          return false
        end

        true
      end

      def circle_params
        params.require(:circle).permit(:name, :purpose, :description)
      end
    end
  end
end
