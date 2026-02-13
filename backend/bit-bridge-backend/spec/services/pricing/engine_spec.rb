# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Pricing::Engine do
  describe '.transfer_fee_breakdown_ngn' do
    it 'applies the correct fee tiers and stamp duty' do
      expect(described_class.transfer_fee_breakdown_ngn(1_000).transform_values(&:to_f)).to eq(
        platform_fee: 35.0,
        stamp_duty_fee: 0.0,
        total_fee: 35.0
      )

      expect(described_class.transfer_fee_breakdown_ngn(2_000).transform_values(&:to_f)).to eq(
        platform_fee: 35.0,
        stamp_duty_fee: 0.0,
        total_fee: 35.0
      )

      expect(described_class.transfer_fee_breakdown_ngn(9_999).transform_values(&:to_f)).to eq(
        platform_fee: 35.0,
        stamp_duty_fee: 0.0,
        total_fee: 35.0
      )

      expect(described_class.transfer_fee_breakdown_ngn(10_000).transform_values(&:to_f)).to eq(
        platform_fee: 35.0,
        stamp_duty_fee: 50.0,
        total_fee: 85.0
      )

      expect(described_class.transfer_fee_breakdown_ngn(49_999).transform_values(&:to_f)).to eq(
        platform_fee: 35.0,
        stamp_duty_fee: 50.0,
        total_fee: 85.0
      )

      expect(described_class.transfer_fee_breakdown_ngn(50_000).transform_values(&:to_f)).to eq(
        platform_fee: 50.0,
        stamp_duty_fee: 50.0,
        total_fee: 100.0
      )
    end
  end
end
