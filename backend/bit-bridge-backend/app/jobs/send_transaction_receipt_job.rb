# frozen_string_literal: true

class SendTransactionReceiptJob < ApplicationJob
  queue_as :default

  RETRY_WAIT = 30.seconds

  retry_on StandardError, wait: RETRY_WAIT, attempts: 3

  def perform(transaction_id)
    perf_start = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    transaction = Transaction.includes(:wallet, :user, :transaction_record).find_by(id: transaction_id)
    return if transaction.nil?
    return unless transaction.receipt_email_sendable?

    transaction.with_lock do
      meta = metadata_payload(transaction)
      receipt_meta = meta['receipt_email'].is_a?(Hash) ? meta['receipt_email'] : {}
      return if receipt_meta['status'] == 'sent'

      attempts = receipt_meta['attempts'].to_i + 1
      now = Time.current.utc.iso8601

      receipt_meta['attempts'] = attempts
      receipt_meta['last_attempt_at'] = now
      meta['receipt_email'] = receipt_meta
      transaction.update_columns(metadata: meta, updated_at: Time.current)
    end

    mail_start = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    TransactionReceiptMailer.receipt_email(transaction.id).deliver_now
    mail_ms = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - mail_start) * 1000.0).round(1)
    Rails.logger.info("[PERF][send_transaction_receipt_job.mail] tx_id=#{transaction.id} reference=#{transaction.transaction_record&.reference || "wallet-tx-#{transaction.id}"} mail_ms=#{mail_ms}")
    mark_sent(transaction)
    total_ms = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - perf_start) * 1000.0).round(1)
    Rails.logger.info("[PERF][send_transaction_receipt_job.perform] tx_id=#{transaction.id} total_ms=#{total_ms}")
  rescue StandardError => e
    mark_failed(transaction, e) if transaction.present?
    total_ms = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - perf_start) * 1000.0).round(1)
    Rails.logger.error("[PERF][send_transaction_receipt_job.perform] tx_id=#{transaction_id} failed=true total_ms=#{total_ms} error=#{e.class}: #{e.message}")
    raise e
  end

  private

  def mark_sent(transaction)
    transaction.with_lock do
      meta = metadata_payload(transaction)
      receipt_meta = meta['receipt_email'].is_a?(Hash) ? meta['receipt_email'] : {}
      now = Time.current.utc.iso8601

      receipt_meta['status'] = 'sent'
      receipt_meta['sent_at'] = now
      receipt_meta['last_error'] = nil
      meta['receipt_email'] = receipt_meta

      transaction.update_columns(metadata: meta, updated_at: Time.current)
    end
  end

  def mark_failed(transaction, error)
    transaction.with_lock do
      meta = metadata_payload(transaction)
      receipt_meta = meta['receipt_email'].is_a?(Hash) ? meta['receipt_email'] : {}

      receipt_meta['status'] = 'failed'
      receipt_meta['last_error'] = "#{error.class}: #{error.message}".truncate(300)
      meta['receipt_email'] = receipt_meta

      transaction.update_columns(metadata: meta, updated_at: Time.current)
    end
  end

  def metadata_payload(transaction)
    raw = transaction.metadata
    return raw if raw.is_a?(Hash)
    return {} if raw.blank?

    JSON.parse(raw)
  rescue StandardError
    {}
  end
end
