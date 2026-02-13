# frozen_string_literal: true

class UnmatchedCredit < ApplicationRecord
  belongs_to :user, optional: true
  belongs_to :wallet, optional: true
  belongs_to :reviewed_by_user, class_name: 'User', foreign_key: :reviewed_by_user_id, optional: true
  belongs_to :applied_by_user, class_name: 'User', foreign_key: :applied_by_user_id, optional: true

  STATUSES = %w[pending resolved ignored].freeze

  validates :provider, :provider_reference, :reason, :status, presence: true
  validates :status, inclusion: { in: STATUSES }
end
