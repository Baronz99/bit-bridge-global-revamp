# frozen_string_literal: true

class NotificationDelivery < ApplicationRecord
  belongs_to :notification_event
  belongs_to :notification_device

  enum :status, { queued: 0, delivered: 1, failed: 2 }, validate: true
end
