# frozen_string_literal: true

class KycBvnRetryEvent < ApplicationRecord
  belongs_to :user
  belongs_to :user_kyc
end
