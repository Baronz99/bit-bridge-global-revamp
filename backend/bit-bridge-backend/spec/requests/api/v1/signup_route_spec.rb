# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Signup route", type: :request do
  it "does not fail with missing controller constant" do
    host! "localhost"
    post "/api/v1/signup", params: {}, headers: { "ACCEPT" => "application/json" }

    expect(response.content_type).to include("application/json")
    expect(response).not_to have_http_status(:not_found)
    expect(response).to have_http_status(:unprocessable_entity)
    expect(JSON.parse(response.body)).to include("status")
    expect(JSON.parse(response.body)).to include("debug")
    expect(JSON.parse(response.body).fetch("debug")).to include("errors")
    expect(response.body).not_to include("ActionController::RoutingError")
    expect(response.body).not_to include("uninitialized constant Api::V1::Users::RegistrationsController")
  end
end
