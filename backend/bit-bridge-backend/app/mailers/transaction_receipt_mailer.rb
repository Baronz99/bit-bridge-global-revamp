# frozen_string_literal: true

class TransactionReceiptMailer < ApplicationMailer
  def receipt_email(transaction_id)
    @transaction = Transaction.includes(:wallet, :user, :transaction_record).find(transaction_id)
    @user = @transaction.user
    return if @user&.email.blank?
    @recipient_name = recipient_display_name(user: @user)

    @fx_quote = resolve_fx_quote(@transaction)
    @anchor_details = resolve_anchor_details(@transaction)
    @receipt_reference = @transaction.transaction_record&.reference.presence || "wallet-tx-#{@transaction.id}"
    @frontend_url = ENV.fetch('FRONTEND_URL', 'https://www.bitbridgeglobal.com').to_s.split(',').first.to_s.strip
    @event_contract = Notifications::TransactionEmailEventContract.build(
      transaction: @transaction,
      anchor_details: @anchor_details,
      fx_quote: @fx_quote
    )
    @kind_label = @event_contract[:kind_label]
    @email_header = @event_contract[:header]
    @email_subheader = @event_contract[:subheader]
    @balance_snapshot = resolve_balance_snapshot(@transaction)

    attach_brand_logo

    mail(
      to: @user.email,
      subject: "BitBridge Global - #{build_subject_title(@event_contract)} (##{@receipt_reference})"
    )
  end

  private

  def build_subject_title(contract)
    currency = (@transaction.currency || @transaction.wallet&.currency || 'NGN').to_s
    amount = format('%.2f', @transaction.amount.to_f)
    "#{contract[:title]} - #{currency} #{amount}"
  end

  def resolve_fx_quote(transaction)
    meta = transaction.metadata.is_a?(Hash) ? transaction.metadata : {}
    token = meta['fx_quote_token'].to_s.strip
    return nil if token.blank?

    FxQuote.find_by(user_id: transaction.user_id, token: token)
  rescue StandardError
    nil
  end

  def resolve_anchor_details(transaction)
    metadata = transaction.metadata.is_a?(Hash) ? transaction.metadata : {}
    sender = metadata['anchor_sender'].is_a?(Hash) ? metadata['anchor_sender'] : {}
    virtual_account = metadata['anchor_virtual_account'].is_a?(Hash) ? metadata['anchor_virtual_account'] : {}
    record = transaction.transaction_record

    details = {
      payment_id: metadata['anchor_payment_id'],
      payment_reference: metadata['anchor_payment_reference'] || record&.reference,
      narration: metadata['anchor_narration'] || record&.description,
      paid_at: metadata['anchor_paid_at'],
      sender_name: sender['account_name'] || record&.customer_name,
      sender_account_number: sender['account_number'] || transaction.address,
      sender_bank_name: sender['bank_name'] || transaction.bank,
      beneficiary_account_name: virtual_account['account_name'],
      beneficiary_account_number: virtual_account['account_number'] || record&.account_number
    }.compact

    details.presence
  rescue StandardError
    nil
  end

  def resolve_balance_snapshot(transaction)
    if transaction.respond_to?(:before_available_balance) && transaction.before_available_balance.present?
      return {
        before_available: transaction.before_available_balance,
        after_available: transaction.after_available_balance
      }
    end

    nil
  end
end
