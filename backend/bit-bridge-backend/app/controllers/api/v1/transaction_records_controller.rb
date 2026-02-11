# frozen_string_literal: true

module Api
  module V1
    class TransactionRecordsController < ApplicationController
      before_action :set_transaction_record, only: %i[show update destroy]
      skip_before_action :authenticate_user!, only: %i[index]

      # GET /transaction_records
      def index
        @transaction_records = TransactionRecord.all
        render json: @transaction_records
      end

      # GET /transaction_records/:id
      #
      # IMPORTANT:
      # This endpoint must return a consistent receipt payload across:
      # - bbg-* (bill orders)
      # - fbg-* (deposits)
      #
      # Otherwise the mobile app will accidentally use exchange UUID as reference
      # and then fail to load receipt by reference (404).
      def show
        with_perf_trace('transaction_records.show', reference: params[:id].to_s) do
          ref = @transaction_record.reference.to_s
          record_type = ref.split('-').first

        item =
          if record_type == 'bbg'
            @transaction_record.bill_order
          else
            @transaction_record.exchange
          end

        unless item
          return render json: { message: 'Record item not found', reference: ref }, status: :not_found
        end

        # Base object from the underlying item
        payload = item.as_json

        # Always include the TransactionRecord.reference (fbg-xxxx / bbg-xxxx)
        payload['reference'] = ref
        payload['record_type'] = record_type

        # Prefer TransactionRecord for these fields (because webhooks write them there)
        payload['transaction_record'] = {
          id: @transaction_record.id,
          reference: ref,
          transaction_id: @transaction_record.try(:transaction_id),
          status: @transaction_record.try(:status),
          amount: @transaction_record.try(:amount),
          customer_name: @transaction_record.try(:customer_name),
          description: @transaction_record.try(:description),
          account_number: @transaction_record.try(:account_number),
          account_name: @transaction_record.try(:customer_name) || @transaction_record.try(:account_name),
          bank: @transaction_record.try(:bank),
          bank_code: @transaction_record.try(:bank_code),
          event_type: @transaction_record.try(:event_type),
          response_code: @transaction_record.try(:response_code),
          response_message: @transaction_record.try(:response_message),
          provider_error_category: @transaction_record.try(:provider_error_category),
          created_at: @transaction_record.created_at,
          updated_at: @transaction_record.updated_at
        }

        # A stable receipt meta object that mobile can rely on.
        # (UI should NOT say "bank grade" — just "Receipt details".)
        payload['receipt_meta'] = {
          channel: (record_type == 'fbg' ? 'monnify' : payload['payment_method'] || payload['channel']),
          beneficiary: @transaction_record.try(:customer_name) || payload['beneficiary'] || payload['beneficiary_name'],
          bank_name: @transaction_record.try(:bank) || payload['bank'] || payload['bank_name'],
          account_number: @transaction_record.try(:account_number) || payload['account_number'] || payload['address'],
          provider_reference: @transaction_record.try(:transaction_id) || payload['unique_transaction_id'] || payload['transfer_id'],
          session_id: payload.dig('metadata', 'nibss_session_id') || payload['nibss_session_id'] || payload['session_id']
        }

        # Optional: include fees if present anywhere (stamp duty etc)
        fees =
          payload['fees'] ||
          payload['fee'] ||
          payload['charges'] ||
          payload.dig('metadata', 'fees') ||
          payload.dig('metadata', 'fee') ||
          payload.dig('metadata', 'charges') ||
          payload.dig('metadata', 'stamp_duty')

        payload['fees'] = fees if fees.present?

          render json: { data: payload }, status: :ok
        end
      end

      # POST /transaction_records
      def create
        @transaction_record = TransactionRecord.new(transaction_record_params)

        if @transaction_record.save
          render json: @transaction_record, status: :created, location: @transaction_record
        else
          render json: @transaction_record.errors, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /transaction_records/:id
      def update
        if @transaction_record.update(transaction_record_params)
          render json: @transaction_record
        else
          render json: @transaction_record.errors, status: :unprocessable_entity
        end
      end

      # DELETE /transaction_records/:id
      def destroy
        @transaction_record.destroy!
      end

      private

      def set_transaction_record
        @transaction_record = TransactionRecord.find_by(reference: params[:id])

        return if @transaction_record.present?

        render json: { message: 'Record does not exist' }, status: :not_found
        nil
      end

      def transaction_record_params
        params.require(:transaction_record).permit(
          :transaction_id,
          :status,
          :reference,
          :amount,
          :customer_name,
          :email,
          :description,
          :phone_number,
          :redirect_url,
          :account_number,
          :bank,
          :bank_code,
          :event_type,
          :response_code,
          :response_message,
          :provider_error_category
        )
      end

      def with_perf_trace(label, metadata = {})
        return yield unless perf_trace_enabled?

        start = Process.clock_gettime(Process::CLOCK_MONOTONIC)
        sql_count = 0
        sql_time_ms = 0.0
        callback = lambda do |_name, started, finished, _unique_id, payload|
          next if payload[:name] == 'SCHEMA' || payload[:cached]

          sql_count += 1
          sql_time_ms += (finished - started) * 1000.0
        end

        result = nil
        ActiveSupport::Notifications.subscribed(callback, 'sql.active_record') do
          result = yield
        end
        total_ms = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - start) * 1000.0).round(1)
        Rails.logger.info("[PERF][#{label}] total_ms=#{total_ms} sql_count=#{sql_count} sql_ms=#{sql_time_ms.round(1)} meta=#{metadata.inspect}")
        result
      end

      def perf_trace_enabled?
        Rails.env.development? || ActiveModel::Type::Boolean.new.cast(ENV['DEBUG_PERF'])
      end
    end
  end
end
