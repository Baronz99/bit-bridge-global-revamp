class AddBalanceToCircles < ActiveRecord::Migration[7.1]
  def change
    add_column :circles, :balance_cents, :integer, null: false, default: 0
    add_column :circles, :currency, :string, null: false, default: 'NGN'
  end
end
