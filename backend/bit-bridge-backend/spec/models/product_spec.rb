# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Product, type: :model do
  it 'is valid with the minimum required attributes' do
    product = described_class.new(provider: 'MTN', category: 'mobile provider', currency: 'ngn', rate: 1)

    expect(product).to be_valid
  end

  it 'strips provider whitespace before validation' do
    product = described_class.create!(provider: '  MTN  ', category: 'mobile provider', currency: 'ngn', rate: 1)

    expect(product.provider).to eq('MTN')
  end

  it 'requires a provider' do
    product = described_class.new(category: 'mobile provider', currency: 'ngn', rate: 1)

    expect(product).not_to be_valid
    expect(product.errors[:provider]).to include("can't be blank")
  end

  it 'requires a positive integer rate when present' do
    product = described_class.new(provider: 'MTN', category: 'mobile provider', currency: 'ngn', rate: 0)

    expect(product).not_to be_valid
    expect(product.errors[:rate]).to include('must be greater than 0')
  end
end
