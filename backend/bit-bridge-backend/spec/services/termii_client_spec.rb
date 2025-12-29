# frozen_string_literal: true

require 'rails_helper'

RSpec.describe TermiiClient do
  around do |example|
    original = ENV.to_h
    ENV['ENABLE_TERMII'] = 'false'
    example.run
    ENV.replace(original)
  end

  it 'does not hit the external API when TERMII is disabled' do
    expect(Net::HTTP).not_to receive(:start)

    result = described_class.new.send_otp_sms!(to_e164: '2348012345678', code: '123456')

    expect(result[:ok]).to be(false)
    expect(result[:body]['error']).to eq('TERMII is disabled')
  end
end
