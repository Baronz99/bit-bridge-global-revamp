# frozen_string_literal: true

require 'csv'

module Api
  module V1
    class CirclesController < ApplicationController
      before_action :authenticate_user!
      before_action :ensure_tier2!, message: 'Complete Tier 2 verification to use shared groups.'
      before_action :set_circle, only: %i[show fund withdraw audit_summary export_csv]

      # Keep your existing withdraw rule
      before_action :authorize_withdraw!, only: %i[withdraw]

      # Require PIN for money movement
      before_action :require_pin_for_circle_money_movement!, only: %i[fund withdraw]

      def index
        circles = current_user.circles.includes(:owner)

        render json: circles.as_json(
          only: %i[id name purpose description created_at balance_cents currency],
          include: { owner: { only: %i[id email] } }
        )
      end

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
        can_view_full_members =
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
          members: memberships.map { |m| member_payload(m, can_view_full_members) },
          recent_transactions: recent_transactions_json
        )
      end

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
      def fund
        amount_cents        = params[:amount_cents].to_i
        note               = params[:note].to_s
        circle_activity_id = params[:circle_activity_id].presence

        if amount_cents <= 0
          return render json: { errors: ['Amount must be greater than zero'] }, status: :unprocessable_entity
        end

        wallet = current_user.ngn_wallet
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

        wallet = current_user.ngn_wallet
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

      def authorize_withdraw!
        memberships = @circle.circle_memberships
        membership_for_current = memberships.find { |m| m.user_id == current_user.id }

        allowed =
          (@circle.owner_id == current_user.id) ||
          (membership_for_current && membership_for_current.admin?)

        return if allowed

        render json: { errors: ['Not authorised to withdraw from this group'] }, status: :forbidden
      end

      def require_pin_for_circle_money_movement!
  # Uses ApplicationController shared PIN extractor (supports circle.pin / transaction_pin etc.)
  return if require_transaction_pin!
  false
end


      def circle_params
        params.require(:circle).permit(:name, :purpose, :description)
      end

      def member_payload(membership, allow_full)
        user = membership.user
        profile = user.user_profile
        first_name = profile&.first_name
        last_name = profile&.last_name
        phone = profile&.phone_number
        email = user.email

        if allow_full
          display_name = [first_name, last_name].compact.join(' ')
          display_name = email if display_name.blank?
          return {
            id: membership.id,
            role: membership.role,
            masked: false,
            user: {
              id: user.id,
              email: email,
              phone_number: phone,
              first_name: first_name,
              last_name: last_name,
              display_name: display_name
            }
          }
        end

        {
          id: membership.id,
          role: membership.role,
          masked: true,
          user: {
            id: user.id,
            email: mask_email(email),
            phone_number: mask_phone(phone),
            display_name: mask_name(first_name, last_name, email)
          }
        }
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

      def mask_phone(phone)
        return '' if phone.blank?
        digits = phone.to_s.gsub(/\D/, '')
        return '*' * phone.length if digits.length <= 4
        masked = digits.gsub(/\d(?=\d{4})/, '*')
        masked
      end

      def mask_name(first_name, last_name, email)
        if first_name.present? || last_name.present?
          fi = first_name.to_s.strip[0] || ''
          li = last_name.to_s.strip[0] || ''
          return [fi, li].reject(&:blank?).map { |c| "#{c}." }.join(' ').strip
        end
        mask_email(email)
      end
    end
  end
end
