# frozen_string_literal: true

class BillOrderSerializer < ActiveModel::Serializer
  attributes :id, :status, :meter_number, :amount, :biller, :meter_type, :phone, :service_type, :payment_type, :email,
             :payment_method, :tariff_class, :name, :service_charge, :total_amount, :created_at, :transaction_id, :units, :token, :description, :bill_commission, :reason
end
