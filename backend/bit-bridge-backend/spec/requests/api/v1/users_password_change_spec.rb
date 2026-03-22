# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Users password change', type: :request do
  let(:user) do
    create(
      :user,
      :confirmed,
      email: 'password-change@example.com',
      password: 'password123',
      password_confirmation: 'password123'
    )
  end
  let(:headers) { auth_headers(user) }

  it 'updates the password when the client sends current_password inside user payload' do
    patch '/api/v1/users/user_password_update',
          params: {
            user: {
              current_password: 'password123',
              password: 'newpassword456',
              confirm_password: 'newpassword456'
            }
          },
          headers: headers

    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body)['message']).to eq('pasword has been updated')
    expect(user.reload.valid_password?('newpassword456')).to eq(true)
  end
end
