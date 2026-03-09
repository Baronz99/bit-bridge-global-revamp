# frozen_string_literal: true

require_relative '../core/notifications/transaction_email_event_contract'

module Notifications
  TransactionEmailEventContract = Core::Notifications::TransactionEmailEventContract unless const_defined?(:TransactionEmailEventContract, false)
end
