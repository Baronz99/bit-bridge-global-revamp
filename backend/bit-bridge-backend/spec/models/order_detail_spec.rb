require 'rails_helper'

RSpec.describe OrderDetail, type: :model do
  describe '#add_total' do
    it 'sums numeric string amounts without raising' do
      od = described_class.new(user: create(:user))
      od.order_items.build(amount: '100', currency: 'ngn')
      allow_any_instance_of(CurrencyService).to receive(:get_calculated_rate).and_return({ rate: '1.0' })
      expect { od.add_total }.not_to raise_error
      expect(od.add_total).to be_a(BigDecimal)
      expect(od.add_total).to eq(BigDecimal('100'))
    end

    it 'adds error and returns zero when amount invalid' do
      od = described_class.new(user: create(:user))
      od.order_items.build(amount: 'abc', currency: 'ngn')
      allow_any_instance_of(CurrencyService).to receive(:get_calculated_rate).and_return({ rate: '1.0' })
      od.validate
      expect(od.add_total).to eq(BigDecimal('0'))
      expect(od.errors[:total_amount]).to be_present
    end
  end

  describe '#set_net_amount' do
    it 'computes 10% markup with decimal math' do
      od = described_class.new
      od.calculate_total = 100.0
      od.set_net_amount
      expect(od.net_total).to eq(110.0)
    end
  end
end
