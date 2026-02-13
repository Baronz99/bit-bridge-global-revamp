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
        card ||= Card.find_by(cardholder_id: cardholder_id) if cardholder_id.present?
        card = resolve_card_for_bridge_event(card: card, data: data)
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
        when 'card_creation_event.successful'
          reconcile_card_from_creation_event(card: card, data: data)
          reconcile_missing_creation_fee_debit(card: card, data: data)
        when 'card_credit_event.successful'
          reconcile_missing_card_funding_debit(card: card, data: data)
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
        update_cardholder_verification_state(card: card, event: event, data: data)

        head :ok
      end

      def monnify
        raw_body = request.raw_post.to_s
        signature = request.headers['monnify-signature'] || request.headers['Monnify-Signature'] || request.headers['MONNIFY-SIGNATURE']
        secret = monnify_webhook_secret

        if secret.blank?
          Rails.logger.error('[MonnifyWebhook] missing webhook signing secret')
          return head :service_unavailable
        end

        unless valid_monnify_signature?(raw_body: raw_body, signature: signature, secret: secret)
          Rails.logger.warn('[MonnifyWebhook] invalid signature')
          return head :unauthorized
        end

        data =
          begin
            JSON.parse(raw_body)
          rescue JSON::ParserError => e
            Rails.logger.warn("[MonnifyWebhook] invalid_json error=#{e.class}")
            return head :ok
          end

        return head :ok unless data['eventType'] == 'SUCCESSFUL_TRANSACTION'

        event_data = data['eventData'] || {}
        return head :ok unless event_data['paymentStatus'].to_s.downcase == 'paid'

        event_name = data['eventType'].to_s
        monnify_event_type =
          event_name.present? ? "monnify.webhook.#{event_name.downcase}" : 'monnify.webhook'

        payment_reference =
          event_data['paymentReference'].presence || event_data.dig('product', 'reference')
        transaction_reference =
          event_data['transactionReference'].presence || data['transactionReference'].presence

        reference = payment_reference.presence || transaction_reference
        if reference.blank?
          Rails.logger.warn('[MonnifyWebhook] missing reference')
          return head :ok
        end

        Rails.logger.info("[MonnifyWebhook] start reference=#{reference} payment_status=#{event_data['paymentStatus']}")

        reference_type = reference.split('-')[0]

        case reference_type
        when 'bbg'
          transaction_record = TransactionRecord.find_by(reference: reference)
          unless transaction_record
            Rails.logger.warn("[MonnifyWebhook] record_not_found reference=#{reference}")
            return Rails.env.production? ? head(:ok) : head(:not_found)
          end

          transaction_record.update(event_type: monnify_event_type) if transaction_record.event_type != monnify_event_type
          handle_bills_confirmation(transaction_record, event_data)
          return head :ok

        when 'fbg'
          transaction_record = TransactionRecord.find_by(reference: reference)
          unless transaction_record
            Rails.logger.warn("[MonnifyWebhook] record_not_found reference=#{reference}")
            return Rails.env.production? ? head(:ok) : head(:not_found)
          end

          transaction_record.update(event_type: monnify_event_type) if transaction_record.event_type != monnify_event_type

          exchange = transaction_record.exchange

          # Treat these as truly terminal for preventing double-credit
          terminal_exchange_statuses = %w[completed success paid failed cancelled reversed expired]

          exchange_status_before = exchange&.status.to_s
          record_status_before = transaction_record.status.to_s

          Rails.logger.info(
            "[MonnifyWebhook] status_before reference=#{reference} record_status=#{record_status_before} exchange_status=#{exchange_status_before}"
          )

          # Try to capture paid amount from webhook payload (if present)
          payment_info = (event_data['paymentSourceInformation'].is_a?(Array) ? event_data['paymentSourceInformation'].first : nil) || {}
          amount_paid = payment_info['amountPaid'] || event_data['amountPaid'] || event_data['amount'] || transaction_record.amount

          # Always finalize the TransactionRecord status for /verify + UI,
          # even if exchange is already approved (your UI polls TransactionRecord).
          updates = {}
          updates[:status] = 'approved' if transaction_record.status.to_s.strip.downcase == 'pending' || transaction_record.status.blank?
          updates[:transaction_id] = (transaction_reference.presence || payment_reference) if transaction_record.transaction_id.blank?
          updates[:amount] = amount_paid if transaction_record.amount.blank? && amount_paid.present?

          if updates.any?
            transaction_record.update(updates)
            Rails.logger.info("[MonnifyWebhook] record_finalized reference=#{reference} updates=#{updates.keys.join(',')}")
          end

          # Now decide whether to credit / confirm exchange.
          # If exchange is already terminal-ish, do NOT re-run confirmation.
          ex_status = exchange_status_before.to_s.downcase
          if exchange.present?
            if terminal_exchange_statuses.include?(ex_status)
              Rails.logger.info("[MonnifyWebhook] exchange_terminal_skip_confirm reference=#{reference} exchange_status=#{exchange_status_before}")
              return head :ok
            end

            # If exchange exists but is 'approved', we still may need confirmation logic depending on your ledger.
            # We keep it safe: confirm only when exchange isn't already approved.
            exchange.update(status: 'approved') if ex_status != 'approved'
          end

          # Only run confirmation when we are not already approved/terminal to avoid double credit.
          unless %w[approved].include?(ex_status)
            handle_payment_confirmation(transaction_record)
            Rails.logger.info("[MonnifyWebhook] confirmation_done reference=#{reference} record_id=#{transaction_record.id}")
          else
            Rails.logger.info("[MonnifyWebhook] exchange_approved_skip_handle_payment_confirmation reference=#{reference}")
          end

          Rails.logger.info(
            "[MonnifyWebhook] status_after reference=#{reference} record_status=#{transaction_record.status} exchange_status=#{exchange&.status}"
          )

          return head :ok
        else
          result = handleTransactionConfirmation(
            event_data,
            reference: reference,
            transaction_reference: transaction_reference,
            event_type: monnify_event_type,
            raw_payload: data
          )
          return head(result) if result.is_a?(Symbol)
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

      def handleTransactionConfirmation(event_data, reference:, transaction_reference: nil, event_type: nil, raw_payload: nil)
        transaction_record = TransactionRecord.find_by(reference: reference)
        if transaction_record&.exchange.present?
          if event_type.present? && transaction_record.event_type != event_type
            transaction_record.update(event_type: event_type)
          end
          Rails.logger.info("[MonnifyWebhook] already_processed reference=#{reference} record_id=#{transaction_record.id}")
          return
        end
        if transaction_record.present?
          if event_type.present? && transaction_record.event_type != event_type
            transaction_record.update(event_type: event_type)
          end
          Rails.logger.info("[MonnifyWebhook] record_exists_without_exchange reference=#{reference} record_id=#{transaction_record.id}")
          return
        end

        # ✅ Avoid logging full webhook payloads / payment details
        user_id = event_data.dig('product', 'reference')
        user = User.find_by(id: user_id)

        unless user
          Rails.logger.error("❌ Monnify webhook: user not found user_id=#{user_id}")
          persist_unmatched_credit!(
            reference: reference,
            transaction_reference: transaction_reference,
            reason: 'user_not_found',
            event_data: event_data,
            raw_payload: raw_payload
          )
          return
        end

        unless user.wallet
          Rails.logger.error("❌ Monnify webhook: wallet not found user_id=#{user.id}")
          persist_unmatched_credit!(
            reference: reference,
            transaction_reference: transaction_reference,
            reason: 'wallet_not_found',
            event_data: event_data,
            raw_payload: raw_payload
          )
          return
        end

        payment_info = event_data.fetch('paymentSourceInformation', []).first || {}
        raw_amount = payment_info['amountPaid']
        currency = event_data['currencyCode'] || event_data['currency'] || 'NGN'
        amount, scale = normalize_monnify_amount(raw_amount, currency)
        parsed_amount =
          begin
            amount.is_a?(BigDecimal) ? amount : BigDecimal(amount.to_s)
          rescue ArgumentError
            nil
          end
        if parsed_amount.nil? || parsed_amount <= 0
          Rails.logger.warn("[MonnifyWebhook] invalid_amount reference=#{reference} raw_amount=#{raw_amount}")
          return :unprocessable_entity
        end

        transaction_params = {
          wallet_id: user.wallet.id,
          amount: parsed_amount,
          address: payment_info['accountNumber'],
          account_name: payment_info['accountName'],
          bank_code: payment_info['bankCode'],
          transaction_type: 'deposit',
          status: 'approved',
          coin_type: 'bank',
          metadata: {
            monnify_amount_raw: raw_amount,
            monnify_amount_scale: scale,
            currency: currency
          }
        }

        transaction_record =
          begin
            TransactionRecord.create!(
              reference: reference,
              status: 'pending',
              transaction_id: transaction_reference.presence || reference,
              event_type: event_type.presence || 'monnify.webhook'
            )
          rescue ActiveRecord::RecordNotUnique
            existing = TransactionRecord.find_by(reference: reference)
            Rails.logger.info("[MonnifyWebhook] race_detected reference=#{reference} record_id=#{existing&.id}")
            return
          end

        transaction = Transaction.new(transaction_params)

        if transaction.save
          transaction_record.update!(
            exchange: transaction,
            status: 'approved',
            description: 'Monnify deposit',
            customer_name: payment_info['accountName'],
            reference: reference,
            account_number: payment_info['accountNumber'],
            bank_code: payment_info['bankCode'],
            bank: payment_info['bankName'],
            amount: parsed_amount
          )
          # ✅ Log only minimal identifiers
          Rails.logger.info("✅ Monnify deposit saved id=#{transaction.id} user_id=#{user.id} amount=#{transaction.amount}")
        else
          Rails.logger.error("❌ Monnify deposit failed user_id=#{user.id} errors=#{transaction.errors.full_messages.to_sentence}")
        end
      end

      def update_cardholder_verification_state(card:, event:, data:)
        return if card.blank?

        state = cardholder_state_from_event(event.to_s)
        return if state.blank?

        meta = card.meta_data.is_a?(Hash) ? card.meta_data.dup : {}
        meta['cardholder_kyc_status'] = state
        meta['cardholder_status_updated_at'] = Time.current.iso8601

        reason = data['message'].presence || data['reason'].presence || data['decline_reason'].presence
        meta['cardholder_kyc_reason'] = reason if reason.present?

        attrs = { meta_data: meta }
        if card.card_id.blank?
          attrs[:status] =
            case state
            when 'verified' then 'pending'
            when 'failed' then 'failed'
            when 'manual_review' then 'manual_review'
            when 'pending_verification' then 'pending_verification'
            end
        end

        card.update!(attrs.compact)
      rescue StandardError => e
        Rails.logger.warn("[BridgecardWebhook] cardholder_state_update_failed message=#{e.message}")
      end

      def cardholder_state_from_event(event_name)
        return nil unless event_name.include?('cardholder')

        normalized = event_name.downcase
        return 'manual_review' if normalized.include?('manual_review')
        return 'verified' if normalized.match?(/(successful|verified|approved)/)
        return 'failed' if normalized.match?(/(failed|rejected|declined)/)
        return 'pending_verification' if normalized.match?(/(pending|processing|initiated)/)

        nil
      end

      def normalize_monnify_amount(amount, currency)
        raw = BigDecimal(amount.to_s)
        scale = ENV['MONNIFY_AMOUNT_SCALE'].to_s.downcase

        if scale.present? && scale != 'naira'
          Rails.logger.warn(
            "[MonnifyWebhook] ignoring_non_naira_scale configured_scale=#{scale.inspect} currency=#{currency}"
          )
        end

        [raw, 'naira']
      rescue ArgumentError
        [amount, 'unknown']
      end

      def handle_bills_confirmation(transaction_record, event_data = {})
        payment_channel =
          event_data['paymentMethod'] ||
          event_data['payment_method'] ||
          event_data['paymentChannel'] ||
          event_data['payment_channel'] ||
          'monnify'
        payment_channel = payment_channel.to_s.strip.downcase
        bill_order = transaction_record.bill_order
        return if bill_order.blank?

        intent = BillPaymentIntent.find_or_create_for_bill_order!(bill_order: bill_order)
        bill_order.update!(
          status: 'failed',
          reason: 'Bills checkout is disabled. Use wallet intent execution.',
          provider_response: (bill_order.provider_response.is_a?(Hash) ? bill_order.provider_response : {}).merge(
            'checkout_blocked' => true,
            'checkout_blocked_channel' => payment_channel,
            'checkout_blocked_at' => Time.current.utc.iso8601,
            'bill_payment_intent_id' => intent.id
          )
        )
        Rails.logger.warn(
          "[MonnifyWebhook] blocked_legacy_bill_checkout bill_order_id=#{bill_order.id} reference=#{transaction_record.reference} intent_id=#{intent.id} channel=#{payment_channel}"
        )
      end

      def valid_monnify_signature?(raw_body:, signature:, secret:)
        return false if raw_body.blank? || signature.blank?

        provided = signature.to_s.strip
        computed = OpenSSL::HMAC.hexdigest('sha512', secret, raw_body)
        return false unless provided.length == computed.length

        ActiveSupport::SecurityUtils.secure_compare(provided.downcase, computed.downcase)
      rescue StandardError
        false
      end

      def monnify_webhook_secret
        ENV['MONNIFY_WEBHOOK_SECRET'].to_s.strip.presence ||
          Rails.configuration.x.monnify_secret_key.to_s.strip.presence
      rescue StandardError
        nil
      end

      def persist_unmatched_credit!(reference:, transaction_reference:, reason:, event_data:, raw_payload:)
        payment_info = (event_data['paymentSourceInformation'].is_a?(Array) ? event_data['paymentSourceInformation'].first : {}) || {}
        raw_amount = payment_info['amountPaid'] || event_data['amountPaid'] || event_data['amount']
        provider_ref = transaction_reference.to_s.presence || reference.to_s

        unmatched = UnmatchedCredit.find_or_initialize_by(provider: 'monnify', provider_reference: provider_ref)
        unmatched.reference = reference.to_s
        unmatched.account_number = payment_info['accountNumber'].to_s.presence
        unmatched.account_name = payment_info['accountName'].to_s.presence
        unmatched.bank_code = payment_info['bankCode'].to_s.presence
        unmatched.bank_name = payment_info['bankName'].to_s.presence
        unmatched.amount = raw_amount.present? ? BigDecimal(raw_amount.to_s) : nil
        unmatched.currency = (event_data['currencyCode'] || event_data['currency'] || 'NGN').to_s
        unmatched.reason = reason
        unmatched.status = 'pending'
        unmatched.payload = raw_payload
        unmatched.save!
      rescue StandardError => e
        Rails.logger.error("[MonnifyWebhook] unmatched_credit_persist_failed reference=#{reference} reason=#{reason} message=#{e.message}")
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

      def resolve_card_for_bridge_event(card:, data:)
        return card if card.present?
        return nil unless data.is_a?(Hash)

        meta = data['meta_data'].is_a?(Hash) ? data['meta_data'] : {}
        local_card_id = meta['local_card_id'].to_s.strip
        user_id = meta['user_id'].to_s.strip
        cardholder_id = data['cardholder_id'].to_s.strip

        return Card.find_by(id: local_card_id) if local_card_id.present?

        if user_id.present?
          scoped = Card.where(user_id: user_id)
          found = scoped.find_by(cardholder_id: cardholder_id) if cardholder_id.present?
          found ||= scoped.order(created_at: :desc).find_by(card_id: nil)
          return found if found.present?
        end

        return Card.find_by(cardholder_id: cardholder_id) if cardholder_id.present?

        nil
      end

      def reconcile_card_from_creation_event(card:, data:)
        return if card.blank? || !data.is_a?(Hash)

        provider_card_id = data['card_id'].to_s.strip
        return if provider_card_id.blank?

        meta = card.meta_data.is_a?(Hash) ? card.meta_data.dup : {}
        meta['bridgecard_last_create_reference'] = data['transaction_reference'] if data['transaction_reference'].present?
        meta['bridgecard_last_create_event_at'] = Time.current.iso8601

        attrs = {
          card_id: provider_card_id,
          cardholder_id: data['cardholder_id'].presence || card.cardholder_id,
          card_currency: data['currency'].presence || card.card_currency,
          status: data['is_active'] == true ? 'active' : card.status,
          meta_data: meta
        }
        attrs[:card_limit] = data['card_limit'] if data['card_limit'].present?
        attrs[:card_type] = data['card_type'] if data['card_type'].present?
        attrs[:card_brand] = data['card_brand'].presence || data['brand'].presence || card.card_brand
        card.update!(attrs.compact)
      rescue StandardError => e
        Rails.logger.warn("[BridgecardWebhook] card_create_reconcile_failed card_id=#{card&.id} message=#{e.message}")
      end

      def reconcile_missing_creation_fee_debit(card:, data:)
        return if card.blank?

        user = card.user
        wallet = user&.usd_wallet
        return if wallet.blank?

        meta = card.meta_data.is_a?(Hash) ? card.meta_data.dup : {}
        return if meta['creation_fee_charged'] == true

        fee_cents = FxSetting.current.card_creation_fee_usd_cents.to_i
        fee_cents = 400 if fee_cents <= 0
        return if fee_cents <= 0
        return if wallet.balance_cents.to_i < fee_cents

        reference_seed = data.is_a?(Hash) ? data['transaction_reference'].to_s : ''
        fee_reference = meta['creation_fee_reference'].presence || "card-fee-reconcile-#{reference_seed.presence || card.id}"
        return if wallet.transactions.exists?(unique_transaction_id: fee_reference)

        ActiveRecord::Base.transaction do
          wallet.transactions.create!(
            transaction_type: 'withdrawal',
            status: 'approved',
            amount: (fee_cents / 100.0).round(2),
            coin_type: 'bank',
            address: 'Virtual Card Creation Fee',
            unique_transaction_id: fee_reference,
            bridge_card_id: card.card_id,
            metadata: { source: 'bridgecard_reconcile' }
          )
          wallet.debit_cents!(fee_cents)
        end

        meta['creation_fee_charged'] = true
        meta['creation_fee_cents'] = fee_cents
        meta['creation_fee_reference'] = fee_reference
        meta['creation_fee_charged_at'] = Time.current
        card.update!(meta_data: meta)
      rescue StandardError => e
        Rails.logger.warn("[BridgecardWebhook] creation_fee_reconcile_failed card_id=#{card&.id} message=#{e.message}")
      end

      def reconcile_missing_card_funding_debit(card:, data:)
        return if card.blank? || !data.is_a?(Hash)

        reference = data['transaction_reference'].to_s.strip
        amount_cents = data['amount'].to_i
        return if reference.blank? || amount_cents <= 0

        wallet = card.user&.usd_wallet
        return if wallet.blank?
        return if wallet.transactions.exists?(unique_transaction_id: reference)
        return if wallet.balance_cents.to_i < amount_cents

        amount_usd = (amount_cents / 100.0).round(2)
        ActiveRecord::Base.transaction do
          wallet.transactions.create!(
            transaction_type: 'withdrawal',
            status: 'approved',
            amount: amount_usd,
            coin_type: 'bank',
            address: 'Virtual Card Funding (USD)',
            unique_transaction_id: reference,
            bridge_card_id: card.card_id,
            metadata: { source: 'bridgecard_reconcile' }
          )
          wallet.debit_cents!(amount_cents)
        end
      rescue StandardError => e
        Rails.logger.warn("[BridgecardWebhook] funding_reconcile_failed card_id=#{card&.id} reference=#{reference} message=#{e.message}")
      end
    end
  end
end
