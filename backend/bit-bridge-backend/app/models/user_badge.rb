# frozen_string_literal: true

class UserBadge < ApplicationRecord
  belongs_to :user
  belongs_to :badge
  belongs_to :granted_by_user, class_name: 'User', optional: true
  belongs_to :source_circle, class_name: 'Circle', optional: true

  validates :granted_at, presence: true
  validates :badge_id, uniqueness: { scope: %i[user_id source_circle_id] }
end
