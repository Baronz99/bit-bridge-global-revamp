# frozen_string_literal: true

class FxQuote < ApplicationRecord
  belongs_to :user

  validates :token, presence: true, uniqueness: true
  validates :direction, presence: true
  validates :expires_at, presence: true
  validate :expires_at_in_future

  before_validation :ensure_token, on: :create

  scope :valid_token, ->(token) { where(token: token).where('expires_at > ?', Time.current) }

  def expired?
    expires_at <= Time.current
  end

  private

  def ensure_token
    return if token.present?

    self.token = loop do
      candidate = SecureRandom.hex(16)
      break candidate unless self.class.exists?(token: candidate)
    end
  end

  def expires_at_in_future
    return if expires_at.blank?
    return if expires_at > Time.current

    errors.add(:expires_at, 'must be in the future')
  end
end
