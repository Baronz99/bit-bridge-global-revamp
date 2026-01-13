# frozen_string_literal: true

module Cards
  class RiskEngine
    DECLINE_LIMIT = 3

    def self.record_decline!(card:, reason:, provider_reference:)
      return if card.blank?

      card.with_lock do
        card.decline_count = card.decline_count.to_i + 1
        card.last_declined_at = Time.current
        card.save!

        return unless card.decline_count >= DECLINE_LIMIT
        return if card.status.to_s.downcase == 'frozen'

        BridgeCardService.new.freeze_card(card.card_id)
        card.update!(
          status: 'frozen',
          frozen_by: 'system',
          frozen_reason: reason.presence || 'Too many failed attempts'
        )
      end
    rescue StandardError => e
      Rails.logger.warn("[Cards::RiskEngine] decline tracking failed message=#{e.message}")
    end

    def self.reset_declines!(card:)
      return if card.blank?

      card.update!(
        decline_count: 0,
        last_declined_at: nil,
        frozen_by: nil,
        frozen_reason: nil
      )
    end
  end
end
