# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Confirmation route", type: :request do
  it "does not fail with missing controller constant" do
    host! "localhost"
    get "/api/v1/confirmation", params: { confirmation_token: "invalid-token" }, headers: { "ACCEPT" => "application/json" }

    expect(response).not_to have_http_status(:not_found)
    expect(response.body).not_to include("uninitialized constant Api::V1::Users::ConfirmationsController")
  end
end

