# frozen_string_literal: true

require 'rails_helper'

RSpec.describe ReconcileUnmatchedAnchorInboundTransfersJob, type: :job do
  it 'reprocesses unmatched inbound transfers with force mode' do
    inbound = InboundBankTransfer.create!(
      provider: 'anchor',
      provider_reference: 'inb_unmatched_1',
      amount_cents: 10_000,
      currency: 'NGN',
      status: 'unmatched',
      raw_payload: {
        'type' => 'payin.received',
        'attributes' => {
          'payIn' => {
            'id' => 'inb_unmatched_1',
            'reference' => 'BBG-AAAA11-ZZ99',
            'amount' => '10000',
            'currency' => 'NGN',
            'narration' => 'BBG-AAAA11-ZZ99 test'
          }
        }
      }
    )

    expect(AnchorWebhookProcessor).to receive(:call).with(hash_including(payload: inbound.raw_payload, force: true))

    described_class.perform_now(limit: 10, lookback_hours: 24)
  end
end
