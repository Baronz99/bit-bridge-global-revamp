# frozen_string_literal: true

class AddMoneyCentsColumns < ActiveRecord::Migration[7.1]
  def change
    add_column :bill_orders, :amount_cents, :bigint
    add_column :bill_orders, :total_amount_cents, :bigint
    add_column :bill_orders, :service_charge_cents, :bigint
    add_column :bill_orders, :commission_used_cents, :bigint

    add_column :transactions, :amount_cents, :bigint
    add_column :transactions, :bonus_cents, :bigint

    add_column :wallet_ledger_entries, :amount_cents, :bigint

    add_column :wallets, :commission_cents, :bigint

    reversible do |dir|
      dir.up do
        execute <<~SQL
          UPDATE bill_orders
          SET amount_cents = CASE WHEN amount IS NULL THEN NULL ELSE (ROUND(amount, 2) * 100)::bigint END,
              total_amount_cents = CASE WHEN total_amount IS NULL THEN NULL ELSE (ROUND(total_amount, 2) * 100)::bigint END,
              service_charge_cents = CASE WHEN service_charge IS NULL THEN NULL ELSE (ROUND(service_charge, 2) * 100)::bigint END,
              commission_used_cents = CASE WHEN commission_used IS NULL THEN NULL ELSE (ROUND(commission_used, 2) * 100)::bigint END
        SQL

        execute <<~SQL
          UPDATE transactions
          SET amount_cents = CASE WHEN amount IS NULL THEN NULL ELSE (ROUND(amount, 2) * 100)::bigint END,
              bonus_cents = CASE WHEN bonus IS NULL THEN NULL ELSE (ROUND(bonus, 2) * 100)::bigint END
        SQL

        execute <<~SQL
          UPDATE wallet_ledger_entries
          SET amount_cents = CASE WHEN amount IS NULL THEN NULL ELSE (ROUND(amount, 2) * 100)::bigint END
        SQL

        execute <<~SQL
          UPDATE wallets
          SET commission_cents = CASE WHEN commission IS NULL THEN NULL ELSE (ROUND(commission, 2) * 100)::bigint END
        SQL
      end
    end
  end
end
