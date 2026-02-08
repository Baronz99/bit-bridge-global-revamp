# frozen_string_literal: true

require 'test_helper'

class BillOrderTest < ActiveSupport::TestCase
  include ActiveJob::TestHelper

  setup do
    @previous_queue_adapter = ActiveJob::Base.queue_adapter
    ActiveJob::Base.queue_adapter = :test
  end

  teardown do
    clear_enqueued_jobs
    clear_performed_jobs
    ActiveJob::Base.queue_adapter = @previous_queue_adapter
  end

  test 'valid_status_transition allows expected electricity flow states' do
    assert BillOrder.valid_status_transition?('initialized', 'processing')
    assert BillOrder.valid_status_transition?('processing', 'completed')
    assert BillOrder.valid_status_transition?('processing', 'failed')
    assert_not BillOrder.valid_status_transition?('completed', 'processing')
    assert_not BillOrder.valid_status_transition?('failed', 'completed')
  end

  test 'infer_failure_code maps known failure reasons' do
    assert_equal 'insufficient_funds',
                 BillOrder.infer_failure_code(reason: 'Insufficient funds', status: 'failed')
    assert_equal 'minimum_vend',
                 BillOrder.infer_failure_code(reason: 'Below the minimum vend amount', status: 'failed')
    assert_equal 'provider_reference_timeout',
                 BillOrder.infer_failure_code(reason: 'provider reference was not generated before timeout', status: 'failed')
    assert_equal 'provider_timeout',
                 BillOrder.infer_failure_code(reason: 'provider timed out', status: 'timedout')
  end

  test 'enqueues receipt email when status changes to completed' do
    order = BillOrder.create!(
      user: users(:one),
      status: :initialized,
      amount: 1000,
      email: 'one@example.com',
      service_type: 'ELECTRICITY',
      biller: 'abuja'
    )

    clear_enqueued_jobs

    assert_enqueued_with(job: SendOrderReceiptJob, args: [order.id]) do
      order.update!(status: :completed)
    end
  end

  test 'does not enqueue receipt email for non-terminal status updates' do
    order = BillOrder.create!(
      user: users(:one),
      status: :initialized,
      amount: 1000,
      email: 'one@example.com',
      service_type: 'ELECTRICITY',
      biller: 'abuja'
    )

    clear_enqueued_jobs

    assert_no_enqueued_jobs only: SendOrderReceiptJob do
      order.update!(status: :processing)
    end
  end
end
