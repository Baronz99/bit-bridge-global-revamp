# frozen_string_literal: true

module FxDesk
  module Money
    module_function

    def ngn(value)
      BigDecimal(value.to_s).round(0)
    end

    def usd(value)
      BigDecimal(value.to_s).round(2)
    end

    def rate(value)
      BigDecimal(value.to_s).round(6)
    end
  end
end
