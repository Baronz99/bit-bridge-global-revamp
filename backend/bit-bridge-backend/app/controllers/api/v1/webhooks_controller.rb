# frozen_string_literal: true

module Api
  module V1
    class WebhooksController < ApplicationController
      skip_before_action :authenticate_user!
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
    end
  end
end
