class CircleMembership < ApplicationRecord
  belongs_to :circle
  belongs_to :user

  enum role: { member: 0, admin: 1 }
end
