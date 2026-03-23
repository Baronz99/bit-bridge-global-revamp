# frozen_string_literal: true

class UserBadge < ApplicationRecord
  belongs_to :user
  belongs_to :badge
  belongs_to :source_circle, class_name: 'Circle', optional: true
  belongs_to :granted_by_user, class_name: 'User', optional: true
end
