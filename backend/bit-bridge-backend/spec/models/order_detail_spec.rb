require 'rails_helper'

RSpec.describe OrderDetail, type: :model do
  describe '#set_net_amount' do
    it 'computes net_total with 10% markup using decimal math' do
      od = described_class.new
      od.calculate_total = 100.0
      od.set_net_amount
      expect(od.net_total).to eq(110.0)
    end
  end
end
