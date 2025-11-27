# frozen_string_literal: true

class AccountSerializer < ActiveModel::Serializer
  attributes :id, :status, :account_name, :bank_name, :dob, :state, :city, :account_number, :vendor, :useable_id
end
