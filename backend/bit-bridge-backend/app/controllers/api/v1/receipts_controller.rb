# frozen_string_literal: true

module Api
  module V1
    class ReceiptsController < ApplicationController
      before_action :authenticate_user!

      # GET /api/v1/receipts/:id
      # Accepts:
      # - fbg-123 / bbg-123 (TransactionRecord.reference)
      # - wallet-tx-<uuid>
      # - bill-<uuid>
      # - card-evt-<uuid>
      # - circle-tx-<uuid>
      # - txn-<uuid> (Transaction id alias)
      # - raw provider references (transfer refs, etc)
      def show
        reference =
          params[:reference].presence ||
          params[:id].presence

        reference = reference.to_s.strip
        return render json: { message: 'Receipt reference is required.' }, status: :bad_request if reference.blank?

        receipt = resolve_receipt(reference)
        return render json: { message: 'Receipt not found.' }, status: :not_found if receipt.nil?

        render json: { message: 'ok', data: receipt }, status: :ok
      end

      private

      # ----------------------------
      # Main resolver
      # ----------------------------
      def resolve_receipt(reference)
        ref = reference.to_s.strip

        # 1) normalize timeline ids -> canonical reference or underlying model
        if ref.start_with?('wallet-tx-')
          tx_id = ref.delete_prefix('wallet-tx-')
          tx = owned_wallet_transactions.find_by(id: tx_id)
          return nil unless tx

          # Virtual card funding promotion (only if deterministic match found)
          if funding_candidate?(tx)
            card_evt = find_card_event_for_tx(tx)
            return receipt_from_card_funding(tx, card_evt, original_reference: ref) if card_evt
          end

          # Prefer canonical transaction_record reference if present
          tr = tx.transaction_record
          return receipt_from_transaction_record(tr, original_reference: ref) if tr&.reference.present?

          return receipt_from_transaction(tx, original_reference: ref)
        end

        if ref.start_with?('bill-')
          order_id = ref.delete_prefix('bill-')
          order = current_user.bill_orders.find_by(id: order_id)
          return nil unless order

          tr = order.transaction_record
          return receipt_from_transaction_record(tr, original_reference: ref) if tr&.reference.present?

          return receipt_from_bill_order(order, original_reference: ref)
        end

        if ref.start_with?('card-evt-')
          evt_id = ref.delete_prefix('card-evt-')
          evt = resolve_card_event_by_id(evt_id)
          return nil unless evt
          return receipt_from_card_event(evt, original_reference: ref)
        end

        if ref.start_with?('circle-tx-')
          # circles don't necessarily have a canonical receipt, so return a safe "circle receipt"
          tx_id = ref.delete_prefix('circle-tx-')
          ctx = resolve_circle_tx_by_id(tx_id)
          return nil unless ctx
          return receipt_from_circle_transaction(ctx, original_reference: ref)
        end

        # 2) canonical TransactionRecord reference (fbg-/bbg-)
        if transaction_record_reference?(ref)
          record = TransactionRecord.find_by(reference: ref)
          return nil unless record
          return nil unless transaction_record_owned_by_current_user?(record)
          return receipt_from_transaction_record(record, original_reference: ref)
        end

        # 3) txn-<uuid> alias to transaction id
        if ref.start_with?('txn-')
          tx = owned_wallet_transactions.find_by(id: normalize_reference_id(ref))
          return tx ? receipt_from_transaction(tx, original_reference: ref) : nil
        end

        # 4) wallet transaction by transfer id / metadata transfer_reference
        tx = resolve_transaction(ref)
        return receipt_from_transaction(tx, original_reference: ref) if tx

        # 5) card event by provider reference etc
        evt = resolve_card_event(ref)
        return receipt_from_card_event(evt, original_reference: ref) if evt

        # 6) bill order by id or mapped transaction_record
        order = resolve_bill_order(ref)
        return receipt_from_bill_order(order, original_reference: ref) if order

        nil
      end

      # ----------------------------
      # Owned scopes (security)
      # ----------------------------
      def owned_wallet_transactions
        Transaction
          .joins(:wallet)
          .includes(:wallet, :transaction_record)
          .where(wallets: { user_id: current_user.id })
      end

      # ----------------------------
      # Resolvers
      # ----------------------------
      def resolve_transaction(reference)
        owned_wallet_transactions.find_by(transfer_id: reference) ||
          owned_wallet_transactions.where("metadata ->> 'transfer_reference' = ?", reference).first
      end

      def resolve_card_event_by_id(id)
        card_ids = current_user.cards.pluck(:card_id)
        return nil if card_ids.empty?

        CardEvent.where(card_id: card_ids).find_by(id: id)
      end

      def resolve_card_event(reference)
        card_ids = current_user.cards.pluck(:card_id)
        return nil if card_ids.empty?

        if reference.start_with?('evt-')
          return CardEvent.where(card_id: card_ids).find_by(id: normalize_reference_id(reference))
        end

        CardEvent.where(card_id: card_ids).find_by(provider_transaction_reference: reference) ||
          CardEvent.where(card_id: card_ids).find_by(id: reference)
      end

      def resolve_bill_order(reference)
        # direct id
        bill_order = current_user.bill_orders.find_by(id: reference)
        return bill_order if bill_order

        # bill-<uuid>
        if reference.start_with?('bill-')
          return current_user.bill_orders.find_by(id: normalize_reference_id(reference))
        end

        # map via transaction record
        if transaction_record_reference?(reference)
          record = TransactionRecord.find_by(reference: reference)
          return nil unless record&.bill_order
          return nil unless record.bill_order.user_id == current_user.id

          return record.bill_order
        end

        nil
      end

      def resolve_circle_tx_by_id(id)
        # only allow circle tx inside user's circles
        CircleTransaction
          .includes(:circle, :user)
          .where(circle_id: current_user.circles.select(:id))
          .find_by(id: id)
      end

      # ----------------------------
      # Deterministic funding linkage (no guessing)
      # ----------------------------
      def funding_candidate?(txn)
        meta = txn.metadata.is_a?(Hash) ? txn.metadata : {}
        subtype = meta['subtype'].to_s.downcase
        txn_type = txn.transaction_type.to_s.downcase
        bridge_card_id = txn.bridge_card_id

        return true if subtype.include?('card_fund') || subtype.include?('virtual_card_funding')
        return true if bridge_card_id.present? && txn_type.include?('with')
        false
      end

      def find_card_event_for_tx(txn)
        return nil unless defined?(CardEvent)
        meta = txn.metadata.is_a?(Hash) ? txn.metadata : {}

        bridge_card_id = txn.bridge_card_id.presence
        explicit_evt_id = meta['card_event_id'] || meta['card_event_uuid']

        join_keys = [
          txn.unique_transaction_id,
          meta['unique_transaction_id'],
          meta['transfer_reference'],
          meta['provider_transaction_reference'],
          meta['provider_reference'],
          txn.transfer_id
        ].compact.uniq

        card_ids = current_user.cards.pluck(:card_id)
        return nil if card_ids.empty?

        scope = CardEvent.where(card_id: card_ids)
        scope = scope.where(card_id: bridge_card_id) if bridge_card_id.present?

        if explicit_evt_id.present?
          evt = scope.find_by(id: explicit_evt_id)
          return evt if evt
        end

        join_keys.each do |key|
          evt = scope.find_by(provider_transaction_reference: key)
          return evt if evt
        end

        nil
      rescue StandardError
        nil
      end

      # ----------------------------
      # Receipt builders
      # ----------------------------
      def receipt_from_transaction(txn, original_reference:)
        metadata = txn.metadata.is_a?(Hash) ? txn.metadata : {}
        record = txn.transaction_record
        anchor_details = extract_anchor_receipt_details(metadata, record)
        currency = txn.currency || txn.wallet&.currency || 'NGN'
        transfer_fee_context = inferred_transfer_fee_context(txn: txn, currency: currency)
        base_amount = txn.amount.to_d
        amount = transfer_fee_context[:applies] ? (base_amount + transfer_fee_context[:total_fee]).to_f : txn.amount
        fx_quote = resolve_fx_quote_for_receipt(metadata)
        conversion_meta = build_conversion_meta(txn, metadata, fx_quote)
        incoming_transfer_context = incoming_transfer_receipt_context(
          txn: txn,
          metadata: metadata,
          record: record,
          anchor_details: anchor_details,
          conversion_meta: conversion_meta
        )
        outgoing_transfer_context = outgoing_transfer_receipt_context(
          txn: txn,
          metadata: metadata,
          record: record,
          anchor_details: anchor_details,
          conversion_meta: conversion_meta
        )
        title =
          if incoming_transfer_context.present?
            'Incoming bank transfer'
          elsif outgoing_transfer_context.present?
            'Bank transfer'
          else
            wallet_label(txn, record)
          end
        subtitle =
          if incoming_transfer_context.present?
            'Funds received into your wallet'
          elsif outgoing_transfer_context.present?
            outgoing_transfer_subtitle(
              status: txn.status,
              lifecycle_state: transaction_lifecycle_state_for_receipt(txn: txn, metadata: metadata)
            )
          else
            metadata['description'] || anchor_details[:narration] || txn.address
          end
        balance_snapshot = resolve_wallet_balance_snapshot(txn, metadata)
        conversion_fees = conversion_fee_array(currency, fx_quote)
        merged_fees = merge_fee_arrays(
          fee_array(metadata['fee_breakdown'], currency),
          conversion_fees
        )
        merged_fees = merge_fee_arrays(merged_fees, transfer_fee_context[:fees])

        legacy = {
          reference: "wallet-tx-#{txn.id}",
          type: 'wallet',
          source: metadata['subtype'] || txn.transaction_type,
          status: txn.status,
          amount: amount,
          currency: currency,
          description: metadata['description'] || txn.address,
          created_at: txn.created_at,
          transfer_reference: metadata['transfer_reference'],
          provider: metadata['provider'],
          breakdown: metadata['fee_breakdown'],
          meta: {
            transaction_record_reference: record&.reference,
            unique_transaction_id: txn.unique_transaction_id,
            bridge_card_id: txn.bridge_card_id,
            anchor: anchor_details,
            balance_snapshot: balance_snapshot,
            conversion: conversion_meta,
            transfer_fee_inferred: transfer_fee_context[:applies]
          }.compact
        }.compact

        build_dto(
          reference: record&.reference.presence || original_reference || "wallet-tx-#{txn.id}",
          kind: 'wallet',
          event: metadata['subtype'] || txn.transaction_type || 'wallet_transaction',
          status: txn.status || 'pending',
          amount: amount,
          currency: currency,
          occurred_at: txn.created_at,
          title: title,
          subtitle: subtitle,
          parties: {
            from: txn.address,
            wallet_type: txn.wallet&.wallet_type,
            wallet_currency: currency,
            account_name: record&.customer_name,
            account_number: record&.account_number,
            sender_name: anchor_details[:sender_name],
            sender_account_number: anchor_details[:sender_account_number],
            sender_bank_name: anchor_details[:sender_bank_name],
            beneficiary_name: outgoing_transfer_context.dig(:outgoing_transfer, :beneficiary_name),
            beneficiary_bank_name: outgoing_transfer_context.dig(:outgoing_transfer, :beneficiary_bank_name),
            beneficiary_account_number: anchor_details[:beneficiary_account_number],
            beneficiary_account_name: anchor_details[:beneficiary_account_name]
          }.compact,
          provider: {
            name: incoming_transfer_context.dig(:incoming_transfer, :provider_name) || metadata['provider'],
            reference: anchor_details[:payment_reference] || metadata['transfer_reference'] || record&.reference,
            payment_id: anchor_details[:payment_id],
            settlement_account_id: anchor_details[:settlement_account_id]
          }.compact,
          meta: {
            transaction_record_reference: record&.reference,
            transaction_direction: receipt_transaction_direction(incoming_transfer_context, outgoing_transfer_context),
            receipt_category: receipt_category(incoming_transfer_context, outgoing_transfer_context),
            unique_transaction_id: txn.unique_transaction_id,
            bridge_card_id: txn.bridge_card_id,
            anchor: anchor_details,
            balance_snapshot: balance_snapshot,
            beneficiary: outgoing_transfer_context.dig(:outgoing_transfer, :beneficiary_name),
            bankName: outgoing_transfer_context.dig(:outgoing_transfer, :beneficiary_bank_name),
            accountNumber: outgoing_transfer_context.dig(:outgoing_transfer, :beneficiary_account_number),
            transfer_fee_inferred: transfer_fee_context[:applies]
          }.merge(conversion_meta).merge(incoming_transfer_context).merge(outgoing_transfer_context).compact,
          timeline: build_wallet_timeline(txn, record, fx_quote),
          fees: merged_fees,
          legacy: legacy,
          value_amount: transfer_fee_context[:applies] ? base_amount.to_f : nil,
          total_display: transfer_fee_context[:applies] ? amount : nil
        )
      end

      def resolve_fx_quote_for_receipt(metadata)
        token = metadata['fx_quote_token'].to_s.strip
        return nil if token.blank?

        FxQuote.find_by(user_id: current_user.id, token: token)
      rescue StandardError
        nil
      end

      def conversion_direction_from_address(address)
        normalized = address.to_s.upcase
        return 'ngn_to_usd' if normalized.include?('(NGN -> USD)') || normalized.include?('(NGN TO USD)')
        return 'usd_to_ngn' if normalized.include?('(USD -> NGN)') || normalized.include?('(USD TO NGN)')

        ''
      end

      def build_conversion_meta(txn, metadata, fx_quote)
        direction = fx_quote&.direction.presence || conversion_direction_from_address(txn.address)
        return {} if direction.blank? && metadata['fx_execution_reference'].to_s.strip.blank?

        fx_payload =
          if fx_quote
            {
              quote_token: fx_quote.token,
              direction: fx_quote.direction,
              from: fx_quote.direction == 'ngn_to_usd' ? 'NGN' : 'USD',
              to: fx_quote.direction == 'ngn_to_usd' ? 'USD' : 'NGN',
              amount_in: fx_quote.amount_in&.to_f,
              fee_amount: fx_quote.fee_amount&.to_f,
              fee_currency: fx_quote.fee_currency,
              amount_after_fee: fx_quote.amount_after_fee&.to_f,
              execution_rate: fx_quote.execution_rate&.to_f,
              amount_out: fx_quote.amount_out&.to_f,
              executed_at: fx_quote.executed_at&.iso8601,
              expires_at: fx_quote.expires_at&.iso8601
            }.compact
          else
            {}
          end

        {
          conversion: true,
          conversion_direction: direction,
          fx_quote_token: metadata['fx_quote_token'],
          fx_execution_reference: metadata['fx_execution_reference'],
          fx: fx_payload
        }.compact
      end

      def conversion_fee_array(currency, fx_quote)
        return [] unless fx_quote
        return [] unless fx_quote.fee_amount.to_d.positive?
        return [] unless fx_quote.fee_currency.to_s.upcase == currency.to_s.upcase

        [{
          label: 'conversion fee',
          amount: fx_quote.fee_amount,
          currency: fx_quote.fee_currency
        }]
      end

      def merge_fee_arrays(primary_fees, fallback_fees)
        existing = Array(primary_fees).compact
        additions = Array(fallback_fees).compact
        normalize_fee_entries(existing + additions)
      end

      def receipt_from_card_funding(txn, card_event, original_reference:)
        metadata = txn.metadata.is_a?(Hash) ? txn.metadata : {}
        currency = card_event.currency || txn.currency || txn.wallet&.currency || 'USD'
        reference = card_event.provider_transaction_reference || original_reference || "wallet-tx-#{txn.id}"
        amount = normalize_card_event_amount(card_event) || txn.amount

        legacy = receipt_from_transaction(txn, original_reference: original_reference)

        build_dto(
          reference: reference,
          kind: 'wallet',
          event: 'virtual_card_funding',
          status: txn.status || card_event.status || 'pending',
          amount: amount,
          currency: currency,
          occurred_at: card_event.transaction_at || card_event.created_at || txn.created_at,
          title: 'Virtual card funding',
          subtitle: metadata['description'] || "Card #{card_event.card_id}",
          parties: {
            wallet_type: txn.wallet&.wallet_type,
            from_wallet: txn.address,
            card_id: card_event.card_id,
            bridge_card_id: txn.bridge_card_id
          }.compact,
          provider: {
            reference: card_event.provider_transaction_reference || card_event.transaction_reference,
            unique_transaction_id: txn.unique_transaction_id
          }.compact,
          meta: {
            transaction_record_reference: txn.transaction_record&.reference,
            unique_transaction_id: txn.unique_transaction_id,
            bridge_card_id: txn.bridge_card_id
          }.compact,
          timeline: build_wallet_timeline(txn, txn.transaction_record, nil),
          fees: fee_array(metadata['fee_breakdown'], currency),
          legacy: legacy
        )
      end

      def receipt_from_card_event(event, original_reference:)
        metadata = event.metadata.is_a?(Hash) ? event.metadata : {}
        event_time = event.transaction_at || event.created_at
        currency = event.currency || 'USD'
        reference = event.provider_transaction_reference || original_reference || event.id
        normalized_amount = normalize_card_event_amount(event) || event.amount
        merchant_name = card_event_merchant_name(event, metadata)
        merchant_country = card_event_merchant_country(metadata)
        enrichment_payload = card_event_enrichment_payload(event: event, metadata: metadata)

        legacy = {
          reference: event.provider_transaction_reference || event.id,
          type: 'card',
          source: event.event || event.event_name,
          status: event.status,
          amount: normalized_amount,
          currency: currency,
          description: metadata['description'] || event.event.to_s.tr('._', ' ').strip,
          created_at: event_time,
          breakdown: {
            principal_usd: metadata['principal_usd'],
            provider_fee_usd: metadata['provider_fee_usd'],
            bitbridge_fee_usd: metadata['bitbridge_fee_usd'],
            fx_markup_usd: metadata['fx_markup_usd'],
            total_debit_usd: metadata['total_debit_usd'],
            funding_fee_usd: metadata['funding_fee_usd'],
            withdrawal_fee_usd: metadata['withdrawal_fee_usd'],
            total_credit_usd: metadata['total_credit_usd']
          }.compact,
          decline_reason: metadata['decline_reason']
        }.compact

        build_dto(
          reference: reference,
          kind: 'card',
          event: event.event || event.event_name || 'card_event',
          status: event.status || 'pending',
          amount: normalized_amount,
          currency: currency,
          occurred_at: event_time,
          title: metadata['description'] || event.event.to_s.tr('._', ' ').strip,
          subtitle: merchant_name || metadata['description'],
          parties: {
            card_id: event.card_id,
            merchant: merchant_name,
            merchant_country: merchant_country
          }.compact,
          provider: {
            reference: event.provider_transaction_reference || event.transaction_reference,
            card_id: event.card_id
          }.compact,
          timeline: build_card_timeline(event),
          meta: metadata.merge(enrichment_payload).compact,
          fees: card_event_fee_array(event: event, currency: currency, metadata: metadata),
          legacy: legacy
        )
      end

      def receipt_from_bill_order(order, original_reference:)
        record = order.transaction_record
        currency =
          if order.respond_to?(:currency)
            order.currency.presence
          elsif order.respond_to?(:has_attribute?) && order.has_attribute?(:currency)
            order[:currency].presence
          end
        currency ||= 'NGN'
        provider_payload = bill_order_provider_payload(order)
        provider_reference = order.provider_reference.presence || order.transaction_id.presence || record&.reference
        provider_response_code = bill_order_provider_response_code(provider_payload)
        provider_response_message = bill_order_provider_message(provider_payload)
        provider_status = bill_order_provider_status(provider_payload) || order.status

        legacy = {
          reference: "bill-#{order.id}",
          type: 'bill',
          source: order.service_type,
          status: order.status,
          amount: order.total_amount || order.amount,
          currency: currency,
          description: order.biller.presence || order.service_type,
          created_at: order.created_at,
          transaction_reference: record&.reference,
          recipient: order.meter_number || (order.respond_to?(:card_number) ? order.card_number : nil) || (order.respond_to?(:phone_number) ? order.phone_number : nil)
        }.compact

        value_amount = order.amount || order.total_amount
        reward_amount = order.reward_applied.to_f
        commission_amount = order.commission_used.to_f
        inferred_wallet_amount = order.wallet_amount_charged
        if inferred_wallet_amount.blank? && value_amount.present?
          inferred_wallet_amount = [value_amount.to_d - reward_amount.to_d - commission_amount.to_d, 0.to_d]
        end

        service_charge_value = order.service_charge.to_d
        bill_fees =
          if service_charge_value.positive?
            [{ label: 'service charge', amount: service_charge_value, currency: currency }]
          else
            []
          end
        implied_fee = implied_fee_from_totals(
          total_amount: order.total_amount,
          value_amount: value_amount,
          known_fees: bill_fees
        )
        bill_fees = merge_fee_arrays(
          bill_fees,
          implied_fee.positive? ? [{ label: 'processing fee', amount: implied_fee, currency: currency }] : []
        )

        build_dto(
          reference: record&.reference.presence || original_reference || "bill-#{order.id}",
          kind: 'bill',
          event: order.service_type || 'bill_payment',
          status: order.status || 'pending',
          amount: order.total_amount || order.amount,
          currency: currency,
          occurred_at: order.created_at,
          title: order.biller.presence || order.service_type || 'Bill payment',
          subtitle: order.meter_number || order.phone || order.token,
          parties: {
            biller: order.biller,
            service_type: order.service_type,
            recipient: order.meter_number || order.phone
          }.compact,
          provider: {
            name: 'buypower',
            transaction_reference: record&.reference || order.transaction_id,
            reference: provider_reference,
            status: provider_status,
            response_code: provider_response_code,
            response_message: provider_response_message
          }.compact,
          meta: {
            token: order.token,
            token_present: order.token.present?,
            units: order.units,
            meter_number: order.meter_number,
            meter_type: order.meter_type,
            biller: order.biller,
            service_type: order.service_type,
            service_charge: service_charge_value,
            amount: order.amount,
            total_amount: order.total_amount,
            transaction_id: order.transaction_id,
            usd_amount: order.usd_amount,
            currency: currency,
            bill_order_id: order.id,
            provider_reference: provider_reference,
            provider_response_code: provider_response_code,
            provider_response_message: provider_response_message,
            provider_status: provider_status,
            reason: order.reason,
            failure_reason_code: order.failure_reason_code,
            failure_reason_text: order.failure_reason_text,
            reconcile_attempts: order.reconcile_attempts,
            reconcile_last_attempt_at: order.reconcile_last_attempt_at&.iso8601
          }.compact,
          timeline: build_bill_timeline(order, record),
          fees: bill_fees,
          legacy: legacy,
          value_amount: value_amount,
          wallet_amount_charged: inferred_wallet_amount,
          reward_applied: reward_amount,
          commission_applied: commission_amount,
          total_display: value_amount
        )
      end

      def receipt_from_transaction_record(record, original_reference:)
        bill_order = record.bill_order
        amount = record.amount || bill_order&.total_amount || bill_order&.amount
        txn = record.exchange
        txn_meta = txn&.metadata.is_a?(Hash) ? txn.metadata : {}
        anchor_details = extract_anchor_receipt_details(txn_meta, record)
        incoming_transfer_context =
          if txn.present?
            incoming_transfer_receipt_context(
              txn: txn,
              metadata: txn_meta,
              record: record,
              anchor_details: anchor_details,
              conversion_meta: {}
            )
          else
            {}
          end
        outgoing_transfer_context =
          if txn.present?
            outgoing_transfer_receipt_context(
              txn: txn,
              metadata: txn_meta,
              record: record,
              anchor_details: anchor_details,
              conversion_meta: {}
            )
          else
            {}
          end
        transfer_fee_context = txn.present? ? inferred_transfer_fee_context(txn: txn, currency: 'NGN') : { applies: false, total_fee: 0.to_d, fees: [] }
        if transfer_fee_context[:applies]
          amount = amount.to_d + transfer_fee_context[:total_fee]
        end
        provider_name = infer_incoming_transfer_provider(metadata: txn_meta, record: record)
        currency = txn&.wallet&.currency || txn&.currency || 'NGN'
        receipt_kind = if bill_order.present?
                         'bill'
                       elsif incoming_transfer_context.present? || outgoing_transfer_context.present?
                         'wallet'
                       else
                         'checkout'
                       end
        receipt_title =
          if incoming_transfer_context.present?
            'Incoming bank transfer'
          elsif outgoing_transfer_context.present?
            'Bank transfer'
          else
            record.description || bill_order&.biller || bill_order&.service_type
          end
        receipt_subtitle =
          if incoming_transfer_context.present?
            'Funds received into your wallet'
          elsif outgoing_transfer_context.present?
            outgoing_transfer_subtitle(
              status: record.status,
              lifecycle_state: transaction_lifecycle_state_for_receipt(txn: txn, metadata: txn_meta)
            )
          else
            anchor_details[:narration] || bill_order&.service_type
          end
        legacy = {
          reference: record.reference,
          type: receipt_kind,
          source: bill_order&.service_type || record.event_type || 'checkout',
          status: record.status.presence || 'pending',
          amount: amount,
          currency: currency,
          description: record.description || anchor_details[:narration] || bill_order&.biller || bill_order&.service_type,
          created_at: record.created_at,
          transaction_reference: record.reference,
          recipient: bill_order&.meter_number ||
            (bill_order&.respond_to?(:card_number) ? bill_order.card_number : nil) ||
            (bill_order&.respond_to?(:phone_number) ? bill_order.phone_number : nil)
        }.compact

        value_amount = bill_order&.amount
        reward_amount = bill_order&.reward_applied.to_f
        commission_amount = bill_order&.commission_used.to_f
        inferred_wallet_amount = bill_order&.wallet_amount_charged
        if inferred_wallet_amount.blank? && bill_order.present? && value_amount.present?
          inferred_wallet_amount = [value_amount.to_d - reward_amount.to_d - commission_amount.to_d, 0.to_d]
        end

        service_charge_value = bill_order&.service_charge.to_d
        bill_fees =
          if service_charge_value.positive?
            [{ label: 'service charge', amount: service_charge_value, currency: 'NGN' }]
          else
            []
          end
        if bill_order.present? && !transfer_fee_context[:applies]
          implied_fee = implied_fee_from_totals(
            total_amount: bill_order.total_amount,
            value_amount: value_amount,
            known_fees: bill_fees
          )
          bill_fees = merge_fee_arrays(
            bill_fees,
            implied_fee.positive? ? [{ label: 'processing fee', amount: implied_fee, currency: 'NGN' }] : []
          )
        end
        bill_fees = merge_fee_arrays(bill_fees, transfer_fee_context[:fees])

        build_dto(
          reference: record.reference || original_reference,
          kind: receipt_kind,
          event: record.event_type || 'checkout',
          status: record.status.presence || 'pending',
          amount: amount,
          currency: currency,
          occurred_at: record.created_at,
          title: receipt_title,
          subtitle: receipt_subtitle,
          parties: {
            recipient: bill_order&.meter_number || bill_order&.phone_number,
            biller: bill_order&.biller,
            wallet_type: txn&.wallet&.wallet_type,
            wallet_currency: currency,
            sender_name: anchor_details[:sender_name],
            sender_account_number: anchor_details[:sender_account_number],
            sender_bank_name: anchor_details[:sender_bank_name],
            beneficiary_name: outgoing_transfer_context.dig(:outgoing_transfer, :beneficiary_name),
            beneficiary_bank_name: outgoing_transfer_context.dig(:outgoing_transfer, :beneficiary_bank_name),
            beneficiary_account_number: anchor_details[:beneficiary_account_number],
            beneficiary_account_name: anchor_details[:beneficiary_account_name]
          }.compact,
          provider: {
            name: provider_name,
            reference: anchor_details[:payment_reference] || record.reference,
            payment_id: anchor_details[:payment_id],
            settlement_account_id: anchor_details[:settlement_account_id]
          },
          meta: {
            token: bill_order&.token,
            token_present: bill_order&.token.present?,
            units: bill_order&.units,
            meter_number: bill_order&.meter_number,
            meter_type: bill_order&.meter_type,
            biller: bill_order&.biller,
            service_type: bill_order&.service_type,
            service_charge: service_charge_value,
            amount: bill_order&.amount,
            total_amount: bill_order&.total_amount,
            transaction_id: bill_order&.transaction_id,
            receipt_category: receipt_category(incoming_transfer_context, outgoing_transfer_context),
            transaction_direction: receipt_transaction_direction(incoming_transfer_context, outgoing_transfer_context),
            beneficiary: outgoing_transfer_context.dig(:outgoing_transfer, :beneficiary_name),
            bankName: outgoing_transfer_context.dig(:outgoing_transfer, :beneficiary_bank_name),
            accountNumber: outgoing_transfer_context.dig(:outgoing_transfer, :beneficiary_account_number),
            anchor: anchor_details,
            transfer_fee_inferred: transfer_fee_context[:applies]
          }.merge(incoming_transfer_context).merge(outgoing_transfer_context).compact,
          timeline: build_record_timeline(record, bill_order),
          fees: bill_fees,
          legacy: legacy,
          value_amount: value_amount || (transfer_fee_context[:applies] ? record.amount : nil),
          wallet_amount_charged: inferred_wallet_amount,
          reward_applied: reward_amount,
          commission_applied: commission_amount,
          total_display: value_amount || amount
        )
      end

      def receipt_from_circle_transaction(tx, original_reference:)
        amount = (tx.amount_cents.to_i / 100.0)
        legacy = {
          reference: "circle-tx-#{tx.id}",
          type: 'circle',
          source: tx.kind,
          status: 'ok',
          amount: amount,
          currency: 'NGN',
          description: tx.description.presence || 'Circle activity',
          created_at: tx.occurred_at,
          meta: {
            circle_id: tx.circle_id,
            circle_name: tx.circle&.name
          }.compact
        }.compact

        build_dto(
          reference: original_reference || "circle-tx-#{tx.id}",
          kind: 'circle',
          event: tx.kind || 'circle_transaction',
          status: 'ok',
          amount: amount,
          currency: 'NGN',
          occurred_at: tx.occurred_at,
          title: tx.description.presence || 'Circle activity',
          subtitle: tx.circle&.name,
          parties: {
            circle_id: tx.circle_id,
            circle_name: tx.circle&.name
          }.compact,
          timeline: build_circle_timeline(tx),
          provider: {},
          meta: {},
          fees: [],
          legacy: legacy
        )
      end

      # ----------------------------
      # Utils
      # ----------------------------
      def normalize_reference_id(reference)
        reference.to_s.split('-', 2).last
      end

      def transaction_record_reference?(reference)
        reference.match?(/\A(fbg|bbg)-\d+\z/i) || reference.match?(/\ABBG-[A-Z0-9]{6}-[A-Z0-9]{4}\z/i)
      end

      def transaction_record_owned_by_current_user?(record)
        return true if record.bill_order&.user_id == current_user.id
        return true if record.exchange&.wallet&.user_id == current_user.id

        false
      end

      def build_dto(reference:, kind:, event:, status:, amount:, currency:, occurred_at:, title:, subtitle:, parties:, provider:, meta:, fees:, legacy:, timeline: nil, value_amount: nil, wallet_amount_charged: nil, reward_applied: nil, commission_applied: nil, total_display: nil)
        canonical_fees = normalize_fee_entries(fees)
        value_decimal = decimal_or_nil(value_amount)
        reward_decimal = decimal_or_zero(reward_applied)
        commission_decimal = decimal_or_zero(commission_applied)
        total_fees = canonical_fees.sum { |fee| decimal_or_zero(fee[:amount]) }
        total_debit_decimal = decimal_or_nil(total_display) || decimal_or_nil(amount)
        expected_total =
          if value_decimal
            (value_decimal + total_fees - reward_decimal - commission_decimal).round(2)
          end
        total_debit_decimal ||= expected_total
        wallet_debit_decimal = decimal_or_nil(wallet_amount_charged)
        if wallet_debit_decimal.nil? && total_debit_decimal
          wallet_debit_decimal = (total_debit_decimal - reward_decimal - commission_decimal).round(2)
        end
        reconciliation_delta =
          if expected_total && total_debit_decimal
            (total_debit_decimal - expected_total).round(2)
          end
        reconciliation_status =
          if reconciliation_delta.nil?
            'unknown'
          elsif reconciliation_delta.abs <= 0.01
            'ok'
          else
            'mismatch'
          end
        financials = {
          value_amount: value_decimal&.to_f,
          fees: canonical_fees,
          total_fees: total_fees.to_f,
          reward_applied: reward_decimal.to_f,
          commission_applied: commission_decimal.to_f,
          wallet_amount_charged: wallet_debit_decimal&.to_f,
          total_debit: total_debit_decimal&.to_f,
          expected_total_debit: expected_total&.to_f,
          reconciliation_delta: reconciliation_delta&.to_f,
          reconciliation_status: reconciliation_status
        }.compact

        {
          reference: reference,
          kind: kind,
          event: event,
          status: status,
          amount: amount,
          currency: currency,
          fees: canonical_fees,
          net_amount: (amount && total_fees ? (amount.to_d - total_fees) : nil),
          occurred_at: occurred_at,
          title: title,
          subtitle: subtitle,
          parties: parties.presence || {},
          provider: provider.presence || {},
          meta: meta.presence || {},
          timeline: Array(timeline).compact,
          legacy: legacy,
          value_amount: value_amount,
          wallet_amount_charged: wallet_amount_charged,
          reward_applied: reward_applied,
          commission_applied: commission_applied,
          total_display: total_display || value_amount,
          financials: financials
        }.compact
      end

      def build_wallet_timeline(txn, record, fx_quote)
        if fx_quote.present?
          return build_conversion_timeline(txn, fx_quote)
        end

        status = txn.status.to_s
        profile = wallet_timeline_profile(txn, record)
        terminal = status_terminal?(status)
        completed = status_success?(status)
        final = if terminal
          completed ? profile[:completed] : profile[:failed]
        else
          profile[:pending]
        end

        steps = []
        steps << timeline_step(
          step_key: profile[:initiated][:step_key],
          label: profile[:initiated][:label],
          description: profile[:initiated][:description],
          state: 'completed',
          occurred_at: txn.created_at,
          source: 'wallet',
          sequence: 1
        )
        steps << timeline_step(
          step_key: profile[:processing][:step_key],
          label: profile[:processing][:label],
          description: profile[:processing][:description],
          state: terminal ? 'completed' : 'current',
          occurred_at: record&.updated_at || txn.updated_at || txn.created_at,
          source: record.present? ? 'transaction_record' : 'wallet',
          sequence: 2
        )
        steps << timeline_step(
          step_key: final[:step_key],
          label: final[:label],
          description: final[:description],
          state: terminal ? (completed ? 'completed' : 'failed') : 'pending',
          occurred_at: terminal ? (record&.updated_at || txn.updated_at || txn.created_at) : nil,
          source: 'wallet',
          sequence: 3
        )
        steps.reverse
      end

      def build_conversion_timeline(txn, fx_quote)
        status = txn.status.to_s
        terminal = status_terminal?(status)
        completed = status_success?(status)
        final_key = completed ? 'conversion_completed' : terminal ? 'conversion_failed' : 'conversion_completed'
        final_label = completed ? 'Conversion complete' : terminal ? 'Conversion failed' : 'Conversion complete'
        final_description = completed ? 'Your currency has been successfully exchanged' : terminal ? 'The conversion did not complete' : 'Awaiting final confirmation'

        [
          timeline_step(
            step_key: final_key,
            label: final_label,
            description: final_description,
            state: terminal ? (completed ? 'completed' : 'failed') : 'pending',
            occurred_at: terminal ? (fx_quote.executed_at || txn.updated_at || fx_quote.updated_at) : nil,
            source: 'fx',
            sequence: 3
          ),
          timeline_step(
            step_key: 'processing_conversion',
            label: 'Processing conversion',
            description: 'We are exchanging funds at the applied execution rate',
            state: terminal ? 'completed' : 'current',
            occurred_at: fx_quote.updated_at || txn.updated_at || fx_quote.created_at,
            source: 'fx',
            sequence: 2
          ),
          timeline_step(
            step_key: 'conversion_initiated',
            label: 'Conversion initiated',
            description: 'You initiated a currency conversion request',
            state: 'completed',
            occurred_at: fx_quote.created_at || txn.created_at,
            source: 'fx',
            sequence: 1
          )
        ]
      end

      def build_bill_timeline(order, record)
        status = order.status.to_s
        terminal = status_terminal?(status)
        [
          timeline_step(
            step_key: terminal_step_key(status),
            label: terminal_step_label(status),
            description: terminal_step_description(status),
            state: terminal ? (status_success?(status) ? 'completed' : 'failed') : 'pending',
            occurred_at: terminal ? (order.updated_at || record&.updated_at || order.created_at) : nil,
            source: 'bill_order',
            sequence: 3
          ),
          timeline_step(
            step_key: 'processing',
            label: 'Processing',
            description: 'Provider processing is in progress',
            state: terminal ? 'completed' : 'current',
            occurred_at: record&.updated_at || order.updated_at || order.created_at,
            source: 'bill_order',
            sequence: 2
          ),
          timeline_step(
            step_key: 'initiated',
            label: 'Transaction initiated',
            description: 'Your bill payment request was created',
            state: 'completed',
            occurred_at: order.created_at,
            source: 'bill_order',
            sequence: 1
          )
        ]
      end

      def build_record_timeline(record, bill_order)
        if bill_order.present?
          return build_bill_timeline(bill_order, record)
        end

        status = record.status.to_s
        terminal = status_terminal?(status)
        profile = record_timeline_profile(record)
        completed = status_success?(status)
        final = if terminal
          completed ? profile[:completed] : profile[:failed]
        else
          profile[:pending]
        end

        [
          timeline_step(
            step_key: final[:step_key],
            label: final[:label],
            description: final[:description],
            state: terminal ? (completed ? 'completed' : 'failed') : 'pending',
            occurred_at: terminal ? (record.updated_at || record.created_at) : nil,
            source: 'transaction_record',
            sequence: 3
          ),
          timeline_step(
            step_key: profile[:processing][:step_key],
            label: profile[:processing][:label],
            description: profile[:processing][:description],
            state: terminal ? 'completed' : 'current',
            occurred_at: record.updated_at || record.created_at,
            source: 'transaction_record',
            sequence: 2
          ),
          timeline_step(
            step_key: profile[:initiated][:step_key],
            label: profile[:initiated][:label],
            description: profile[:initiated][:description],
            state: 'completed',
            occurred_at: record.created_at,
            source: 'transaction_record',
            sequence: 1
          )
        ]
      end

      def wallet_timeline_profile(txn, record)
        metadata = txn.metadata.is_a?(Hash) ? txn.metadata : {}
        subtype = metadata['subtype'].to_s.downcase
        tx_type = txn.transaction_type.to_s.downcase
        record_event = record&.event_type.to_s.downcase
        provider = metadata['provider'].to_s.downcase

        if subtype.include?('virtual_card_funding') || subtype.include?('card_fund')
          return {
            initiated: {
              step_key: 'card_funding_initiated',
              label: 'Card funding initiated',
              description: 'You initiated funding for your virtual card'
            },
            processing: {
              step_key: 'card_funding_processing',
              label: 'Funding in progress',
              description: 'We are processing your card funding request'
            },
            pending: {
              step_key: 'card_funding_pending',
              label: 'Funding pending',
              description: 'Awaiting final card funding confirmation'
            },
            completed: {
              step_key: 'card_funding_completed',
              label: 'Card funded',
              description: 'Your virtual card has been funded successfully'
            },
            failed: {
              step_key: 'card_funding_failed',
              label: 'Card funding failed',
              description: 'Card funding did not complete successfully'
            }
          }
        end

        if tx_type == 'deposit' || subtype.include?('fund') || record_event.include?('fund') || provider.present?
          return {
            initiated: {
              step_key: 'funding_initiated',
              label: 'Funding initiated',
              description: 'We received your wallet funding request'
            },
            processing: {
              step_key: 'funding_processing',
              label: 'Awaiting settlement',
              description: 'We are waiting for settlement confirmation from the payment provider'
            },
            pending: {
              step_key: 'funding_pending',
              label: 'Funding pending',
              description: 'Funding is still being processed'
            },
            completed: {
              step_key: 'funding_completed',
              label: 'Wallet funded',
              description: 'Your wallet has been credited successfully'
            },
            failed: {
              step_key: 'funding_failed',
              label: 'Funding failed',
              description: 'Wallet funding did not complete successfully'
            }
          }
        end

        if tx_type == 'withdrawal'
          return {
            initiated: {
              step_key: 'withdrawal_initiated',
              label: 'Withdrawal initiated',
              description: 'We received your withdrawal request'
            },
            processing: {
              step_key: 'withdrawal_processing',
              label: 'Payout in progress',
              description: 'We are processing payout to your destination account'
            },
            pending: {
              step_key: 'withdrawal_pending',
              label: 'Withdrawal pending',
              description: 'Withdrawal is still being processed'
            },
            completed: {
              step_key: 'withdrawal_completed',
              label: 'Withdrawal complete',
              description: 'Withdrawal has completed successfully'
            },
            failed: {
              step_key: 'withdrawal_failed',
              label: 'Withdrawal failed',
              description: 'Withdrawal did not complete successfully'
            }
          }
        end

        {
          initiated: {
            step_key: 'transaction_initiated',
            label: 'Transaction initiated',
            description: 'Your transaction was created'
          },
          processing: {
            step_key: 'processing',
            label: 'Processing',
            description: 'We are processing your transaction'
          },
          pending: {
            step_key: 'transaction_pending',
            label: 'Pending',
            description: 'Awaiting final transaction confirmation'
          },
          completed: {
            step_key: 'completed',
            label: 'Completed',
            description: 'Transaction has completed successfully'
          },
          failed: {
            step_key: 'failed',
            label: 'Failed',
            description: 'Transaction did not complete successfully'
          }
        }
      end

      def record_timeline_profile(record)
        reference = record.reference.to_s.downcase
        event_type = record.event_type.to_s.downcase
        description = record.description.to_s.downcase

        if reference.start_with?('fbg-') || event_type.include?('fund') || description.include?('fund')
          return {
            initiated: {
              step_key: 'funding_initiated',
              label: 'Funding initiated',
              description: 'Funding transaction record was created'
            },
            processing: {
              step_key: 'funding_processing',
              label: 'Awaiting settlement',
              description: 'We are waiting for provider settlement confirmation'
            },
            pending: {
              step_key: 'funding_pending',
              label: 'Funding pending',
              description: 'Funding is still being processed'
            },
            completed: {
              step_key: 'funding_completed',
              label: 'Wallet funded',
              description: 'Funding completed and wallet was credited'
            },
            failed: {
              step_key: 'funding_failed',
              label: 'Funding failed',
              description: 'Funding did not complete successfully'
            }
          }
        end

        {
          initiated: {
            step_key: 'initiated',
            label: 'Transaction initiated',
            description: 'Transaction record created'
          },
          processing: {
            step_key: 'processing',
            label: 'Processing',
            description: 'Your transaction is being processed'
          },
          pending: {
            step_key: 'pending',
            label: 'Pending',
            description: 'Awaiting final transaction confirmation'
          },
          completed: {
            step_key: 'completed',
            label: 'Completed',
            description: 'Transaction has completed successfully'
          },
          failed: {
            step_key: 'failed',
            label: 'Failed',
            description: 'Transaction did not complete successfully'
          }
        }
      end

      def build_card_timeline(event)
        status = event.status.to_s
        terminal = status_terminal?(status)
        [
          timeline_step(
            step_key: terminal_step_key(status),
            label: terminal_step_label(status),
            description: terminal_step_description(status),
            state: terminal ? (status_success?(status) ? 'completed' : 'failed') : 'pending',
            occurred_at: terminal ? (event.transaction_at || event.updated_at || event.created_at) : nil,
            source: 'card_event',
            sequence: 3
          ),
          timeline_step(
            step_key: 'processing',
            label: 'Processing',
            description: 'Card network processing is in progress',
            state: terminal ? 'completed' : 'current',
            occurred_at: event.updated_at || event.created_at,
            source: 'card_event',
            sequence: 2
          ),
          timeline_step(
            step_key: 'initiated',
            label: 'Transaction initiated',
            description: 'Card transaction initiated',
            state: 'completed',
            occurred_at: event.transaction_at || event.created_at,
            source: 'card_event',
            sequence: 1
          )
        ]
      end

      def build_circle_timeline(tx)
        [
          timeline_step(
            step_key: 'circle_posted',
            label: 'Circle transaction posted',
            description: 'Circle ledger was updated successfully',
            state: 'completed',
            occurred_at: tx.occurred_at || tx.created_at,
            source: 'circle',
            sequence: 1
          )
        ]
      end

      def timeline_step(step_key:, label:, description:, state:, occurred_at:, source:, sequence:)
        {
          step_key: step_key,
          label: label,
          description: description,
          state: state,
          occurred_at: occurred_at&.iso8601,
          source: source,
          sequence: sequence
        }.compact
      end

      def status_success?(status)
        %w[approved completed successful paid ok].include?(status.to_s.downcase)
      end

      def status_failure?(status)
        %w[failed declined timedout timeout error cancelled canceled reversed disputed].include?(status.to_s.downcase)
      end

      def status_terminal?(status)
        status_success?(status) || status_failure?(status)
      end

      def terminal_step_key(status)
        status_success?(status) ? 'completed' : status_failure?(status) ? 'failed' : 'completed'
      end

      def terminal_step_label(status)
        status_success?(status) ? 'Completed' : status_failure?(status) ? 'Failed' : 'Completed'
      end

      def terminal_step_description(status)
        status_success?(status) ? 'Transaction has completed successfully' : status_failure?(status) ? 'Transaction did not complete successfully' : 'Awaiting completion'
      end

      def wallet_label(tx, record)
        return record.description if record&.description.present?

        base = tx.transaction_type == 'deposit' ? 'Wallet deposit' : 'Wallet withdrawal'
        return base if tx.address.blank?

        suffix = tx.transaction_type == 'deposit' ? "from #{tx.address}" : "to #{tx.address}"
        "#{base} #{suffix}"
      end

      def fee_array(raw_breakdown, currency)
        return [] if raw_breakdown.blank?
        if raw_breakdown.is_a?(Array)
          entries = raw_breakdown.map do |item|
            label = normalize_fee_label(item[:label] || item['label'] || 'fee')
            {
              code: canonical_fee_code(label),
              label: label,
              amount: item[:amount] || item['amount'],
              currency: item[:currency] || item['currency'] || currency,
              source: item[:source] || item['source']
            }.compact
          end
          return normalize_fee_entries(entries)
        end

        if raw_breakdown.is_a?(Hash)
          entries = raw_breakdown.map do |label, amount|
            normalized_label = normalize_fee_label(label.to_s.tr('_', ' '))
            { code: canonical_fee_code(normalized_label), label: normalized_label, amount: amount, currency: currency }.compact
          end
          return normalize_fee_entries(entries)
        else
          []
        end
      end

      def card_event_fee_array(event:, currency:, metadata:)
        explicit = fee_array(metadata['fee_breakdown'], currency)

        fallback = []
        event_fee = normalize_card_event_money(
          event.fee_amount || metadata['fee_amount'] || metadata['fee'],
          currency: event.fee_currency || metadata['fee_currency'] || currency
        )
        event_fee_currency = event.fee_currency || metadata['fee_currency'] || currency
        skip_provider_fee_metadata = false
        if event_fee.to_d.positive?
          fallback << { label: 'provider fee', amount: event_fee, currency: event_fee_currency }
          skip_provider_fee_metadata = true
        end

        if currency.to_s.upcase == 'USD'
          fallback += [
            ['provider fee', metadata['provider_fee_usd']],
            ['bitbridge fee', metadata['bitbridge_fee_usd']],
            ['fx markup', metadata['fx_markup_usd']],
            ['funding fee', metadata['funding_fee_usd']],
            ['withdrawal fee', metadata['withdrawal_fee_usd']]
          ].filter_map do |label, amount|
            next nil if label == 'provider fee' && skip_provider_fee_metadata

            parsed = decimal_or_nil(amount)
            next nil unless parsed.to_d.positive?

            { label: label, amount: parsed, currency: 'USD' }
          end
        end

        merge_fee_arrays(explicit, fallback)
      end

      def card_event_merchant_name(event, metadata)
        merchant_meta = metadata['merchant']
        return merchant_meta['name'] if merchant_meta.is_a?(Hash) && merchant_meta['name'].present?

        event.merchant_name.presence || metadata['merchant_name'].presence
      end

      def card_event_merchant_country(metadata)
        merchant_meta = metadata['merchant']
        return merchant_meta['country'] if merchant_meta.is_a?(Hash) && merchant_meta['country'].present?

        metadata['merchant_country']
      end

      def card_event_enrichment_payload(event:, metadata:)
        merchant_meta = metadata['merchant'].is_a?(Hash) ? metadata['merchant'] : {}
        merchant_payload = {
          name: card_event_merchant_name(event, metadata),
          country: card_event_merchant_country(metadata),
          logo: merchant_meta['logo'],
          website: merchant_meta['website'],
          category: merchant_meta['category'],
          group: merchant_meta['group'],
          city: merchant_meta['city'],
          code: merchant_meta['code'],
          recurring: merchant_meta['recurring']
        }.compact

        fx_payload = {
          merchant_amount: event.merchant_amount&.to_f,
          merchant_currency: event.merchant_currency,
          billing_amount: event.billing_amount&.to_f,
          billing_currency: event.billing_currency,
          fx_implied_rate: event.fx_implied_rate&.to_f,
          fx_reference_rate: event.fx_reference_rate&.to_f,
          fx_margin_usd: event.fx_margin_usd&.to_f
        }.compact

        {
          card_event_enrichment: {
            merchant: merchant_payload.presence,
            transaction: {
              merchant_category_code: event.merchant_category_code,
              card_transaction_type: event.card_transaction_type,
              decline_reason: event.decline_reason
            }.compact,
            fx: fx_payload.presence
          }.compact
        }
      end

      def normalize_card_event_amount(event)
        return nil if event.blank?

        normalize_card_event_money(
          event.amount,
          currency: event.currency,
          major_hint: card_event_major_hint(event)
        )
      end

      def card_event_major_hint(event)
        metadata = event.metadata.is_a?(Hash) ? event.metadata : {}
        decimal_or_nil(metadata['total_debit_usd']) ||
          decimal_or_nil(metadata['principal_usd']) ||
          decimal_or_nil(metadata['total_credit_usd']) ||
          decimal_or_nil(metadata['gross_amount_usd'])
      end

      def normalize_card_event_money(raw_amount, currency:, major_hint: nil)
        amount = decimal_or_nil(raw_amount)
        return nil unless amount
        return amount.to_f unless currency.to_s.upcase == 'USD'

        if major_hint.present?
          return amount.to_f if (amount - major_hint).abs <= 0.01
          scaled = (amount / 100).round(6)
          return scaled.to_f if (scaled - major_hint).abs <= 0.01
        end

        # Provider card amounts are frequently integer cents for USD events.
        return (amount / 100).to_f if amount.frac.zero?

        amount.to_f
      end

      def normalize_fee_label(label)
        normalized = label.to_s.tr('_', ' ').strip.downcase
        return 'transfer fee' if normalized == 'platform fee'
        return 'stamp duty' if normalized == 'stamp duty fee'

        label.to_s
      end

      def canonical_fee_code(label)
        key = label.to_s.tr('_', ' ').strip.downcase
        return 'service_charge' if key == 'service charge'
        return 'processing_fee' if key == 'processing fee'
        return 'transfer_fee' if key == 'transfer fee' || key == 'platform fee'
        return 'stamp_duty' if key == 'stamp duty' || key == 'stamp duty fee'
        return 'provider_fee' if key == 'provider fee'
        return 'bitbridge_fee' if key == 'bitbridge fee'
        return 'conversion_fee' if key == 'conversion fee'
        return 'fx_markup' if key == 'fx markup'

        key.gsub(/\s+/, '_')
      end

      def normalize_fee_entries(entries)
        grouped = {}
        Array(entries).compact.each do |fee|
          next unless fee.is_a?(Hash)

          amount = decimal_or_nil(fee[:amount] || fee['amount'])
          next unless amount

          currency = (fee[:currency] || fee['currency']).presence || 'NGN'
          label = normalize_fee_label(fee[:label] || fee['label'] || 'fee')
          code = (fee[:code] || fee['code']).presence || canonical_fee_code(label)
          source = fee[:source] || fee['source']
          group_key = "#{code}:#{currency}"
          current = grouped[group_key]

          if current
            current[:amount] = (current[:amount].to_d + amount).to_f
            current[:source] ||= source
          else
            grouped[group_key] = {
              code: code,
              label: label,
              amount: amount.to_f,
              currency: currency,
              source: source
            }.compact
          end
        end

        normalized = grouped.values
        grouped_by_currency = normalized.group_by { |entry| entry[:currency].to_s.upcase }

        grouped_by_currency.values.flat_map do |rows|
          has_component_fees = rows.any? { |row| row[:code].to_s != 'total_fee' }
          if has_component_fees
            rows.reject { |row| row[:code].to_s == 'total_fee' }
          else
            rows
          end
        end
      end

      def decimal_or_nil(value)
        return nil if value.nil?
        return nil if value.respond_to?(:empty?) && value.empty?

        BigDecimal(value.to_s)
      rescue StandardError
        nil
      end

      def decimal_or_zero(value)
        decimal_or_nil(value) || 0.to_d
      end

      def implied_fee_from_totals(total_amount:, value_amount:, known_fees:)
        total = total_amount.to_d
        value = value_amount.to_d
        known = Array(known_fees).sum { |entry| entry[:amount].to_d }
        implied = total - value - known
        implied.positive? ? implied.round(2) : 0.to_d
      rescue StandardError
        0.to_d
      end

      def inferred_transfer_fee_context(txn:, currency:)
        metadata = txn.metadata.is_a?(Hash) ? txn.metadata : {}
        transfer_reference = metadata['transfer_reference'].to_s
        subtype = metadata['subtype'].to_s
        return { applies: false, total_fee: 0.to_d, fees: [] } if transfer_reference.blank?
        return { applies: false, total_fee: 0.to_d, fees: [] } unless subtype == 'principal'

        fee_tx = txn.wallet.transactions
                    .where("metadata ->> 'transfer_reference' = ?", transfer_reference)
                    .where("metadata ->> 'subtype' = ?", 'fee')
                    .order(created_at: :desc)
                    .first
        return { applies: false, total_fee: 0.to_d, fees: [] } unless fee_tx

        fee_breakdown = fee_array(fee_tx.metadata&.dig('fee_breakdown'), currency)
        inferred_fees =
          if fee_breakdown.present?
            fee_breakdown
          else
            [{ label: 'transfer fee', amount: fee_tx.amount.to_d, currency: currency }]
          end

        {
          applies: true,
          total_fee: fee_tx.amount.to_d,
          fees: inferred_fees
        }
      rescue StandardError
        { applies: false, total_fee: 0.to_d, fees: [] }
      end
      def extract_anchor_receipt_details(metadata, record)
        data = metadata.is_a?(Hash) ? metadata : {}
        sender = data['anchor_sender'].is_a?(Hash) ? data['anchor_sender'] : {}
        virtual_account = data['anchor_virtual_account'].is_a?(Hash) ? data['anchor_virtual_account'] : {}

        {
          payment_id: data['anchor_payment_id'],
          payment_reference: data['anchor_payment_reference'] || record&.reference,
          payment_type: data['anchor_payment_type'],
          narration: data['anchor_narration'] || record&.description,
          paid_at: data['anchor_paid_at'],
          provider_created_at: data['anchor_created_at'],
          fee: data['anchor_fee'],
          settlement_account_id: data['anchor_settlement_account_id'],
          sender_name: sender['account_name'] || record&.customer_name,
          sender_account_number: sender['account_number'],
          sender_bank_name: sender['bank_name'] || record&.bank,
          beneficiary_account_number: virtual_account['account_number'] || record&.account_number,
          beneficiary_account_name: virtual_account['account_name']
        }.compact
      end

      def incoming_transfer_receipt_context(txn:, metadata:, record:, anchor_details:, conversion_meta:)
        return {} unless incoming_transfer_receipt?(txn: txn, metadata: metadata, record: record, conversion_meta: conversion_meta)

        provider_name = infer_incoming_transfer_provider(metadata: metadata, record: record)
        sender_name = anchor_details[:sender_name] || record&.customer_name
        sender_account_number = anchor_details[:sender_account_number] || record&.account_number
        sender_bank_name = anchor_details[:sender_bank_name] || record&.bank

        {
          incoming_transfer: {
            provider_name: provider_name,
            provider_reference: record&.transaction_id || anchor_details[:payment_reference] || record&.reference,
            session_id: metadata['nibss_session_id'] || metadata['session_id'],
            sender_name: sender_name,
            sender_bank_name: sender_bank_name,
            sender_account_number: sender_account_number,
            recipient_wallet_type: txn.wallet&.wallet_type,
            recipient_wallet_currency: txn.wallet&.currency || txn.currency,
            timestamps: incoming_transfer_timestamps(txn: txn, record: record, anchor_details: anchor_details)
          }.compact
        }
      end

      def incoming_transfer_receipt?(txn:, metadata:, record:, conversion_meta:)
        return false unless txn.transaction_type.to_s == 'deposit'
        return false if conversion_meta.present?

        provider = metadata['provider'].to_s.downcase
        purpose = metadata['purpose'].to_s.downcase
        record_reference = record&.reference.to_s
        event_type = record&.event_type.to_s.downcase

        provider.present? ||
          %w[wallet_fund wallet_fund_pooled].include?(purpose) ||
          event_type.start_with?('monnify.') ||
          event_type.start_with?('anchor.') ||
          record_reference.match?(/\A(fbg|bbg)-/i) ||
          record_reference.match?(/\ABBG-[A-Z0-9]{6}-[A-Z0-9]{4}\z/i)
      end

      def infer_incoming_transfer_provider(metadata:, record:)
        provider = metadata['provider'].to_s.downcase
        return provider if provider.present?

        event_type = record&.event_type.to_s.downcase
        return 'anchor' if event_type.start_with?('anchor.')
        return 'monnify' if event_type.start_with?('monnify.')

        reference = record&.reference.to_s
        return 'monnify' if reference.match?(/\Afbg-/i)
        return 'anchor' if reference.match?(/\ABBG-/i)

        nil
      end

      def incoming_transfer_timestamps(txn:, record:, anchor_details:)
        {
          initiated_at: record&.created_at&.iso8601 || txn.created_at&.iso8601,
          provider_received_at: anchor_details[:provider_created_at] || record&.created_at&.iso8601,
          settled_at: anchor_details[:paid_at] || record&.updated_at&.iso8601,
          credited_at: txn.created_at&.iso8601,
          last_updated_at: [txn.updated_at, record&.updated_at].compact.max&.iso8601
        }.compact
      end

      def outgoing_transfer_receipt_context(txn:, metadata:, record:, anchor_details:, conversion_meta:)
        return {} unless outgoing_transfer_receipt?(txn: txn, metadata: metadata, record: record, conversion_meta: conversion_meta)

        beneficiary_name =
          record&.customer_name ||
          metadata['beneficiary_name'] ||
          metadata['account_name']
        beneficiary_account_number =
          record&.account_number ||
          metadata['beneficiary_account_number'] ||
          metadata['account_number']
        beneficiary_bank_name =
          record&.bank ||
          metadata['beneficiary_bank_name'] ||
          metadata['bank']

        {
          outgoing_transfer: {
            provider_name: metadata['provider'] || infer_incoming_transfer_provider(metadata: metadata, record: record),
            provider_reference: metadata['provider_transfer_id'] || record&.transaction_id || record&.reference || metadata['transfer_reference'],
            transfer_reference: metadata['transfer_reference'] || record&.reference,
            beneficiary_name: beneficiary_name,
            beneficiary_bank_name: beneficiary_bank_name,
            beneficiary_account_number: beneficiary_account_number,
            sender_wallet_type: txn.wallet&.wallet_type,
            sender_wallet_currency: txn.wallet&.currency || txn.currency,
            timestamps: outgoing_transfer_timestamps(txn: txn, record: record, anchor_details: anchor_details)
          }.compact
        }
      end

      def outgoing_transfer_receipt?(txn:, metadata:, record:, conversion_meta:)
        return false unless txn.transaction_type.to_s == 'withdrawal'
        return false if conversion_meta.present?

        provider = metadata['provider'].to_s.downcase
        subtype = metadata['subtype'].to_s.downcase
        event_type = record&.event_type.to_s.downcase

        provider == 'anchor' &&
          (
            subtype == 'principal' ||
            event_type.start_with?('anchor.transfer')
          )
      end

      def outgoing_transfer_timestamps(txn:, record:, anchor_details:)
        {
          initiated_at: record&.created_at&.iso8601 || txn.created_at&.iso8601,
          provider_received_at: anchor_details[:provider_created_at] || record&.created_at&.iso8601,
          provider_settled_at: anchor_details[:paid_at] || record&.updated_at&.iso8601,
          debited_at: txn.created_at&.iso8601,
          last_updated_at: [txn.updated_at, record&.updated_at].compact.max&.iso8601
        }.compact
      end

      def receipt_category(incoming_transfer_context, outgoing_transfer_context)
        return 'incoming_transfer' if incoming_transfer_context.present?
        return 'outgoing_transfer' if outgoing_transfer_context.present?

        nil
      end

      def receipt_transaction_direction(incoming_transfer_context, outgoing_transfer_context)
        return 'inbound' if incoming_transfer_context.present?
        return 'outbound' if outgoing_transfer_context.present?

        nil
      end

      def transaction_lifecycle_state_for_receipt(txn:, metadata:)
        metadata_hash = metadata.is_a?(Hash) ? metadata : {}
        explicit = metadata_hash['lifecycle_state'].to_s
        return explicit if explicit.present?
        return nil unless txn.present?

        serialized = TransactionSerializer.new(txn).as_json
        serialized[:lifecycle_state].presence || serialized['lifecycle_state'].presence
      rescue StandardError
        nil
      end

      def outgoing_transfer_subtitle(status:, lifecycle_state:)
        normalized_lifecycle = lifecycle_state.to_s.downcase
        normalized_status = status.to_s.downcase

        return 'Transfer failed. Funds returned to wallet' if %w[failed_refunded released].include?(normalized_lifecycle)
        return 'Transfer failed. Reversal in progress' if normalized_lifecycle == 'failed_reversal_pending'
        return 'Transfer is being processed by provider' if %w[pending_provider reserved pending processing initialized].include?(normalized_lifecycle)
        return 'Transfer did not complete successfully' if %w[failed_unrecovered failed declined timeout timedout timed_out].include?(normalized_lifecycle)

        return 'Transfer is being processed by provider' if %w[pending processing initialized reserved].include?(normalized_status)
        return 'Transfer did not complete successfully' if %w[failed declined timeout timedout timed_out].include?(normalized_status)

        'Funds sent to recipient bank account'
      end

      def resolve_wallet_balance_snapshot(txn, metadata)
        if wallet_ledger_snapshot_columns_available?
          transfer_reference = metadata['transfer_reference'].to_s
          subtype = metadata['subtype'].to_s
          entry_type = resolve_snapshot_entry_type(subtype, txn.status.to_s)

          if transfer_reference.present? && entry_type.present?
            entry = WalletLedgerEntry
                    .where(wallet_id: txn.wallet_id, entry_type: entry_type)
                    .where("metadata ->> 'transfer_reference' = ?", transfer_reference)
                    .order(created_at: :desc)
                    .first
            if entry
              return {
                entry_type: entry.entry_type,
                before_event_balance: {
                  available: entry.before_available_balance&.to_f
                }.compact,
                after_event_balance: {
                  available: entry.after_available_balance&.to_f
                }.compact
              }
            end
          end
        end

        return nil unless txn.respond_to?(:before_available_balance) && txn.respond_to?(:after_available_balance)

        {
          entry_type: 'transaction',
          before_event_balance: {
            available: txn.before_available_balance&.to_f
          }.compact,
          after_event_balance: {
            available: txn.after_available_balance&.to_f
          }.compact
        }
      end

      def resolve_snapshot_entry_type(subtype, status)
        normalized_subtype = subtype.to_s.downcase
        normalized_status = status.to_s.downcase

        return 'release' if normalized_subtype == 'reversal'
        return nil unless normalized_subtype == 'principal'
        return 'hold' if normalized_status == 'pending'
        return 'debit' if normalized_status == 'approved'

        if %w[failed declined].include?(normalized_status)
          return 'release'
        end

        nil
      end

      def wallet_ledger_snapshot_columns_available?
        WalletLedgerEntry.column_names.include?('before_available_balance') &&
          WalletLedgerEntry.column_names.include?('after_available_balance')
      end

      def bill_order_provider_payload(order)
        payload = order.provider_response
        return payload if payload.is_a?(Hash)
        return {} if payload.blank?

        JSON.parse(payload.to_s)
      rescue StandardError
        {}
      end

      def bill_order_provider_response_code(payload)
        return nil unless payload.is_a?(Hash)

        payload['responseCode'] ||
          payload[:responseCode] ||
          payload.dig('data', 'responseCode') ||
          payload.dig(:data, :responseCode) ||
          payload.dig('result', 'responseCode') ||
          payload.dig(:result, :responseCode) ||
          payload.dig('result', 'data', 'responseCode') ||
          payload.dig(:result, :data, :responseCode)
      end

      def bill_order_provider_message(payload)
        return nil unless payload.is_a?(Hash)

        payload['message'].to_s.presence ||
          payload[:message].to_s.presence ||
          payload.dig('data', 'message').to_s.presence ||
          payload.dig(:data, :message).to_s.presence ||
          payload.dig('data', 'responseMessage').to_s.presence ||
          payload.dig(:data, :responseMessage).to_s.presence ||
          payload.dig('result', 'message').to_s.presence ||
          payload.dig(:result, :message).to_s.presence ||
          payload.dig('result', 'data', 'message').to_s.presence ||
          payload.dig(:result, :data, :message).to_s.presence ||
          payload.dig('result', 'data', 'responseMessage').to_s.presence ||
          payload.dig(:result, :data, :responseMessage).to_s.presence
      end

      def bill_order_provider_status(payload)
        return nil unless payload.is_a?(Hash)

        status_value =
          payload['status'] ||
          payload[:status] ||
          payload.dig('data', 'status') ||
          payload.dig(:data, :status) ||
          payload.dig('result', 'status') ||
          payload.dig(:result, :status)

        case status_value
        when true
          'successful'
        when false
          'failed'
        else
          status_value.to_s.presence
        end
      end
    end
  end
end

