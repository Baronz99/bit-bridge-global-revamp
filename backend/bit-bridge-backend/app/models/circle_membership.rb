class CircleMembership < ApplicationRecord
  belongs_to :circle
  belongs_to :user

  # ✅ Added treasurer between member/admin
  enum role: { member: 0, treasurer: 1, admin: 2 }

  before_validation :normalize_username
  before_validation :assign_default_username, on: :create

  validates :username,
            length: { minimum: 3, maximum: 24 },
            format: { with: /\A[a-z0-9_]+\z/, message: 'must use letters, numbers, or underscore only' },
            allow_nil: true
  validates :username,
            uniqueness: { scope: :circle_id, case_sensitive: false },
            allow_nil: true

  RESERVED_USERNAMES = %w[admin owner support system bitbridge].freeze

  validate :username_not_reserved

  private

  def normalize_username
    self.username = username.to_s.strip.downcase.presence
  end

  def assign_default_username
    return if username.present?
    return unless user.present? && circle_id.present?

    self.username = next_available_username(base_username_for(user))
  end

  def base_username_for(member_user)
    profile = member_user.user_profile
    first = profile&.first_name.to_s.downcase.gsub(/[^a-z0-9]/, '')
    last = profile&.last_name.to_s.downcase.gsub(/[^a-z0-9]/, '')

    base =
      if first.present? || last.present?
        [first, last].reject(&:blank?).join('_')
      else
        member_user.email.to_s.split('@').first.to_s.downcase.gsub(/[^a-z0-9]/, '_')
      end

    base = 'member' if base.blank?
    base[0...24]
  end

  def next_available_username(base)
    candidate = base
    suffix = 1

    while username_taken?(candidate)
      suffix += 1
      tail = "_#{suffix}"
      head = base[0...(24 - tail.length)]
      candidate = "#{head}#{tail}"
    end

    candidate
  end

  def username_taken?(candidate)
    self.class
      .where(circle_id: circle_id)
      .where('LOWER(username) = ?', candidate.to_s.downcase)
      .where.not(id: id)
      .exists?
  end

  def username_not_reserved
    return if username.blank?
    return unless RESERVED_USERNAMES.include?(username)

    errors.add(:username, 'is reserved')
  end
end
