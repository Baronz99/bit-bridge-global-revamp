# frozen_string_literal: true

require 'test_helper'

class BillOrderTest < ActiveSupport::TestCase
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
end
