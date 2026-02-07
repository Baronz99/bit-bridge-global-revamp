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

          # enforce ownership (via associated user or wallet)
          if record.respond_to?(:user_id)
            return nil unless record.user_id == current_user.id
          elsif record.respond_to?(:wallet_id)
            return nil unless record.wallet&.user_id == current_user.id
          end

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
        amount = txn.amount
        currency = txn.currency || txn.wallet&.currency || 'NGN'
        title = wallet_label(txn, record)

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
            bridge_card_id: txn.bridge_card_id
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
          subtitle: metadata['description'] || txn.address,
          parties: {
            from: txn.address,
            wallet_type: txn.wallet&.wallet_type,
            account_name: record&.customer_name,
            account_number: record&.account_number
          }.compact,
          provider: {
            name: metadata['provider'],
            reference: metadata['transfer_reference'] || record&.reference
          }.compact,
          meta: {
            transaction_record_reference: record&.reference,
            unique_transaction_id: txn.unique_transaction_id,
            bridge_card_id: txn.bridge_card_id
          }.compact,
          fees: fee_array(metadata['fee_breakdown'], currency),
          legacy: legacy
        )
      end

      def receipt_from_card_funding(txn, card_event, original_reference:)
        metadata = txn.metadata.is_a?(Hash) ? txn.metadata : {}
        currency = card_event.currency || txn.currency || txn.wallet&.currency || 'USD'
        reference = card_event.provider_transaction_reference || original_reference || "wallet-tx-#{txn.id}"
        amount = card_event.amount || txn.amount

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
          fees: fee_array(metadata['fee_breakdown'], currency),
          legacy: legacy
        )
      end

      def receipt_from_card_event(event, original_reference:)
        metadata = event.metadata.is_a?(Hash) ? event.metadata : {}
        event_time = event.transaction_at || event.created_at
        currency = event.currency || 'USD'
        reference = event.provider_transaction_reference || original_reference || event.id

        legacy = {
          reference: event.provider_transaction_reference || event.id,
          type: 'card',
          source: event.event || event.event_name,
          status: event.status,
          amount: event.amount,
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
          amount: event.amount,
          currency: currency,
          occurred_at: event_time,
          title: metadata['description'] || event.event.to_s.tr('._', ' ').strip,
          subtitle: metadata['merchant'] || metadata['description'],
          parties: {
            card_id: event.card_id,
            merchant: metadata['merchant'],
            merchant_country: metadata['merchant_country']
          }.compact,
          provider: {
            reference: event.provider_transaction_reference || event.transaction_reference,
            card_id: event.card_id
          }.compact,
          meta: metadata.compact,
          fees: fee_array(metadata['fee_breakdown'], currency),
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
        reward_amount = (order.reward_applied || order.commission_used).to_f

        service_charge_value = order.service_charge.to_d
        bill_fees =
          if service_charge_value.positive?
            [{ label: 'service charge', amount: service_charge_value, currency: currency }]
          else
            []
          end

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
            transaction_reference: record&.reference || order.transaction_id
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
            currency: currency
          }.compact,
          fees: bill_fees,
          legacy: legacy,
          value_amount: value_amount,
          wallet_amount_charged: order.wallet_amount_charged,
          reward_applied: reward_amount,
          total_display: value_amount
        )
      end

      def receipt_from_transaction_record(record, original_reference:)
        bill_order = record.bill_order
        amount = record.amount || bill_order&.total_amount || bill_order&.amount
        legacy = {
          reference: record.reference,
          type: bill_order ? 'bill' : 'checkout',
          source: bill_order&.service_type || record.event_type || 'checkout',
          status: record.status.presence || 'pending',
          amount: amount,
          currency: 'NGN',
          description: record.description || bill_order&.biller || bill_order&.service_type,
          created_at: record.created_at,
          transaction_reference: record.reference,
          recipient: bill_order&.meter_number ||
            (bill_order&.respond_to?(:card_number) ? bill_order.card_number : nil) ||
            (bill_order&.respond_to?(:phone_number) ? bill_order.phone_number : nil)
        }.compact

        value_amount = bill_order&.amount
        reward_amount = bill_order ? ((bill_order.reward_applied || bill_order.commission_used).to_f) : nil

        service_charge_value = bill_order&.service_charge.to_d
        bill_fees =
          if service_charge_value.positive?
            [{ label: 'service charge', amount: service_charge_value, currency: 'NGN' }]
          else
            []
          end

        build_dto(
          reference: record.reference || original_reference,
          kind: bill_order ? 'bill' : 'checkout',
          event: record.event_type || 'checkout',
          status: record.status.presence || 'pending',
          amount: amount,
          currency: 'NGN',
          occurred_at: record.created_at,
          title: record.description || bill_order&.biller || bill_order&.service_type,
          subtitle: bill_order&.service_type,
          parties: {
            recipient: bill_order&.meter_number || bill_order&.phone_number,
            biller: bill_order&.biller
          }.compact,
          provider: {
            reference: record.reference
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
            transaction_id: bill_order&.transaction_id
          }.compact,
          fees: bill_fees,
          legacy: legacy,
          value_amount: value_amount,
          wallet_amount_charged: bill_order&.wallet_amount_charged,
          reward_applied: reward_amount,
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
        reference.match?(/\A(fbg|bbg)-\d+\z/i)
      end

      def build_dto(reference:, kind:, event:, status:, amount:, currency:, occurred_at:, title:, subtitle:, parties:, provider:, meta:, fees:, legacy:, value_amount: nil, wallet_amount_charged: nil, reward_applied: nil, total_display: nil)
        fee_array = Array(fees).compact
        total_fees = fee_array.reduce(0) { |sum, f| sum + (f[:amount].to_d rescue 0) }

        {
          reference: reference,
          kind: kind,
          event: event,
          status: status,
          amount: amount,
          currency: currency,
          fees: fee_array,
          net_amount: (amount && total_fees ? (amount.to_d - total_fees) : nil),
          occurred_at: occurred_at,
          title: title,
          subtitle: subtitle,
          parties: parties.presence || {},
          provider: provider.presence || {},
          meta: meta.presence || {},
          legacy: legacy,
          value_amount: value_amount,
          wallet_amount_charged: wallet_amount_charged,
          reward_applied: reward_applied,
          total_display: total_display || value_amount
        }.compact
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
          return raw_breakdown.map do |item|
            {
              label: item[:label] || item['label'] || 'fee',
              amount: item[:amount] || item['amount'],
              currency: item[:currency] || item['currency'] || currency
            }.compact
          end
        end

        if raw_breakdown.is_a?(Hash)
          raw_breakdown.map do |label, amount|
            { label: label.to_s.tr('_', ' '), amount: amount, currency: currency }.compact
          end
        else
          []
        end
      end
    end
  end
end
