# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Admin pricing spec', type: :request do
  let(:super_admin) { create(:user, role: 'super_admin') }
  let(:headers) { auth_headers(super_admin) }

  it 'returns pricing spec for super admin' do
    get '/api/v1/admin/pricing-spec', headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body.dig('data', 'cards', 'new_fees')).to be_present
  end

  it 'forbids non-super admin' do
    admin = create(:user, role: 'admin')
    get '/api/v1/admin/pricing-spec', headers: auth_headers(admin)

    expect(response).to have_http_status(:forbidden)
  end
end
