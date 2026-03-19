# frozen_string_literal: true

require 'zlib'

module Api
  module V1
    class FundingController < ApplicationController
      before_action :ensure_anchor_pooled_account_configured!
      before_action :ensure_user_not_restricted_for_funding!, only: %i[create]

      def anchor_pooled_account
        render json: { data: anchor_pooled_account_payload }, status: :ok
      end

      def create
        provider = intent_params[:provider].presence || 'anchor'
        unless provider == 'anchor'
          return render json: { message: 'Unsupported funding provider' }, status: :unprocessable_entity
        end

        expected_amount_cents = normalize_amount_cents(intent_params[:amount_cents])
        return if performed?
        return unless Risk::ControlEnforcer.precheck_inbound_request!(
          controller: self,
          user: current_user,
          amount_cents: expected_amount_cents,
          source_type: 'FundingIntent'
        )

        funding_intent = create_funding_intent!(provider: provider, expected_amount_cents: expected_amount_cents)

        render json: {
          data: serialize_funding_intent(funding_intent)
        }, status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { message: e.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
      rescue ActiveRecord::RecordNotUnique
        render json: { message: 'Could not generate a unique funding reference. Please retry.' }, status: :conflict
      end

      def show
        funding_intent = current_user.funding_intents.find_by(id: params[:id])
        return render json: { message: 'Funding intent not found' }, status: :not_found if funding_intent.blank?

        render json: {
          data: serialize_funding_intent(funding_intent)
        }, status: :ok
      end

      private

      def intent_params
        params.permit(:provider, :amount_cents)
      end

      def ensure_anchor_pooled_account_configured!
        missing_keys = []
        missing_keys << 'ANCHOR_POOLED_BANK' if ENV['ANCHOR_POOLED_BANK'].to_s.strip.blank?
        missing_keys << 'ANCHOR_POOLED_ACCOUNT_NAME' if ENV['ANCHOR_POOLED_ACCOUNT_NAME'].to_s.strip.blank?
        missing_keys << 'ANCHOR_POOLED_ACCOUNT_NUMBER' if ENV['ANCHOR_POOLED_ACCOUNT_NUMBER'].to_s.strip.blank?

        return if missing_keys.empty?

        render json: {
          message: 'Anchor pooled account is not configured',
          missing: missing_keys
        }, status: :service_unavailable
      end

      def normalize_amount_cents(raw_value)
        return nil if raw_value.blank?

        value = Integer(raw_value)
        if value.negative?
          render json: { message: 'amount_cents must be greater than or equal to 0' }, status: :unprocessable_entity
          return nil
        end

        value
      rescue ArgumentError, TypeError
        render json: { message: 'amount_cents must be an integer' }, status: :unprocessable_entity
        nil
      end

      def create_funding_intent!(provider:, expected_amount_cents:)
        attempts = 0

        begin
          reference = generate_reference
          return current_user.funding_intents.create!(
            provider: provider,
            reference: reference,
            expected_amount_cents: expected_amount_cents,
            expires_at: 30.minutes.from_now,
            status: 'pending',
            metadata: {}
          )
        rescue ActiveRecord::RecordNotUnique
          attempts += 1
          retry if attempts < 5
          raise
        end
      end

      def generate_reference
        token = SecureRandom.random_number(36**6).to_s(36).upcase.rjust(6, '0')
        checksum = (Zlib.crc32(token) % (36**4)).to_s(36).upcase.rjust(4, '0')
        "BBG-#{token}-#{checksum}"
      end

      def anchor_pooled_account_payload
        {
          bank_name: ENV['ANCHOR_POOLED_BANK'].to_s.strip,
          account_name: ENV['ANCHOR_POOLED_ACCOUNT_NAME'].to_s.strip,
          account_number: ENV['ANCHOR_POOLED_ACCOUNT_NUMBER'].to_s.strip,
          instructions: 'Transfer using the provided reference for automatic wallet credit.'
        }
      end

      def serialize_funding_intent(funding_intent)
        {
          id: funding_intent.id,
          provider: funding_intent.provider,
          reference: funding_intent.reference,
          expected_amount_cents: funding_intent.expected_amount_cents,
          expires_at: funding_intent.expires_at,
          status: funding_intent.status,
          credited_transaction_id: funding_intent.credited_transaction_id,
          account: anchor_pooled_account_payload
        }
      end

      def ensure_user_not_restricted_for_funding!
        Risk::ControlEnforcer.enforce_unrestricted!(
          controller: self,
          user: current_user,
          message: 'Account is temporarily restricted pending review.'
        )
      end
    end
  end
end
