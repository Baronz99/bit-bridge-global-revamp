# frozen_string_literal: true

require_relative '../../core/notifications/providers/expo_push'

module Notifications
  module Providers
    ExpoPush = Core::Notifications::Providers::ExpoPush unless const_defined?(:ExpoPush, false)
  end
end
