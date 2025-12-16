class Dispute < ApplicationRecord
  belongs_to :circle_transaction
  belongs_to :raised_by, class_name: 'User'

  enum status: { open: 0, resolved: 1, rejected: 2 }

  validates :reason, presence: true
end
