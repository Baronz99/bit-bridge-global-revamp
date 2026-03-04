# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Notifications::EventPublisher do
  describe '.call' do
    it 'deduplicates by idempotency key' do
      user = create(:user, :confirmed)

      payload = {
        user: user,
        event_type: 'transfer.status.changed',
        resource_type: 'transaction',
        resource_id: SecureRandom.uuid,
        reference: 'ref-123',
        state: 'completed',
        title: 'Transfer completed',
        body: 'Your transfer completed successfully.',
        deeplink: '/transaction/receipt?reference=ref-123',
        priority: 'high',
        idempotency_key: 'event-key-123'
      }

      first = described_class.call(**payload)
      second = described_class.call(**payload)

      expect(first).to be_present
      expect(second).to be_present
      expect(NotificationEvent.where(idempotency_key: 'event-key-123').count).to eq(1)
    end
  end
end
