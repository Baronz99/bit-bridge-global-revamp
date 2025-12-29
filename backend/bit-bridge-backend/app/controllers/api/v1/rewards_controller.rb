# frozen_string_literal: true

module Api
  module V1
    class RewardsController < ApplicationController
      before_action :authenticate_user!

      def index
        rewards = current_user.reward_transactions.order(earned_at: :desc, created_at: :desc)

        total_earned = rewards.sum(:amount)
        last_reward = rewards.first
        today = Time.zone.today
        week_start = today.beginning_of_week
        month_start = today.beginning_of_month

        today_earned = rewards.where(earned_at: today.all_day).sum(:amount)
        week_earned = rewards.where(earned_at: week_start..today.end_of_day).sum(:amount)
        month_earned = rewards.where(earned_at: month_start..today.end_of_day).sum(:amount)

        streak = consecutive_day_streak(rewards)
        level, next_goal = reward_level(total_earned)

        render json: {
          data: {
            total_earned: total_earned.to_f,
            today_earned: today_earned.to_f,
            week_earned: week_earned.to_f,
            month_earned: month_earned.to_f,
            streak_days: streak,
            level: level,
            next_goal: next_goal,
            last_reward_at: last_reward&.earned_at,
            reward_count: rewards.count
          },
          rewards: rewards.map { |reward| serialize_reward(reward) }
        }
      end

      private

      def serialize_reward(reward)
        {
          id: reward.id,
          amount: reward.amount.to_f,
          currency: reward.currency,
          service_type: reward.service_type,
          source_label: reward.source_label,
          status: reward.status,
          earned_at: reward.earned_at || reward.created_at,
          source_amount: reward.source_amount.to_f
        }
      end

      def consecutive_day_streak(rewards)
        dates =
          rewards
          .where.not(earned_at: nil)
          .pluck(:earned_at)
          .map(&:to_date)
          .uniq

        return 0 if dates.empty?

        streak = 0
        cursor = Time.zone.today

        while dates.include?(cursor)
          streak += 1
          cursor -= 1.day
        end

        streak
      end

      def reward_level(total)
        goal = 500.0
        return [1, goal] if total < goal

        level = (total / goal).floor + 1
        next_goal = level * goal
        [level, next_goal]
      end
    end
  end
end
