# frozen_string_literal: true

module AuthHelpers
  def auth_headers(user)
    if user.respond_to?(:confirmed?) && !user.confirmed?
      user.update_column(:confirmed_at, Time.current)
    end

    token, = Warden::JWTAuth::UserEncoder.new.call(user, :user, nil)
    {
      'Authorization' => "Bearer #{token}",
      'Accept' => 'application/json'
    }
  end
end
