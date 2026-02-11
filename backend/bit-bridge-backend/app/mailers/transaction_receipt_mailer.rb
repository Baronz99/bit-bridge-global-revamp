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
    @profile = transaction_profile(@transaction, @anchor_details)
    @kind_label = @profile[:kind_label]
    @email_header = @profile[:header]
    @email_subheader = @profile[:subheader]
    @balance_snapshot = resolve_balance_snapshot(@transaction)

    attach_brand_logo

    mail(
      to: @user.email,
      subject: "BitBridge Global - #{@profile[:subject]} (##{@receipt_reference})"
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

  def transaction_profile(transaction, anchor_details)
    metadata = transaction.metadata.is_a?(Hash) ? transaction.metadata : {}
    record = transaction.transaction_record
    provider = metadata['provider'].to_s.downcase
    subtype = metadata['subtype'].to_s.downcase
    event_type = record&.event_type.to_s.downcase

    if transaction.conversion_transaction?
      direction = @fx_quote&.direction.to_s
      conversion_label =
        case direction
        when 'ngn_to_usd' then 'NGN to USD'
        when 'usd_to_ngn' then 'USD to NGN'
        else 'Wallet Conversion'
        end

      return {
        subject: 'Conversion Receipt',
        kind_label: 'FX Conversion',
        header: 'Conversion Completed',
        subheader: "#{conversion_label} conversion settled successfully."
      }
    end

    if provider == 'anchor' && transaction.deposit?
      return {
        subject: 'Inbound Transfer Receipt',
        kind_label: 'Inbound Bank Transfer',
        header: 'Inbound Transfer Settled',
        subheader: "Funds received from #{anchor_details&.dig(:sender_name) || 'bank transfer'}."
      }
    end

    if provider == 'anchor' && transaction.transaction_type.to_s == 'withdrawal' && subtype == 'principal'
      return {
        subject: 'Outbound Transfer Receipt',
        kind_label: 'Outbound Bank Transfer',
        header: 'Outbound Transfer Completed',
        subheader: 'Your transfer has been processed successfully.'
      }
    end

    if transaction.deposit? && event_type.start_with?('checkout')
      return {
        subject: 'Wallet Funding Receipt',
        kind_label: 'Wallet Funding',
        header: 'Wallet Funding Completed',
        subheader: 'Your checkout payment has been posted to your wallet.'
      }
    end

    if transaction.deposit?
      return {
        subject: 'Wallet Credit Receipt',
        kind_label: 'Wallet Credit',
        header: 'Wallet Credit Posted',
        subheader: 'Funds were added to your wallet successfully.'
      }
    end

    {
      subject: 'Wallet Debit Receipt',
      kind_label: 'Wallet Debit',
      header: 'Wallet Debit Posted',
      subheader: 'Funds were debited from your wallet successfully.'
    }
  end

  def resolve_balance_snapshot(transaction)
    if transaction.respond_to?(:before_book_balance) && transaction.before_book_balance.present?
      return {
        before_book: transaction.before_book_balance,
        after_book: transaction.after_book_balance,
        before_available: transaction.before_available_balance,
        after_available: transaction.after_available_balance
      }
    end

    nil
  end
end
