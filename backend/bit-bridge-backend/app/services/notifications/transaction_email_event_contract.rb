# frozen_string_literal: true

module Notifications
  class TransactionEmailEventContract
    SCHEMA_VERSION = 'v1'.freeze

    def self.build(transaction:, anchor_details:, fx_quote:)
      new(transaction: transaction, anchor_details: anchor_details, fx_quote: fx_quote).build
    end

    def initialize(transaction:, anchor_details:, fx_quote:)
      @transaction = transaction
      @anchor_details = anchor_details || {}
      @fx_quote = fx_quote
      @metadata = transaction.metadata.is_a?(Hash) ? transaction.metadata : {}
      @record = transaction.transaction_record
    end

    def build
      base = base_payload
      profile = profile_payload

      base.merge(profile)
    end

    private

    def base_payload
      {
        schema_version: SCHEMA_VERSION,
        event_family: event_family,
        event_phase: event_phase,
        direction: direction,
        provider: provider_name,
        provider_event_id: provider_event_id,
        provider_reference: provider_reference
      }
    end

    def profile_payload
      case event_family
      when 'conversion'
        direction_label =
          case @fx_quote&.direction.to_s
          when 'ngn_to_usd' then 'NGN to USD'
          when 'usd_to_ngn' then 'USD to NGN'
          else 'Wallet Conversion'
          end
        {
          kind_label: 'FX Conversion',
          title: 'Conversion Receipt',
          header: 'Conversion Completed',
          subheader: "#{direction_label} conversion settled successfully."
        }
      when 'inbound_transfer'
        sender = @anchor_details[:sender_name].presence || 'bank transfer'
        {
          kind_label: 'Inbound Bank Transfer',
          title: 'Inbound Transfer Receipt',
          header: 'Inbound Transfer Settled',
          subheader: "Funds received from #{sender}."
        }
      when 'outbound_transfer'
        {
          kind_label: 'Outbound Bank Transfer',
          title: 'Outbound Transfer Receipt',
          header: 'Outbound Transfer Completed',
          subheader: 'Your transfer has been processed successfully.'
        }
      when 'wallet_funding'
        {
          kind_label: 'Wallet Funding',
          title: 'Wallet Funding Receipt',
          header: 'Wallet Funding Completed',
          subheader: 'Your checkout payment has been posted to your wallet.'
        }
      when 'wallet_credit'
        {
          kind_label: 'Wallet Credit',
          title: 'Wallet Credit Receipt',
          header: 'Wallet Credit Posted',
          subheader: 'Funds were added to your wallet successfully.'
        }
      else
        {
          kind_label: 'Wallet Debit',
          title: 'Wallet Debit Receipt',
          header: 'Wallet Debit Posted',
          subheader: 'Funds were debited from your wallet successfully.'
        }
      end
    end

    def event_family
      return 'conversion' if @transaction.conversion_transaction?
      return 'inbound_transfer' if provider_name == 'anchor' && @transaction.deposit?
      if provider_name == 'anchor' && @transaction.transaction_type.to_s == 'withdrawal' &&
          @metadata['subtype'].to_s == 'principal'
        return 'outbound_transfer'
      end
      return 'wallet_funding' if @transaction.deposit? && @record&.event_type.to_s.downcase.start_with?('checkout')
      return 'wallet_credit' if @transaction.deposit?

      'wallet_debit'
    end

    def event_phase
      case @transaction.status.to_s
      when 'approved'
        'settled'
      when 'pending', 'initialized'
        'pending'
      when 'failed', 'declined'
        'failed'
      else
        @transaction.status.to_s
      end
    end

    def direction
      @transaction.deposit? ? 'credit' : 'debit'
    end

    def provider_name
      explicit = @metadata['provider'].to_s.downcase
      return explicit if explicit.present?
      return 'checkout' if @record&.event_type.to_s.downcase.start_with?('checkout')

      'internal'
    end

    def provider_event_id
      return @anchor_details[:payment_id] if provider_name == 'anchor' && @anchor_details[:payment_id].present?

      @transaction.transfer_id.presence
    end

    def provider_reference
      return @anchor_details[:payment_reference] if provider_name == 'anchor' && @anchor_details[:payment_reference].present?

      @record&.reference.presence || @metadata['transfer_reference'].presence || @transaction.transfer_id.presence
    end
  end
end
