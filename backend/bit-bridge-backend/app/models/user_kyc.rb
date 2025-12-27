# frozen_string_literal: true

class UserKyc < ApplicationRecord
  belongs_to :user

  def verified?
    bvn_status == 'verified' && bvn_verified_at.present?
  end
end
