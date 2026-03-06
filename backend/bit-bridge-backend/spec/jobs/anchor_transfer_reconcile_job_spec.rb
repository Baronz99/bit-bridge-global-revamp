# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AnchorTransferReconcileJob, type: :job do
  include ActiveJob::TestHelper

  before do
    ActiveJob::Base.queue_adapter = :test
  end

  after do
    clear_enqueued_jobs
    clear_performed_jobs
  end

  it 'enqueues debounced reconcile job when lock is acquired' do
    allow(described_class).to receive(:acquire_schedule_lock!).and_return(true)

    expect do
      described_class.enqueue_debounced!(delay: 1.minute, reason: 'spec')
    end.to have_enqueued_job(described_class)
  end

  it 're-enqueues itself when pending transfers remain after reconcile' do
    allow(Transfers::AnchorTransferReconciler).to receive(:call).and_return(
      checked: 1,
      approved: 0,
      failed: 0,
      skipped: 1,
      errors: 0
    )
    allow_any_instance_of(described_class).to receive(:pending_transfers_exist?).and_return(true)
    allow(described_class).to receive(:release_schedule_lock!)
    allow(described_class).to receive(:enqueue_debounced!).and_return(true)

    described_class.perform_now(limit: 5, min_age_seconds: 120, reason: 'spec')

    expect(described_class).to have_received(:release_schedule_lock!)
    expect(described_class).to have_received(:enqueue_debounced!).with(
      hash_including(reason: 'pending_remaining')
    )
  end
end
