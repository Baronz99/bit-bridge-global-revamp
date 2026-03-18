# frozen_string_literal: true

module Api
  module V1
    module Admin
      class CircleContributorsController < ApplicationController
        before_action :require_admin_access!
        before_action :set_circle

        def show
          contributors = contributor_rows

          AdminAuditEvent.create!(
            admin_user_id: current_user.id,
            action: 'admin.circle_contributors.list',
            metadata: {
              circle_id: @circle.id,
              contributor_count: contributors.size,
              request_id: request.request_id
            }
          )

          render json: {
            data: {
              circle: {
                id: @circle.id,
                name: @circle.name,
                circle_type: @circle.circle_type,
                badge_label: @circle.badge_label
              },
              contributors_count: contributors.size,
              contributors: contributors
            }
          }, status: :ok
        end

        private

        def require_admin_access!
          return if current_user&.admin_access?

          render json: { message: 'Not authorized' }, status: :forbidden
        end

        def set_circle
          @circle = Circle.find(params[:id])
        rescue ActiveRecord::RecordNotFound
          render json: { message: 'Circle not found' }, status: :not_found
        end

        def contributor_rows
          summaries = @circle.circle_transactions
                             .where(direction: CircleTransaction.directions[:credit], kind: 'fund')
                             .group(:user_id)
                             .select(
                               :user_id,
                               'SUM(amount_cents) AS total_contributed_cents',
                               'COUNT(*) AS contribution_count',
                               'MIN(occurred_at) AS first_contributed_at',
                               'MAX(occurred_at) AS last_contributed_at'
                             )
                             .order(Arel.sql('SUM(amount_cents) DESC, MAX(occurred_at) DESC'))

          user_ids = summaries.map(&:user_id)
          users_by_id = User.includes(:user_profile).where(id: user_ids).index_by(&:id)
          memberships_by_user_id = @circle.circle_memberships.where(user_id: user_ids).index_by(&:user_id)

          summaries.map do |summary|
            user = users_by_id[summary.user_id]
            membership = memberships_by_user_id[summary.user_id]

            {
              user_id: summary.user_id,
              username: membership&.username,
              display_name: contributor_display_name(user, membership),
              email: user&.email,
              total_contributed_cents: summary.total_contributed_cents.to_i,
              contribution_count: summary.contribution_count.to_i,
              first_contributed_at: summary.first_contributed_at,
              last_contributed_at: summary.last_contributed_at
            }
          end
        end

        def contributor_display_name(user, membership)
          return membership.username if membership&.username.present?
          return '' unless user

          first_name = user.user_profile&.first_name.to_s.strip
          last_name = user.user_profile&.last_name.to_s.strip
          full_name = [first_name, last_name].reject(&:blank?).join(' ').strip

          full_name.presence || user.email.to_s
        end
      end
    end
  end
end
