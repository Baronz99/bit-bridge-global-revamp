# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Money do
  it 'converts NGN major units to cents' do
    expect(described_class.to_cents(100.00, 'NGN')).to eq(10_000)
  end
end
