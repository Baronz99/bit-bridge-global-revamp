# frozen_string_literal: true

class CardEvent < ApplicationRecord
  belongs_to :user, optional: true
end
