# frozen_string_literal: true

require 'test_helper'

class TransactionRecordsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @transaction_record = transaction_records(:one)
  end

  test 'should get index' do
    get transaction_records_url, as: :json
    assert_response :success
  end

  test 'should create transaction_record' do
    assert_difference('TransactionRecord.count') do
      post transaction_records_url,
           params: { transaction_record: { paymentReference: @transaction_record.paymentReference, status: @transaction_record.status, transaction_id: @transaction_record.transaction_id } }, as: :json
    end

    assert_response :created
  end

  test 'should show transaction_record' do
    get transaction_record_url(@transaction_record), as: :json
    assert_response :success
  end

  test 'should update transaction_record' do
    patch transaction_record_url(@transaction_record),
          params: { transaction_record: { paymentReference: @transaction_record.paymentReference, status: @transaction_record.status, transaction_id: @transaction_record.transaction_id } }, as: :json
    assert_response :success
  end

  test 'should destroy transaction_record' do
    assert_difference('TransactionRecord.count', -1) do
      delete transaction_record_url(@transaction_record), as: :json
    end

    assert_response :no_content
  end
end
