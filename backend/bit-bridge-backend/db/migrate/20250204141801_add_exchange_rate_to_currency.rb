# frozen_string_literal: true

class AddExchangeRateToCurrency < ActiveRecord::Migration[7.1]
  def change
    add_column :currencies, :exchange_rates, :jsonb
  end
end
