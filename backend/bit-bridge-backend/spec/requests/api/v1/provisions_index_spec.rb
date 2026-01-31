# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Provisions index', type: :request do
  def count_queries
    count = 0
    callback = ->(_name, _start, _finish, _id, payload) { count += 1 unless payload[:name] == 'SCHEMA' }
    ActiveSupport::Notifications.subscribed(callback, 'sql.active_record') do
      yield
    end
    count
  end

  it 'returns provisions without N+1 queries' do
    user = create(:user)

    product1 = Product.create!(provider: 'Provider 1', category: 'service')
    product2 = Product.create!(provider: 'Provider 2', category: 'utility')

    provision1 = Provision.create!(
      product: product1,
      name: 'Provision 1',
      service_type: 'VTU',
      value_range: [1, 10]
    )
    provision2 = Provision.create!(
      product: product2,
      name: 'Provision 2',
      service_type: 'TV',
      value_range: [5, 20]
    )

    order_detail = OrderDetail.create!(user: user)

    OrderItem.create!(
      product: product1,
      provision: provision1,
      order_detail: order_detail,
      amount: 10,
      quantity: 1
    )
    OrderItem.create!(
      product: product2,
      provision: provision2,
      order_detail: order_detail,
      amount: 20,
      quantity: 1
    )

    queries = count_queries do
      get '/api/v1/provisions'
    end

    expect(response).to have_http_status(:ok)
    expect(queries).to be < 20
  end
end
