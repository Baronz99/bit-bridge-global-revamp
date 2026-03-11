# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Core::Catalog::ServicePolicy do
  it 'maps electricity provisions into bridge catalog metadata' do
    product = Product.create!(provider: 'ikeja-electric', category: 'power', currency: 'ngn', rate: 1)
    provision = Provision.create!(
      product: product,
      name: 'Power Token',
      currency: 'ngn',
      provision_value_type: 'range',
      service_type: 'POWER',
      value_range: [500, 50_000]
    )

    result = described_class.new(product: product, provision: provision).call

    expect(result[:service_type]).to eq('ELECTRICITY')
    expect(result[:section]).to eq('bridge')
    expect(result[:launcher_route]).to eq('/dashboard/utilities/buy-power')
    expect(result[:admin_route]).to eq('/admin/products?category=power')
  end

  it 'falls back to tunnel for usd catalog products without a mapped service type' do
    product = Product.create!(provider: 'amazon', category: 'gift card', currency: 'usd', rate: 1)
    provision = Provision.create!(
      product: product,
      name: 'Amazon Gift Card',
      currency: 'usd',
      provision_value_type: 'fixed',
      value: 100,
      min_value: 100,
      max_value: 100,
      value_range: [100, 100]
    )

    result = described_class.new(product: product, provision: provision).call

    expect(result[:section]).to eq('tunnel')
    expect(result[:route]).to eq('/dashboard/tunnel')
    expect(result[:launcher_route]).to be_nil
  end
end
