# frozen_string_literal: true

class KycReview < ApplicationRecord
  belongs_to :user
  belongs_to :assigned_to_admin, class_name: 'User', optional: true
  belongs_to :decided_by_admin, class_name: 'User', optional: true
end
