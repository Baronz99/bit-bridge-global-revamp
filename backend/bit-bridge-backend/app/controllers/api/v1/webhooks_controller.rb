# frozen_string_literal: true

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

        secrets = [
          ENV['BRIDGECARD_TEST_WEBHOOK_SECRET'],
          ENV['BRIDGECARD_LIVE_WEBHOOK_SECRET']
        ].compact

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

        status =
          if event.include?('successful')
            'successful'
          elsif event.include?('failed')
            'failed'
          elsif event.include?('declined')
            'declined'
          else
            'notification'
          end

        transaction_at =
          if data['transaction_date'].present?
            Time.zone.parse(data['transaction_date']) rescue nil
          elsif data['transaction_timestamp'].present?
            Time.at(data['transaction_timestamp'].to_i)
          end

        if transaction_reference.present? &&
           CardEvent.exists?(transaction_reference: transaction_reference, event: event)
          return head :ok
        end

        CardEvent.create!(
          event: event.presence || 'unknown',
          status: status,
          card_id: card_id.presence,
          cardholder_id: cardholder_id.presence,
          currency: data['currency'],
          amount: data['amount'],
          transaction_reference: transaction_reference.presence,
          card_transaction_type: data['card_transaction_type'],
          merchant_category_code: data['merchant_category_code'],
          description: data['description'] || data['message'],
          decline_reason: data['decline_reason'] || data['reason'],
          transaction_at: transaction_at,
          livemode: data['livemode'],
          raw_payload: payload,
          user_id: user_id
        )

        case event
        when 'card_unload_event.successful'
          handle_card_unload_success(data)
        when 'card_unload_event.failed'
          handle_card_unload_failed(data)
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
        data = JSON.parse(request.raw_post)
        data.dig('relationships', 'data', 'type')


        account_id = data&.dig('relationships', 'customer', 'data', 'id')
        transfer_id = data.dig('relationships', 'transfer', 'data', 'id')
        type = data['type']
        Rails.logger.info("✅  Anchor webhook Data TYPE: #{data['type']}")
        Rails.logger.info("✅  Anchor webhook json post: #{data}")

        service = AnchorService.new

        handleKycVerificatiion(account_id) if data['type'] == 'customer.identification.approved'

        transfer_id if data['type'] == 'nip.inbound.received'


        case type

        when 'nip.inbound.completed'
          service.get_inbound_transfer(transfer_id)

        when 'nip.transfer.successful'
          # Rails.logger.info("✅  Anchor webhook transfer successful data: #{data}")
          service.confirm_transfer_withdrawal(data)

        when 'transaction.created'
          # Rails.logger.info("✅  Anchor webhook: Initiatetransaction")
          # AnchorService.new

        when 'payment.received'
          # Rails.logger.info("✅  Anchor webhook: Payment Received")
          # service.fund_deposit_account(data)

        when 'payment.settled'
          # Rails.logger.info("✅  Anchor webhook: Transfer successful- deposit")
          service.fund_deposit_account(data)
        else
          Rails.logger.info('✅  Anchor webhook: No Option')

        end


        # Process the webhook data as needed
        head :ok
      end


      private

      def handleKycVerificatiion(account_id)
        account = Account.find_by(account_id: account_id)
        account.update(status: 'verified')
      end

      def handleTransactionConfirmation(event_data)
        Rails.logger.info("✅  Monnify webhook raw event data: #{event_data}")
        user_id = event_data['product']['reference']
        user = User.find_by(id: user_id)



        unless user
          Rails.logger.error("❌ User with ID #{user_id} not found")
          return
        end

        unless user.wallet
          Rails.logger.error("❌ Wallet not found for user #{user.id}")
          return
        end



        payment_info = event_data['paymentSourceInformation'].first

        Rails.logger.info("✅  Monnify webhook raw payment_info data: #{payment_info}")



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
          Rails.logger.info("✅ Transaction saved: #{transaction.inspect}")
        else
          Rails.logger.error("❌ Transaction failed: #{transaction.errors.full_messages.to_sentence}")
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

        txn.wallet.credit_cents!(amount_cents) if amount_cents.positive?
        txn.update!(status: 'approved', amount: amount_usd)
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
