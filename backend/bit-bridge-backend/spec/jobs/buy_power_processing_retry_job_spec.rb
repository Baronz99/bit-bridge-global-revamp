# frozen_string_literal: true

require 'rails_helper'

RSpec.describe BuyPowerProcessingRetryJob, type: :job do
  include ActiveJob::TestHelper

  it 'does not enqueue BuyPower reconcile for anchor transfer shadow orders' do
    user = create(:user)
    order = BillOrder.create!(
      user: user,
      meter_number: SecureRandom.uuid,
      meter_type: 'PREPAID',
      address: 'Anchor transfer hold',
      name: 'Anchor transfer',
      tariff_class: 'A',
      service_type: 'OTHER',
      email: user.email,
      amount: 1035,
      total_amount: 1035,
      phone: '0000000000',
      biller: 'Anchor',
      description: 'Anchor NGN transfer hold',
      payment_type: 'online',
      payment_method: 'wallet',
      status: 'processing',
      provider_response: { 'source' => 'anchor_transfer' }
    )

    expect { described_class.perform_now(order.id) }
      .not_to have_enqueued_job(BuyPowerReconcileJob)
  end
end
