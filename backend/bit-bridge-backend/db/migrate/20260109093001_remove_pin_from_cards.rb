class RemovePinFromCards < ActiveRecord::Migration[7.1]
  def change
    remove_column :cards, :pin, :string if column_exists?(:cards, :pin)
    remove_column :cards, :transaction_pin, :string if column_exists?(:cards, :transaction_pin)
  end
end
