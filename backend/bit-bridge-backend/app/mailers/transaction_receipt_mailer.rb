# frozen_string_literal: true

class TransactionReceiptMailer < ApplicationMailer
  def receipt_email(transaction_id)
    @transaction = Transaction.includes(:wallet, :user, :transaction_record).find(transaction_id)
    @user = @transaction.user
    return if @user&.email.blank?

    @fx_quote = resolve_fx_quote(@transaction)
    @receipt_reference = @transaction.transaction_record&.reference.presence || "wallet-tx-#{@transaction.id}"
    @frontend_url = ENV.fetch('FRONTEND_URL', 'https://www.bitbridgeglobal.com').to_s.split(',').first.to_s.strip
    @kind_label = @transaction.conversion_transaction? ? 'FX Conversion' : 'Wallet Deposit'

    attach_brand_logo

    mail(
      to: @user.email,
      subject: "BitBridge Global - #{@kind_label} Receipt (##{@receipt_reference})"
    )
  end

  private

  def resolve_fx_quote(transaction)
    meta = transaction.metadata.is_a?(Hash) ? transaction.metadata : {}
    token = meta['fx_quote_token'].to_s.strip
    return nil if token.blank?

    FxQuote.find_by(user_id: transaction.user_id, token: token)
  rescue StandardError
    nil
  end
end
