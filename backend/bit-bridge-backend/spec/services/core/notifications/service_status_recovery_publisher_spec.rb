# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Core::Notifications::ServiceStatusRecoveryPublisher do
  it 'publishes a restored push event and deactivates the subscription' do
    user = create(:user)
    subscription = ServiceStatusSubscription.create!(
      user: user,
      provider: 'buypower',
      service_key: 'ABUJA_ELECTRICITY',
      channel: 'push',
      active: true,
      expires_at: 2.days.from_now
    )
    previous = ProviderServiceStatus.create!(
      provider: 'buypower',
      service_key: 'ABUJA_ELECTRICITY',
      state: 'down',
      reliability_percent: 15,
      sample_size: 20,
      window_started_at: 30.minutes.ago,
      window_ended_at: 15.minutes.ago
    )

    described_class.call(
      provider: 'buypower',
      previous_rows: { 'ABUJA_ELECTRICITY' => previous },
      current_rows: [
        {
          provider: 'buypower',
          service_key: 'ABUJA_ELECTRICITY',
          state: 'available',
          reliability_percent: 97,
          window_started_at: 15.minutes.ago,
          window_ended_at: Time.current
        }
      ],
      occurred_at: Time.current
    )

    event = user.notification_events.order(:created_at).last
    expect(event).to be_present
    expect(event.event_type).to eq('service.status.restored')
    expect(event.deeplink).to include('/powerProviders?service_key=ABUJA_ELECTRICITY')
    expect(subscription.reload.active).to eq(false)
    expect(subscription.last_notified_state).to eq('available')
  end
end
