# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Account resolve', type: :request do
  let(:user) { create(:user, :tier2) }

  it 'returns 422 for invalid account number' do
    post '/api/v1/accounts/resolve',
         params: { account: { account_number: '123', bank_code: '000' } },
         headers: auth_headers(user)

    expect(response).to have_http_status(:unprocessable_entity)
    body = JSON.parse(response.body)
    expect(body['message']).to eq('account_number must be 10 digits')
  end

  it 'returns resolved account name details' do
    anchor_service = instance_double(AnchorService)
    allow(AnchorService).to receive(:new).and_return(anchor_service)
    allow(anchor_service).to receive(:resolve_account_name).and_return(
      status: :ok,
      account_name: 'Jane Doe',
      bank_name: 'Test Bank'
    )

    post '/api/v1/accounts/resolve',
         params: { account: { account_number: '1234567890', bank_code: '000' } },
         headers: auth_headers(user)

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body).to include(
      'account_name' => 'Jane Doe',
      'bank_name' => 'Test Bank',
      'bank_code' => '000'
    )
  end
end
