class CircleTransactionReaction < ApplicationRecord
  belongs_to :circle_transaction, inverse_of: :reactions
  belongs_to :user

  ALLOWED = %w[👍 🎉 🙏].freeze

  validates :emoji, presence: true, inclusion: { in: ALLOWED }
  validates :user_id, uniqueness: { scope: %i[circle_transaction_id emoji],
                                    message: 'already reacted with this emoji' }
end
