# frozen_string_literal: true

require_relative '../core/notifications/event_publisher'

module Notifications
  EventPublisher = Core::Notifications::EventPublisher unless const_defined?(:EventPublisher, false)
end
