# frozen_string_literal: true

module Api
  module V1
    class CircleActivitiesController < ApplicationController
      before_action :authenticate_user!
      before_action :set_circle
      before_action :ensure_circle_access_gate!, only: %i[index show]
      before_action :ensure_tier2!, only: [:create], message: 'Complete Tier 2 verification to use shared groups.'
      before_action :authorize_create!, only: [:create]

      # GET /api/v1/circles/:circle_id/activities
      def index
        activities = @circle.circle_activities.recent_first
        memberships = @circle.circle_memberships.includes(user: :user_profile).index_by(&:user_id)

        render json: activities.map { |a| activity_json(a, memberships) }
      end

      # GET /api/v1/circles/:circle_id/activities/:id
      # Returns activity + recent linked transactions (contributions)
      def show
        activity = @circle.circle_activities.find(params[:id])

        txs = activity.circle_transactions
                      .includes(:user)
                      .order(occurred_at: :desc)
                      .limit(50)
        memberships = @circle.circle_memberships.includes(user: :user_profile).index_by(&:user_id)

        render json: {
          activity: activity_json(activity, memberships),
          transactions: txs.map { |tx| tx_json(tx, memberships) }
        }
      end

      # POST /api/v1/circles/:circle_id/activities
      def create
        activity = @circle.circle_activities.new(activity_params)
        activity.created_by = current_user
        activity.status ||= :active

        if activity.save
          memberships = @circle.circle_memberships.includes(user: :user_profile).index_by(&:user_id)
          render json: { activity: activity_json(activity, memberships) }, status: :created
        else
          render json: { errors: activity.errors.full_messages }, status: :unprocessable_entity
        end
      end

      private

      def set_circle
        @circle = current_user.circles.find(params[:circle_id])
      rescue ActiveRecord::RecordNotFound
        render json: { error: 'Circle not found' }, status: :not_found
      end

      def authorize_create!
        memberships = @circle.circle_memberships
        membership_for_current = memberships.find { |m| m.user_id == current_user.id }

        allowed =
          (@circle.owner_id == current_user.id) ||
          (membership_for_current && membership_for_current.admin?)

        return if allowed

        render json: { errors: ['Not authorised to create activities in this group'] }, status: :forbidden
      end

      def activity_params
        params.require(:activity).permit(:name, :target_amount_cents, :deadline_at, :contribution_frequency)
      end

      def ensure_circle_access_gate!
        ensure_circle_access!(@circle, message: 'Complete Tier 2 verification to use shared groups.')
      end

      def activity_json(activity, memberships)
        json = activity.as_json(
          only: %i[id name target_amount_cents deadline_at contribution_frequency status created_at],
          methods: %i[raised_amount_cents]
        )
        json.merge(created_by: circle_user_payload(activity.created_by, memberships[activity.created_by_id]))
      end

      def tx_json(tx, memberships)
        tx.as_json(
          only: %i[id amount_cents direction kind description reference occurred_at circle_activity_id]
        ).merge(user: circle_user_payload(tx.user, memberships[tx.user_id]))
      end

      def circle_user_payload(user, membership = nil)
        return nil unless user

        profile = user.user_profile
        first_name = profile&.first_name
        last_name = profile&.last_name
        email = user.email
        username = membership&.username

        {
          id: user.id,
          username: username,
          display_name: username.presence || mask_name(first_name, last_name, email),
          email: mask_email(email)
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
