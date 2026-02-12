# frozen_string_literal: true

module Cards
  module Ledger
    class PostCardSettlement
      def self.call(card:, card_event:)
        new(card: card, card_event: card_event).call
      end

      def initialize(card:, card_event:)
        @card = card
        @card_event = card_event
      end

      def call
        return failure('card_missing') if @card.blank?
        return failure('card_event_missing') if @card_event.blank?

        provider_reference = @card_event.provider_transaction_reference.presence || @card_event.transaction_reference.presence
        provider_reference ||= "card-event-#{@card_event.id}"

        unique_ids = {
          principal: "#{provider_reference}:principal",
          provider_fee: "#{provider_reference}:provider_fee",
          bitbridge_fee: "#{provider_reference}:bitbridge_fee",
          fx_markup: "#{provider_reference}:fx_markup"
        }

        existing = Transaction.where(unique_transaction_id: unique_ids.values)
        if existing.exists?
          if existing.count == unique_ids.size
            mark_ledger_posted(provider_reference)
            return success('already_posted', provider_reference)
          end

          Rails.logger.warn("[PostCardSettlement] partial ledger exists reference=#{provider_reference}")
          return success('already_posted_partial', provider_reference)
        end

        quote = Pricing::CardPricing.quote(extract_pricing_payload(@card_event.raw_payload))
        principal_usd = quote[:principal_usd]
        total_debit_usd = quote[:total_debit_usd]

        wallet = @card.user&.usd_wallet
        return failure('usd_wallet_missing') if wallet.blank?

        required_cents = wallet.money_to_cents(total_debit_usd)
        if wallet.balance_cents.to_i < required_cents
          mark_declined!(provider_reference, quote)
          Cards::RiskEngine.record_decline!(
            card: @card,
            reason: 'Insufficient USD balance to cover purchase + fees',
            provider_reference: provider_reference
          )
          return failure('insufficient_balance', provider_reference, quote)
        end

        ActiveRecord::Base.transaction do
          create_withdrawal!(
            wallet,
            principal_usd,
            unique_ids[:principal],
            'Card purchase',
            provider_reference,
            subtype: 'principal',
            metadata: {
              fee_breakdown: {
                principal_usd: quote[:principal_usd]&.to_f,
                provider_fee_usd: quote[:provider_fee_usd]&.to_f,
                bitbridge_fee_usd: quote[:bitbridge_fee_usd]&.to_f,
                fx_markup_usd: quote[:fx_markup_usd]&.to_f,
                total_debit_usd: quote[:total_debit_usd]&.to_f
              }
            }
          )
          create_withdrawal!(
            wallet,
            quote[:provider_fee_usd],
            unique_ids[:provider_fee],
            'Card provider fee',
            provider_reference,
            subtype: 'provider_fee'
          )

          if quote[:bitbridge_fee_usd].to_d.positive?
            create_withdrawal!(
              wallet,
              quote[:bitbridge_fee_usd],
              unique_ids[:bitbridge_fee],
              'Card BitBridge fee',
              provider_reference,
              subtype: 'bitbridge_fee'
            )
          end

          if quote[:fx_markup_usd].to_d.positive?
            create_withdrawal!(
              wallet,
              quote[:fx_markup_usd],
              unique_ids[:fx_markup],
              'Card FX markup',
              provider_reference,
              subtype: 'fx_markup'
            )
          end

          wallet.debit_cents!(required_cents)
          mark_ledger_posted(provider_reference, quote)
        end

        success('posted', provider_reference, quote)
      rescue StandardError => e
        Rails.logger.warn("[PostCardSettlement] failed message=#{e.message}")
        failure('posting_failed', nil, nil, e.message)
      end

      private

      def create_withdrawal!(wallet, amount, unique_id, address, provider_reference, subtype:, metadata: {})
        return if amount.to_d <= 0

        wallet.transactions.create!(
          transaction_type: 'withdrawal',
          status: 'approved',
          amount: amount,
          coin_type: 'bank',
          address: address,
          unique_transaction_id: unique_id,
          bridge_card_id: @card.card_id,
          metadata: {
            transfer_reference: provider_reference,
            subtype: subtype
          }.merge(metadata)
        )
      end

      def mark_declined!(provider_reference, quote)
        metadata = @card_event.metadata.is_a?(Hash) ? @card_event.metadata.dup : {}
        metadata['decline_reason'] = 'insufficient_balance'
        metadata['principal_usd'] = quote[:principal_usd]&.to_f
        metadata['provider_fee_usd'] = quote[:provider_fee_usd]&.to_f
        metadata['bitbridge_fee_usd'] = quote[:bitbridge_fee_usd]&.to_f
        metadata['fx_markup_usd'] = quote[:fx_markup_usd]&.to_f
        metadata['total_debit_usd'] = quote[:total_debit_usd]&.to_f
        metadata['provider_fee_rule'] = quote[:provider_fee_rule]
        metadata['bitbridge_fee_rule'] = quote[:bitbridge_fee_rule]

        @card_event.update!(
          status: 'declined',
          event_status: 'declined',
          metadata: metadata
        )
      end

      def mark_ledger_posted(provider_reference, quote = nil)
        metadata = @card_event.metadata.is_a?(Hash) ? @card_event.metadata.dup : {}
        metadata['ledger_posted'] = true
        metadata['provider_reference'] = provider_reference

        if quote
          metadata['principal_usd'] = quote[:principal_usd]&.to_f
          metadata['provider_fee_usd'] = quote[:provider_fee_usd]&.to_f
          metadata['bitbridge_fee_usd'] = quote[:bitbridge_fee_usd]&.to_f
          metadata['fx_markup_usd'] = quote[:fx_markup_usd]&.to_f
          metadata['total_debit_usd'] = quote[:total_debit_usd]&.to_f
          metadata['provider_fee_rule'] = quote[:provider_fee_rule]
          metadata['bitbridge_fee_rule'] = quote[:bitbridge_fee_rule]
        end

        @card_event.update!(metadata: metadata)
      end

      def extract_pricing_payload(raw_payload)
        return {} unless raw_payload.is_a?(Hash)
        return raw_payload['data'] if raw_payload['data'].is_a?(Hash)

        raw_payload
      end

      def success(status, provider_reference, quote = nil)
        { status: :ok, code: status, provider_reference: provider_reference, quote: quote }
      end

      def failure(code, provider_reference = nil, quote = nil, message = nil)
        { status: :error, code: code, provider_reference: provider_reference, quote: quote, message: message }
      end
    end
  end
end
