# frozen_string_literal: true

class MonifyToken < ApplicationRecord
  default_scope { order(created_at: :desc) }
end
