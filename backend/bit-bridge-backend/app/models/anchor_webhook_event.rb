# frozen_string_literal: true

class AnchorWebhookEvent < ApplicationRecord
  validates :event_type, presence: true
  validates :reference, presence: true
end
