# frozen_string_literal: true

require "rails_helper"

RSpec.describe "API V1 signup routing", type: :routing do
  it "routes POST /api/v1/signup to users/registrations#create" do
    expect(post: "/api/v1/signup").to route_to(controller: "users/registrations", action: "create", format: :json)
  end
end
