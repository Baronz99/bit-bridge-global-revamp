# frozen_string_literal: true

class RiskEvent < ApplicationRecord
  belongs_to :user

  validates :trigger_type, :action_taken, presence: true
end
