# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CircleTransaction, type: :model do
  it 'has a unique index on [circle_id, idempotency_key]' do
    indexes = ActiveRecord::Base.connection.indexes(:circle_transactions)
    index = indexes.find { |i| i.unique && i.columns.sort == %w[circle_id idempotency_key].sort }

    expect(index).to be_present
    expect(indexes.map(&:name)).to include('index_circle_transactions_on_circle_id_and_idempotency_key')
  end
end
