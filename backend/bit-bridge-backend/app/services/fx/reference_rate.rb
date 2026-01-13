# frozen_string_literal: true

module Fx
  class ReferenceRate
    def self.quote(from_currency:, to_currency: 'USD')
      from = from_currency.to_s.upcase
      to = to_currency.to_s.upcase
      return nil if from.blank? || to.blank?
      return 1.to_d if from == to

      setting = FxSetting.current
      rates = setting.provider_rates.is_a?(Hash) ? setting.provider_rates : {}
      return nil if rates.blank?

      from_rate = rates[from]
      to_rate = rates[to] || (to == 'USD' ? 1 : nil)
      return nil if from_rate.blank? || to_rate.blank?

      from_rate = BigDecimal(from_rate.to_s)
      to_rate = BigDecimal(to_rate.to_s)
      return nil if from_rate.zero?

      (to_rate / from_rate).round(6)
    rescue StandardError
      nil
    end
  end
end
