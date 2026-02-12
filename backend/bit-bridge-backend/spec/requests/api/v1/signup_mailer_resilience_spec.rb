# frozen_string_literal: true

require "rails_helper"
require "securerandom"

RSpec.describe "Signup mailer resilience", type: :request do
  it "does not return 500 when confirmation delivery enqueue fails" do
    host! "localhost"
    allow_any_instance_of(ActionMailer::MessageDelivery).to receive(:deliver_later)
      .and_raise(StandardError, "mail queue unavailable")

    post "/api/v1/signup",
         params: {
           user: {
             email: "resilience_#{SecureRandom.hex(6)}@example.com",
             password: "password123",
             password_confirmation: "password123"
           }
         },
         headers: { "ACCEPT" => "application/json" }

    expect(response).not_to have_http_status(:internal_server_error)
    expect(response).to have_http_status(:ok)
  end
end

