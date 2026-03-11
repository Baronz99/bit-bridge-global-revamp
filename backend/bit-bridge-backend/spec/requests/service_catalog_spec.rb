# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'ServiceCatalog', type: :request do
  it 'returns normalized catalog entries without authentication' do
    product = Product.create!(provider: 'dstv', category: 'utility', currency: 'ngn', rate: 1)
    Provision.create!(
      product: product,
      name: 'Cable Subscription',
      currency: 'ngn',
      provision_value_type: 'range',
      service_type: 'CABLE',
      value_range: [100, 200_000]
    )

    get '/api/v1/service_catalog'

    expect(response).to have_http_status(:ok)

    json = JSON.parse(response.body)
    expect(json['success']).to eq(true)
    expect(json['data']).not_to be_empty
    expect(json['data'].first['service_type']).to eq('TV')
    expect(json['data'].first['section']).to eq('bridge')
  end

  it 'supports section aliases through the tunnel route group' do
    product = Product.create!(provider: 'amazon', category: 'gift card', currency: 'usd', rate: 1)
    Provision.create!(
      product: product,
      name: 'Amazon Gift Card',
      currency: 'usd',
      provision_value_type: 'fixed',
      value: 100,
      min_value: 100,
      max_value: 100,
      value_range: [100, 100]
    )

    get '/api/v1/tunnel/catalog'

    expect(response).to have_http_status(:ok)

    json = JSON.parse(response.body)
    expect(json['data'].size).to eq(1)
    expect(json['data'].first['section']).to eq('tunnel')
    expect(json['data'].first['route']).to eq('/dashboard/tunnel')
  end
end
