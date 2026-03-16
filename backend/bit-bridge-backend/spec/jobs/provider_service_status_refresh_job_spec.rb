# frozen_string_literal: true

require 'rails_helper'

RSpec.describe ProviderServiceStatusRefreshJob, type: :job do
  def create_bill_order(user:, biller:, service_type:, status:)
    BillOrder.create!(
      user: user,
      meter_number: '08012345678',
      meter_type: 'PREPAID',
      address: 'Test Address',
      name: 'Test User',
      tariff_class: 'A',
      service_type: service_type,
      email: user.email,
      amount: 1000,
      phone: '08012345678',
      biller: biller,
      description: 'Service test',
      payment_type: 'online',
      payment_method: 'wallet',
      status: status
    )
  end

  it 'uses BuyPower reliability-index payload for persisted provider statuses' do
    now = Time.current.change(usec: 0)
    payload = {
      'status' => 'ok',
      'message' => 'Successful',
      'data' => [
        {
          'vertical' => 'DATA',
          'disco_code' => 'MTN',
          'success_percentage' => 98,
          'pending_percentage' => 0,
          'failure_percentage' => 2,
          'provider_online' => true
        },
        {
          'vertical' => 'ELECTRICITY',
          'disco_code' => 'ABAPOWER',
          'success_percentage' => 100,
          'pending_percentage' => 0,
          'failure_percentage' => 0,
          'provider_online' => false
        }
      ]
    }

    service = instance_double(BuyPowerPaymentService)
    allow(BuyPowerPaymentService).to receive(:new).and_return(service)
    allow(service).to receive(:reliability_index).and_return(status: 'success', response: payload)

    result = described_class.perform_now(now: now)

    expect(result[:refreshed]).to eq(2)

    mtn_data = ProviderServiceStatus.find_by!(provider: 'buypower', service_key: 'MTN_DATA')
    expect(mtn_data.state).to eq('available')
    expect(mtn_data.reliability_percent).to eq(98)
    expect(mtn_data.sample_size).to be >= 10

    aba_power = ProviderServiceStatus.find_by!(provider: 'buypower', service_key: 'ABAPOWER_ELECTRICITY')
    expect(aba_power.state).to eq('down')
    expect(aba_power.reliability_percent).to eq(100)
    expect(aba_power.sample_size).to be >= 10
  end

  it 'falls back to local inference when BuyPower reliability-index fails' do
    user = create(:user)

    12.times do
      create_bill_order(user: user, biller: 'mtn', service_type: 'VTU', status: 'failed')
    end
    now = 1.minute.from_now.change(usec: 0)

    service = instance_double(BuyPowerPaymentService)
    allow(BuyPowerPaymentService).to receive(:new).and_return(service)
    allow(service).to receive(:reliability_index).and_return(status: 'error', response: 'timeout')

    result = described_class.perform_now(now: now)

    expect(result[:refreshed]).to eq(1)
    row = ProviderServiceStatus.find_by!(provider: 'buypower', service_key: 'MTN_VTU')
    expect(row.state).to eq('down')
    expect(row.reliability_percent).to eq(0)
    expect(row.sample_size).to eq(12)
  end

  it 'publishes a recovery notification when a subscribed provider returns to available' do
    user = create(:user)
    ServiceStatusSubscription.create!(
      user: user,
      provider: 'buypower',
      service_key: 'ABUJA_ELECTRICITY',
      channel: 'push',
      active: true,
      expires_at: 3.days.from_now
    )
    ProviderServiceStatus.create!(
      provider: 'buypower',
      service_key: 'ABUJA_ELECTRICITY',
      state: 'down',
      reliability_percent: 20,
      sample_size: 25,
      window_started_at: 45.minutes.ago,
      window_ended_at: 15.minutes.ago
    )

    payload = {
      'status' => 'ok',
      'message' => 'Successful',
      'data' => [
        {
          'vertical' => 'ELECTRICITY',
          'disco_code' => 'ABUJA',
          'success_percentage' => 97,
          'failure_percentage' => 3,
          'provider_online' => true
        }
      ]
    }

    service = instance_double(BuyPowerPaymentService)
    allow(BuyPowerPaymentService).to receive(:new).and_return(service)
    allow(service).to receive(:reliability_index).and_return(status: 'success', response: payload)

    described_class.perform_now(now: Time.current.change(usec: 0))

    event = user.notification_events.order(:created_at).last
    expect(event).to be_present
    expect(event.event_type).to eq('service.status.restored')
    expect(event.state).to eq('available')
  end
end
