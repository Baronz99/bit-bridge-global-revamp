# frozen_string_literal: true

class BillOrderSerializer < ActiveModel::Serializer
  attributes :id, :status, :meter_number, :amount, :biller, :meter_type, :phone, :service_type, :payment_type, :email,
             :payment_method, :tariff_class, :name, :service_charge, :total_amount, :created_at, :transaction_id, :units, :token, :description, :bill_commission, :reason,
             :provider_response,
             :receipt_reference

  def receipt_reference
    object.transaction_record&.reference
  end

  def provider_response
    return nil unless object.provider_response
    return object.provider_response if !Rails.env.production? || ENV['DEBUG_PROVIDER_RESPONSE'].to_s == '1'

    sanitize_provider_response(object.provider_response)
  end

  private

  def sanitize_provider_response(raw)
    payload = raw.is_a?(Hash) ? raw : {}
    allowed = %w[data result message status responseCode error]
    filtered = payload.slice(*allowed)
    deep_mask_digits(filtered)
  end

  def deep_mask_digits(value)
    case value
    when Hash
      value.transform_values { |v| deep_mask_digits(v) }
    when Array
      value.map { |v| deep_mask_digits(v) }
    when String
      value.gsub(/\d{6,}/) { |m| ('*' * [m.length - 4, 0].max) + m[-4, 4] }
    else
      value
    end
  end
end
