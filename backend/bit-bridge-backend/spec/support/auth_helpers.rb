# frozen_string_literal: true

module AuthHelpers
  def auth_headers(user)
    token, = Warden::JWTAuth::UserEncoder.new.call(user, :user, nil)
    {
      'Authorization' => "Bearer #{token}",
      'Accept' => 'application/json'
    }
  end
end
