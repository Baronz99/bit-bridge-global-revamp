# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Core::Catalog::ServiceCatalogQuery do
  it 'returns only entries for the requested section' do
    bridge_product = Product.create!(provider: 'mtn', category: 'mobile provider', currency: 'ngn', rate: 1)
    Provision.create!(
      product: bridge_product,
      name: 'Airtime',
      currency: 'ngn',
      provision_value_type: 'range',
      service_type: 'VTU',
      value_range: [50, 50_000]
    )

    tunnel_product = Product.create!(provider: 'amazon', category: 'gift card', currency: 'usd', rate: 1)
    Provision.create!(
      product: tunnel_product,
      name: 'Amazon Gift Card',
      currency: 'usd',
      provision_value_type: 'fixed',
      value: 100,
      min_value: 100,
      max_value: 100,
      value_range: [100, 100]
    )

    result = described_class.new(section: 'bridge').call

    matching = result.select { |entry| entry[:provider] == 'mtn' && entry[:service_type] == 'VTU' }

    expect(result).to all(include(section: 'bridge'))
    expect(matching.size).to eq(1)
  end

  it 'filters by category when requested' do
    mobile_product = Product.create!(provider: 'airtel', category: 'mobile provider', currency: 'ngn', rate: 1)
    Provision.create!(
      product: mobile_product,
      name: 'Data',
      currency: 'ngn',
      provision_value_type: 'range',
      service_type: 'DATA',
      value_range: [50, 100_000]
    )

    utility_product = Product.create!(provider: 'dstv', category: 'utility', currency: 'ngn', rate: 1)
    Provision.create!(
      product: utility_product,
      name: 'Cable Subscription',
      currency: 'ngn',
      provision_value_type: 'range',
      service_type: 'TV',
      value_range: [100, 200_000]
    )

    result = described_class.new(category: 'utility').call

    expect(result.size).to eq(1)
    expect(result.first[:category]).to eq('utility')
    expect(result.first[:service_type]).to eq('TV')
  end
end
