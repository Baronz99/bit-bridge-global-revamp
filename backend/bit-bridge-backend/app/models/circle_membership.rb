class CircleMembership < ApplicationRecord
  belongs_to :circle
  belongs_to :user

  # ✅ Added treasurer between member/admin
  enum role: { member: 0, treasurer: 1, admin: 2 }
end
