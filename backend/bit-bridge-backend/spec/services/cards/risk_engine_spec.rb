# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Cards::RiskEngine do
  let(:user) { create(:user) }
  let(:card) { Card.create!(user: user, card_id: 'card_123', decline_count: 2) }

  it 'resets declines on unfreeze' do
    card.update!(decline_count: 3, last_declined_at: Time.current, frozen_by: 'system', frozen_reason: 'Too many')

    described_class.reset_declines!(card: card)

    expect(card.reload.decline_count).to eq(0)
    expect(card.last_declined_at).to be_nil
    expect(card.frozen_by).to be_nil
  end
end
