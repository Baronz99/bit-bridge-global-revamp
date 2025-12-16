# app/controllers/api/v1/circles_controller.rb
# frozen_string_literal: true

module Api
  module V1
    class CirclesController < ApplicationController
      before_action :authenticate_user!
      before_action :set_circle, only: %i[show fund withdraw]

      # GET /api/v1/circles
      def index
        circles = current_user.circles.includes(:owner)

        render json: circles.as_json(
          only: %i[id name purpose description created_at balance_cents currency],
          include: {
            owner: { only: %i[id email] }
          }
        )
      end

      # GET /api/v1/circles/:id
      def show
        memberships = @circle.circle_memberships.includes(:user)

        recent_txs = @circle.circle_transactions
                            .includes(:user, :reactions, dispute: :raised_by)
                            .order(occurred_at: :desc)
                            .limit(10)

        circle_json = @circle.as_json(
          only: %i[id name purpose description created_at balance_cents currency],
          include: {
            owner: { only: %i[id email] }
          }
        )

        # Figure out who the current user is in this circle
        membership_for_current = memberships.find { |m| m.user_id == current_user.id }

        current_role =
          if @circle.owner_id == current_user.id
            'owner'
          elsif membership_for_current
            membership_for_current.role # "admin" or "member"
          else
            'viewer'
          end

        can_withdraw =
          (@circle.owner_id == current_user.id) ||
          (membership_for_current && membership_for_current.admin?)

        render json: circle_json.merge(
          current_user_role: current_role,
          can_withdraw: can_withdraw,
          members: memberships.map do |m|
            {
              id: m.id,
              role: m.role,
              user: {
                id: m.user.id,
                email: m.user.email
              }
            }
          end,
          recent_transactions: recent_txs.map do |tx|
            reactions_grouped = tx.reactions.group(:emoji).count
            my_reactions = tx.reactions.where(user_id: current_user.id).pluck(:emoji)

            tx.as_json(
              only: %i[id amount_cents direction kind description reference occurred_at],
              include: { user: { only: %i[id email] } }
            ).merge(
              dispute: tx.dispute&.as_json(
                only: %i[id status reason note created_at],
                include: { raised_by: { only: %i[id email] } }
              ),
              reactions: {
                counts: reactions_grouped, # { "👍" => 2, "🎉" => 1 }
                mine: my_reactions         # ["👍"]
              }
            )
          end
        )
      end

      # POST /api/v1/circles
      def create
        circle = Circle.new(circle_params.merge(owner: current_user))

        if circle.save
          circle.circle_memberships.find_or_create_by!(user: current_user, role: :admin)

          render json: circle.as_json(
            only: %i[id name purpose description created_at balance_cents currency],
            include: {
              owner: { only: %i[id email] }
            }
          ), status: :created
        else
          render json: { errors: circle.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/circles/:id/fund
      # Params: { amount_cents: 500_00, note: "December PHCN" }
      def fund
        amount_cents = params[:amount_cents].to_i
        note         = params[:note].to_s

        if amount_cents <= 0
          return render json: { errors: ['Amount must be greater than zero'] },
                        status: :unprocessable_entity
        end

        wallet = current_user.wallet
        unless wallet
          return render json: { errors: ['You do not have a wallet yet.'] },
                        status: :unprocessable_entity
        end

        amount_naira = amount_cents / 100.0

        if wallet.balance < amount_naira
          return render json: { errors: ['Insufficient wallet balance.'] },
                        status: :unprocessable_entity
        end

        ActiveRecord::Base.transaction do
          # 1) debit main wallet (Transaction model, using only real columns)
          wallet.transactions.create!(
            transaction_type: :withdrawal, # enum
            status:           :approved,   # enum
            coin_type:        :bank,       # enum
            amount:           amount_naira,
            address:          "circle:#{@circle.id}"
          )

          # 2) credit circle mini-wallet + log circle transaction
          @circle.apply_transaction!(
            amount_cents: amount_cents,
            direction:    'credit', # ✅ valid enum for CircleTransaction
            user:         current_user,
            kind:         'fund',
            description:  note.presence || 'Funding from main wallet'
          )
        end

        render json: { balance_cents: @circle.reload.balance_cents }, status: :ok
      rescue ActiveRecord::RecordInvalid => e
        Rails.logger.error("[Circles#fund] validation failed: #{e.record.class} - #{e.record.errors.full_messages.join(', ')}")
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      rescue StandardError => e
        Rails.logger.error("[Circles#fund] #{e.class}: #{e.message}")
        render json: { errors: ['Unable to fund group at the moment. Please try again.'] },
               status: :unprocessable_entity
      end

      # POST /api/v1/circles/:id/withdraw
      # Params: { amount_cents: 300_00, note: "Refund after bill" }
      def withdraw
        amount_cents = params[:amount_cents].to_i
        note         = params[:note].to_s

        if amount_cents <= 0
          return render json: { errors: ['Amount must be greater than zero'] },
                        status: :unprocessable_entity
        end

        wallet = current_user.wallet
        unless wallet
          return render json: { errors: ['You do not have a wallet yet.'] },
                        status: :unprocessable_entity
        end

        # circle balance is stored in cents
        if @circle.balance_cents < amount_cents
          return render json: { errors: ['Group balance is not enough for this payout.'] },
                        status: :unprocessable_entity
        end

        amount_naira = amount_cents / 100.0

        ActiveRecord::Base.transaction do
          # 1) credit main wallet
          wallet.transactions.create!(
            transaction_type: :deposit,  # enum
            status:           :approved, # enum
            coin_type:        :bank,     # enum
            amount:           amount_naira,
            address:          "circle:#{@circle.id}"
          )

          # 2) debit circle mini-wallet + log circle transaction
          @circle.apply_transaction!(
            amount_cents: amount_cents,
            direction:    'debit',
            user:         current_user,
            kind:         'payout',
            description:  note.presence || 'Payout to main wallet'
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

      private

      def set_circle
        @circle = current_user.circles.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { error: 'Circle not found' }, status: :not_found
      end

      def circle_params
        params.require(:circle).permit(:name, :purpose, :description)
      end
    end
  end
end
