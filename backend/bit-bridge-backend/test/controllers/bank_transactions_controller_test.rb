# frozen_string_literal: true

require 'test_helper'

class BankTransactionsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @bank_transaction = bank_transactions(:one)
  end

  test 'should get index' do
    get bank_transactions_url, as: :json
    assert_response :success
  end

  test 'should create bank_transaction' do
    assert_difference('BankTransaction.count') do
      post bank_transactions_url,
           params: { bank_transaction: { account_id: @bank_transaction.account_id, amount: @bank_transaction.amount, description: @bank_transaction.description, recipient_id: @bank_transaction.recipient_id, trasaction_id: @bank_transaction.trasaction_id } }, as: :json
    end

    assert_response :created
  end

  test 'should show bank_transaction' do
    get bank_transaction_url(@bank_transaction), as: :json
    assert_response :success
  end

  test 'should update bank_transaction' do
    patch bank_transaction_url(@bank_transaction),
          params: { bank_transaction: { account_id: @bank_transaction.account_id, amount: @bank_transaction.amount, description: @bank_transaction.description, recipient_id: @bank_transaction.recipient_id, trasaction_id: @bank_transaction.trasaction_id } }, as: :json
    assert_response :success
  end

  test 'should destroy bank_transaction' do
    assert_difference('BankTransaction.count', -1) do
      delete bank_transaction_url(@bank_transaction), as: :json
    end

    assert_response :no_content
  end
end
