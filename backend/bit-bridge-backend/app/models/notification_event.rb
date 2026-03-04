# frozen_string_literal: true

class NotificationEvent < ApplicationRecord
  belongs_to :user
  has_many :notification_deliveries, dependent: :destroy

  enum :status, { queued: 0, processing: 1, delivered: 2, failed: 3 }, validate: true
  enum :priority, { normal: 'normal', high: 'high' }, validate: true

  validates :event_type, :resource_type, :resource_id, :state, :title, :body, :idempotency_key, :occurred_at, presence: true
  validates :idempotency_key, uniqueness: true
end
