# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CircleTransaction, type: :model do
  it 'has a unique index on [circle_id, event_type, idempotency_key]' do
    indexes = ActiveRecord::Base.connection.indexes(:circle_transactions)
    index = indexes.find { |i| i.unique && i.columns.sort == %w[circle_id event_type idempotency_key].sort }

    expect(index).to be_present
    expect(indexes.map(&:name)).to include('idx_circle_tx_circle_event_idempotency')
  end
end
