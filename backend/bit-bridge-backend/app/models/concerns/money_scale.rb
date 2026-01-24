# frozen_string_literal: true

module MoneyScale
  SCALE = 2

  def self.normalize(value)
    return if value.nil? || value == ''

    BigDecimal(value.to_s).round(SCALE)
  end

  def self.valid_scale?(value)
    return true if value.nil?

    decimal = BigDecimal(value.to_s)
    decimal == decimal.round(SCALE)
  rescue ArgumentError
    false
  end
end
