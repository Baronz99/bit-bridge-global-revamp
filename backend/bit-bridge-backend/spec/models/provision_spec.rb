# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Provision, type: :model do
  let(:product) { Product.create!(provider: 'DSTV', category: 'utility', currency: 'ngn', rate: 1) }
  let(:mobile_product) { Product.create!(provider: 'MTN', category: 'mobile provider', currency: 'ngn', rate: 1) }

  it 'normalizes legacy service type aliases' do
    provision = described_class.create!(
      product: product,
      name: 'Cable Subscription',
      currency: 'ngn',
      provision_value_type: 'range',
      service_type: 'CABLE',
      value_range: [100, 200_000]
    )

    expect(provision.service_type).to eq('TV')
    expect(provision.min_value).to eq('100.0')
    expect(provision.max_value).to eq('200000.0')
  end

  it 'rejects non-numeric value ranges' do
    provision = described_class.new(
      product: product,
      name: 'Cable Subscription',
      currency: 'ngn',
      provision_value_type: 'range',
      service_type: 'TV',
      value_range: ['100', 'oops']
    )

    expect(provision).not_to be_valid
    expect(provision.errors[:value_range]).to include('must contain only numeric values')
  end

  it 'rejects a minimum above the maximum' do
    provision = described_class.new(
      product: product,
      name: 'Cable Subscription',
      currency: 'ngn',
      provision_value_type: 'range',
      service_type: 'TV',
      min_value: 2000,
      max_value: 1000
    )

    expect(provision).not_to be_valid
    expect(provision.errors[:min_value]).to include('must be less than or equal to max value')
  end

  it 'rejects service types that do not match the product category' do
    provision = described_class.new(
      product: mobile_product,
      name: 'Airtime',
      currency: 'ngn',
      provision_value_type: 'range',
      service_type: 'TV',
      value_range: [50, 50_000]
    )

    expect(provision).not_to be_valid
    expect(provision.errors[:service_type]).to include('is not valid for mobile provider')
  end

  it 'requires a product' do
    provision = described_class.new(
      name: 'Airtime',
      currency: 'ngn',
      provision_value_type: 'range',
      service_type: 'VTU',
      value_range: [50, 50_000]
    )

    expect(provision).not_to be_valid
    expect(provision.errors[:product]).to include("can't be blank")
  end
end
