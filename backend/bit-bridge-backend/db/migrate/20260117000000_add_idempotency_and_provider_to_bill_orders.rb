# frozen_string_literal: true

class AddIdempotencyAndProviderToBillOrders < ActiveRecord::Migration[7.0]
  def change
    add_column :bill_orders, :idempotency_key, :string
    add_column :bill_orders, :provider_reference, :string
    add_column :bill_orders, :provider_response, :jsonb

    add_index :bill_orders,
              %i[user_id idempotency_key],
              unique: true,
              where: "idempotency_key IS NOT NULL",
              name: "index_bill_orders_on_user_id_and_idempotency_key"
  end
end
