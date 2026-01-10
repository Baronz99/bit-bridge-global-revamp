# frozen_string_literal: true

class AccountSerializer < ActiveModel::Serializer
  attributes :id,
             :vendor,
             :bank_name,
             :currency,
             :status,
             :created_at,
             :account_last4,
             :account_number,
             :account_name

  def account_last4
    raw = object.account_number.to_s
    return nil if raw.empty?

    raw[-4, 4]
  end

  def account_number
    return object.account_number unless admin_scope?

    account_last4 ? "****#{account_last4}" : nil
  end

  def account_name
    return object.account_name unless admin_scope?

    nil
  end

  def admin_scope?
    scope.respond_to?(:admin?) && scope.admin?
  end
end
