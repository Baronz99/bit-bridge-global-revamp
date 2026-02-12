# frozen_string_literal: true

require "rails_helper"

RSpec.describe "API V1 confirmation routing", type: :routing do
  it "routes GET /api/v1/confirmation to users/confirmations#show" do
    expect(get: "/api/v1/confirmation")
      .to route_to(controller: "users/confirmations", action: "show", format: :json)
  end
end

