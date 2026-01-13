# frozen_string_literal: true

module Bridgecard
  class EnrichTransactionJob < ApplicationJob
    queue_as :default

    def perform(card_event_id)
      event = CardEvent.find_by(id: card_event_id)
      return if event.blank?

      card = Card.find_by(card_id: event.card_id)
      return if card.blank?

      Bridgecard::EnrichTransactionDetails.call(
        card: card,
        provider_transaction_reference: event.provider_transaction_reference,
        card_event: event
      )
    end
  end
end
