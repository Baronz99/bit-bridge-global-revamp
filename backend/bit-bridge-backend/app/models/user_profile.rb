# frozen_string_literal: true

class UserProfile < ApplicationRecord
  belongs_to :user
  validates :phone_number, uniqueness: true, allow_blank: true  # 👈 Add allow_blank: true

  # 🔹 Attachments for KYC storage (S3 via ActiveStorage)
  has_one_attached :id_document
  has_one_attached :proof_of_address
end