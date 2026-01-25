# frozen_string_literal: true

module Api
  module V1
    class ReceiptsController < ApplicationController
      def show
        reference = params[:reference].to_s.strip
        return render json: { message: 'Receipt reference is required.' }, status: :bad_request if reference.blank?

        receipt = resolve_receipt(reference)
        return render json: { message: 'Receipt not found.' }, status: :not_found if receipt.nil?

        render json: { message: 'ok', data: receipt }, status: :ok
      end

      private

      def resolve_receipt(reference)
        txn = resolve_transaction(reference)
        return receipt_from_transaction(txn) if txn

        event = resolve_card_event(reference)
        return receipt_from_card_event(event) if event

        bill_order = resolve_bill_order(reference)
        return receipt_from_bill_order(bill_order) if bill_order

        nil
      end

      def resolve_transaction(reference)
        return current_user.transactions.find_by(id: normalize_reference_id(reference)) if reference.start_with?('txn-')

        current_user.transactions.find_by(transfer_id: reference) ||
          current_user.transactions.where("metadata ->> 'transfer_reference' = ?", reference).first
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
        bill_order = current_user.bill_orders.find_by(id: reference)
        return bill_order if bill_order

        if reference.start_with?('bill-')
          return current_user.bill_orders.find_by(id: normalize_reference_id(reference))
        end

        record = TransactionRecord.find_by(reference: reference)
        return nil if record.nil?

        record.bill_order if record.bill_order&.user_id == current_user.id
      end

      def receipt_from_transaction(txn)
        metadata = txn.metadata.is_a?(Hash) ? txn.metadata : {}
        {
          reference: txn.id,
          type: 'wallet',
          source: metadata['subtype'] || txn.transaction_type,
          status: txn.status,
          amount: txn.amount,
          currency: txn.currency || txn.wallet&.currency,
          description: metadata['description'] || txn.address,
          created_at: txn.created_at,
          transfer_reference: metadata['transfer_reference'],
          provider: metadata['provider'],
          breakdown: metadata['fee_breakdown']
        }.compact
      end

      def receipt_from_card_event(event)
        metadata = event.metadata.is_a?(Hash) ? event.metadata : {}
        event_time = event.transaction_at || event.created_at
        fx_payload =
          if event.merchant_currency.present? || metadata['fx_discovery_present']
            {
              merchant_amount: event.merchant_amount,
              merchant_currency: event.merchant_currency,
              billing_amount: event.billing_amount,
              billing_currency: event.billing_currency,
              fx_implied_rate: event.fx_implied_rate,
              fx_reference_rate: event.fx_reference_rate,
              fx_margin_usd: event.fx_margin_usd
            }.compact
          end

        payload = {
          reference: event.provider_transaction_reference || event.id,
          type: 'card',
          source: event.event || event.event_name,
          status: event.status,
          amount: event.amount,
          currency: event.currency,
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

        payload[:fx] = fx_payload if fx_payload.present?
        payload
      end

      def receipt_from_bill_order(order)
        record = order.transaction_record
        {
          reference: order.id,
          type: 'bill',
          source: order.service_type,
          status: order.status,
          amount: order.total_amount || order.amount,
          currency: order.currency.presence || 'NGN',
          description: order.biller.presence || order.service_type,
          created_at: order.created_at,
          transaction_reference: record&.reference,
          recipient: order.meter_number || order.card_number || order.phone_number
        }.compact
      end

      def normalize_reference_id(reference)
        reference.to_s.split('-', 2).last
      end
    end
  end
end
