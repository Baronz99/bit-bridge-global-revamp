# frozen_string_literal: true

class ElectricBillOrderSerializer < ActiveModel::Serializer
  attributes :id, :billersCode, :amount, :request_id, :variation_code, :phone, :serviceID, :email, :type,
             :transaction_id, :status, :total_amount
end
