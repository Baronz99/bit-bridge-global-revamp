# frozen_string_literal: true

module Money
  module_function

  def to_cents(amount, _currency = nil)
    return if amount.nil? || amount == ''

    decimal = BigDecimal(amount.to_s)
    rounded = decimal.round(2, :half_up)
    (rounded * 100).to_i
  end

  def from_cents(cents, _currency = nil)
    return if cents.nil?

    BigDecimal(cents.to_s) / 100
  end
end
