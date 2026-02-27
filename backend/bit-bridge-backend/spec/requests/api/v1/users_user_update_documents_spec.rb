# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Users user_update document flow', type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers(user) }

  before do
    user.create_user_profile!(
      first_name: 'Cynthia',
      last_name: 'Okafor',
      phone_number: '08102312186',
      date_of_birth: Date.new(1995, 3, 17),
      address_line1: '7 Christ avenue',
      city: 'Port Harcourt',
      state: 'Rivers state',
      country: 'Nigeria',
      postal_code: '500100'
    )
  end

  def uploaded_png(name)
    file = Tempfile.new([name, '.png'])
    file.binmode
    file.write("\x89PNG\r\n\x1A\n")
    file.rewind
    Rack::Test::UploadedFile.new(file.path, 'image/png', true, original_filename: "#{name}.png")
  end

  it 'accepts nin + proof_of_address upload without mass-assigning attachment on user' do
    proof = uploaded_png('proof')

    patch '/api/v1/users/user_update',
          params: {
            user: {
              id_type: 'nin',
              id_number: '24537508521',
              user_profile_attributes: {
                id: user.user_profile.id,
                address_line1: '7 Christ avenue',
                city: 'Port Harcourt',
                state: 'Rivers',
                country: 'Nigeria',
                postal_code: '500100',
                proof_of_address_type: 'utility_bill'
              },
              proof_of_address: proof
            }
          },
          headers: headers

    expect(response).to have_http_status(:ok)
    user.reload
    profile = user.user_profile.reload
    expect(user.id_type).to eq('nin')
    expect(user.id_number).to eq('24537508521')
    expect(profile.proof_of_address_type).to eq('utility_bill')
    expect(profile.proof_of_address).to be_attached
  end
end
