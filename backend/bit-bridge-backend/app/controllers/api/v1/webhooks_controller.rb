# frozen_string_literal: true

require 'openssl'
require 'base64'
require 'digest'

module Api
  module V1
    class WebhooksController < ApplicationController
      skip_before_action :authenticate_user!

      def bridgecard
        unless FeatureFlags.bridge_cards?
          raise StandardError, 'BRIDGE cards are disabled'
        end

        raw_body = request.raw_post
        signature = request.headers['x-webhook-signature'] || request.headers['X-Webhook-Signature']

        secrets = Bridgecard::Config.webhook_secrets

        verifier = BridgecardWebhookVerifier.new(
          body: raw_body,
          signature: signature,
          secrets: secrets
        )

        unless verifier.valid?
          Rails.logger.warn('[BridgecardWebhook] invalid signature')
          return head :unauthorized
        end

        payload = JSON.parse(raw_body) rescue {}
        event = payload['event'].to_s
        data = payload['data'] || {}

        card_id = data['card_id'].to_s
        cardholder_id = data['cardholder_id'].to_s
        transaction_reference = data['transaction_reference'].to_s

        card = card_id.present? ? Card.find_by(card_id: card_id) : nil
        user_id = card&.user_id

        card_event = CardEvent.upsert_bridgecard_event!(
          event_name: event,
          data: data,
          raw_payload: payload,
          card: card,
          user_id: user_id
        )

        case event
        when 'card_unload_event.successful'
          handle_card_unload_success(data)
        when 'card_unload_event.failed'
          handle_card_unload_failed(data)
        when 'card_debit_event.successful'
          begin
            Cards::Ledger::PostCardSettlement.call(card: card, card_event: card_event)
          rescue StandardError => e
            Rails.logger.warn("[BridgecardWebhook] settlement failed message=#{e.message}")
          end
          begin
            Bridgecard::EnrichTransactionJob.perform_later(card_event.id) if card_event&.id
          rescue StandardError => e
            Rails.logger.warn("[BridgecardWebhook] enrichment enqueue failed message=#{e.message}")
          end
        when 'card_debit_event.failed', 'card_debit_event.declined'
          Cards::RiskEngine.record_decline!(
            card: card,
            reason: data['decline_reason'] || data['reason'] || 'Card declined',
            provider_reference: card_event&.provider_transaction_reference || transaction_reference
          )
        when 'card_credit_event.successful', 'card_credit_event.failed'
          # stored via CardEvent upsert
        end

        head :ok
      end

      def monnify
        data = JSON.parse(request.raw_post)
        # Rails.logger.info("✅  Monnify webhook json post: #{data}")


        return unless data['eventType'] == 'SUCCESSFUL_TRANSACTION'

        event_data = data['eventData']
        transaction_reference = data['eventData']['product']['reference']
        transaction_record = TransactionRecord.find_by(reference: transaction_reference)

        reference_type = transaction_reference.split('-')[0]

        Rails.logger.info("✅  Monnify webhook reference post: #{transaction_reference}")


        case reference_type

        when 'bbg'
          handle_bills_confirmation(transaction_record)
        when 'fbg'
          handle_payment_confirmation(transaction_record)
        else
          handleTransactionConfirmation(event_data)
          # Rails.logger.warn("Unknown refernce type: #{reference_type}")
        end

        head :ok
      end
      def anchor
        raw_body = request.body.read.to_s
        request.body.rewind
        signature = request.headers['x-anchor-signature'] || request.headers['X-Anchor-Signature']
        secret = ENV['ANCHOR_WEBHOOK_SECRET'].to_s.strip

        if secret.blank?
          Rails.logger.warn('[AnchorWebhook] missing ANCHOR_WEBHOOK_SECRET')
          return render json: { message: 'Webhook not configured' }, status: :service_unavailable
        end

        if allow_unsigned_anchor_webhooks?
          Rails.logger.warn('[AnchorWebhook] unsigned webhooks allowed in development')
        elsif !valid_anchor_signature?(raw_body, signature, secret)
          payload_hash = Digest::SHA256.hexdigest(raw_body)[0, 12]
          sig_hint = signature.to_s[0, 8]
          hex_digest = OpenSSL::HMAC.hexdigest('sha1', secret, raw_body)
          raw_digest = OpenSSL::HMAC.digest('sha1', secret, raw_body)
          computed_hex = Base64.strict_encode64(hex_digest)[0, 8]
          computed_raw = Base64.strict_encode64(raw_digest)[0, 8]
          Rails.logger.warn(
            "[AnchorWebhook] invalid signature payload_sha=#{payload_hash} sig_prefix=#{sig_hint} " \
            "computed_hex_prefix=#{computed_hex} computed_raw_prefix=#{computed_raw}"
          )
          return head :unauthorized
        end

        payload = JSON.parse(raw_body) rescue nil
        return render json: { message: 'Invalid payload' }, status: :bad_request if payload.blank?

        AnchorWebhookJob.perform_later(payload, raw_body)
        head :ok
      end
      private

      def handleKycVerificatiion(account_id)
        account = Account.find_by(account_id: account_id)
        account.update(status: 'verified')
      end

      def valid_anchor_signature?(raw_body, signature, secret)
        return false if signature.blank? || raw_body.blank?

        provided = signature.to_s.strip
        provided = provided.sub(/\Asha1=/i, '').sub(/\Av1=/i, '')

        hex_digest = OpenSSL::HMAC.hexdigest('sha1', secret, raw_body)
        raw_digest = OpenSSL::HMAC.digest('sha1', secret, raw_body)
        computed_hex = Base64.strict_encode64(hex_digest)
        computed_raw = Base64.strict_encode64(raw_digest)

        candidates = [
          computed_hex,
          computed_raw,
          hex_digest,
          hex_digest.upcase
        ].uniq

        provided_no_pad = provided.delete('=')

        candidates.any? do |candidate|
          if candidate.length == provided.length
            ActiveSupport::SecurityUtils.secure_compare(candidate, provided)
          elsif candidate.delete('=').length == provided_no_pad.length
            ActiveSupport::SecurityUtils.secure_compare(candidate.delete('='), provided_no_pad)
          else
            false
          end
        end
      rescue StandardError
        false
      end

      def allow_unsigned_anchor_webhooks?
        return false unless Rails.env.development?

        ENV['ALLOW_ANCHOR_UNSIGNED_WEBHOOKS'].to_s == 'true'
      end

      def handleTransactionConfirmation(event_data)
  # ✅ Avoid logging full webhook payloads / payment details
  user_id = event_data.dig('product', 'reference')
  user = User.find_by(id: user_id)

  unless user
    Rails.logger.error("❌ Monnify webhook: user not found user_id=#{user_id}")
    return
  end

  unless user.wallet
    Rails.logger.error("❌ Monnify webhook: wallet not found user_id=#{user.id}")
    return
  end

  payment_info = event_data.fetch('paymentSourceInformation', []).first || {}

  transaction_params = {
    wallet_id: user.wallet.id,
    amount: payment_info['amountPaid'],
    address: payment_info['accountNumber'],
    account_name: payment_info['accountName'],
    bank_code: payment_info['bankCode'],
    transaction_type: 'deposit',
    status: 'approved',
    coin_type: 'bank'
  }

  transaction = Transaction.new(transaction_params)

  if transaction.save
    # ✅ Log only minimal identifiers
    Rails.logger.info("✅ Monnify deposit saved id=#{transaction.id} user_id=#{user.id} amount=#{transaction.amount}")
  else
    Rails.logger.error("❌ Monnify deposit failed user_id=#{user.id} errors=#{transaction.errors.full_messages.to_sentence}")
  end
end


      def handle_bills_confirmation(transaction_record)
        payment_method = 'card'
        bill_order = transaction_record.bill_order
        payment_service = BuyPowerPaymentService.new
        payment_service.confirm_subscription(bill_order, payment_method)

        #  if service_response[:status] == "success"
        #   render json: {data: service_response[:response]}, status: :ok
        #   else
        #     render json: {message: service_response[:response]}, status: :ok

        #   end
      end

      def handle_payment_confirmation(transaction_record)
        transaction = transaction_record.exchange
        transaction.update(status: 'approved')
      end

      def handle_card_unload_success(data)
        reference = data['transaction_reference'].to_s
        return if reference.blank?

        txn = Transaction.find_by(unique_transaction_id: reference)
        return if txn.blank?
        return if txn.status == 'approved'

        amount_cents = data['amount'].to_i
        amount_usd =
          if amount_cents.positive?
            (amount_cents / 100.0).round(2)
          else
            txn.amount.to_f
          end
        result = Cards::UnloadFeeApplier.call(transaction: txn, amount_cents: amount_cents)
        if result[:status] != :ok
          Rails.logger.warn("[BridgecardWebhook] unload fee apply failed reference=#{reference} message=#{result[:message]}")
        end
      end

      def handle_card_unload_failed(data)
        reference = data['transaction_reference'].to_s
        return if reference.blank?

        txn = Transaction.find_by(unique_transaction_id: reference)
        return if txn.blank?
        return if txn.status == 'failed'

        txn.update!(status: 'failed')
      end
    end
  end
end
