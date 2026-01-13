# frozen_string_literal: true

module Pricing
  class Engine
    MIN_TRANSFER_AMOUNT_NGN = 150

    def self.transfer_fee_ngn(amount_ngn)
      amount = BigDecimal(amount_ngn.to_s)

      if amount <= 1999
        BigDecimal('55')
      elsif amount <= 9_999
        BigDecimal('76.8')
      elsif amount <= 49_999
        BigDecimal('126.8')
      else
        BigDecimal('150')
      end
    end

    def self.stamp_duty_ngn(amount_ngn)
      amount = BigDecimal(amount_ngn.to_s)
      amount >= 10_000 ? BigDecimal('50') : BigDecimal('0')
    end

    def self.transfer_fee_breakdown_ngn(amount_ngn)
      total_fee = transfer_fee_ngn(amount_ngn)
      stamp_duty_fee = stamp_duty_ngn(amount_ngn)
      platform_fee = total_fee - stamp_duty_fee

      {
        platform_fee: platform_fee,
        stamp_duty_fee: stamp_duty_fee,
        total_fee: total_fee
      }
    end
  end
end
