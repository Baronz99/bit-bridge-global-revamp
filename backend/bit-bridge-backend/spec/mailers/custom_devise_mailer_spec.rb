# frozen_string_literal: true

require "rails_helper"
require "securerandom"

RSpec.describe CustomDeviseMailer, type: :mailer do
  it "renders confirmation instructions without raising when logo attachment is absent" do
    user = build(:user, email: "mailer_#{SecureRandom.hex(6)}@example.com")

    allow(File).to receive(:exist?).and_call_original
    allow(File).to receive(:exist?).with(Rails.root.join("app/assets/images/bitbridge-logo.png")).and_return(false)

    mail = described_class.confirmation_instructions(user, "token-123")

    expect { mail.deliver_now }.not_to raise_error
    expect(mail.subject).to eq("Confirm your account")
    expect(mail.to).to eq([user.email])
  end
end

