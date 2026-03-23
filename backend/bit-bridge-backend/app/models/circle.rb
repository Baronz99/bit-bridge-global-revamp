# frozen_string_literal: true

class Circle < ApplicationRecord
  class InsufficientBalanceError < StandardError; end

  attribute :circle_type, :string, default: 'standard'
  attribute :kyc_mode, :string, default: 'strict'
  attribute :visibility, :string, default: 'private'

  belongs_to :owner, class_name: 'User'

  enum circle_type: {
    standard: 'standard',
    official: 'official'
  }, _prefix: :circle_type

  enum kyc_mode: {
    strict: 'strict',
    flexible: 'flexible'
  }, _prefix: :kyc_mode

  enum visibility: {
    private: 'private',
    official_featured: 'official_featured'
  }, _prefix: :visibility

  has_many :circle_memberships, dependent: :destroy
  has_many :members, through: :circle_memberships, source: :user

  has_many :circle_activities, dependent: :destroy
  has_many :circle_transactions, dependent: :destroy

  monetize :balance_cents, with_model_currency: :currency, allow_nil: true if defined?(MoneyRails)

  validates :circle_type, presence: true, inclusion: { in: circle_types.keys }
  validates :kyc_mode, presence: true, inclusion: { in: kyc_modes.keys }
  validates :visibility, presence: true, inclusion: { in: visibilities.keys }
  validates :min_contribution_cents,
            numericality: { greater_than_or_equal_to: 0, allow_nil: true }
  validate :min_contribution_not_above_max

  def official?
    circle_type == 'official'
  end

  def flexible_kyc?
    official? && kyc_mode == 'flexible'
  end

  def founders_circle?
    official? && visibility == 'official_featured' && badge_label.to_s.downcase.include?('founder')
  end

  def manager_user?(user, membership: nil, current_role: nil)
    return false unless user

    role = current_role.presence
    role ||= 'owner' if owner_id == user.id
    role ||= membership&.role

    role == 'owner' || role == 'admin'
  end

  def contribution_cap_for(user)
    return nil unless flexible_kyc?
    return nil if user&.kyc_at_least?('tier_2')

    max_contribution_cents.presence
  end

  def minimum_contribution_cents
    min_contribution_cents.presence
  end

  # Mini-wallet helper: apply a credit or debit and keep balance in sync
  #
  # NEW: circle_activity can be passed to tag tx for progress reporting.
  def apply_transaction!(
    amount_cents:,
    direction:,
    user:,
    kind: 'manual',
    description: nil,
    reference: nil,
    metadata: {},
    circle_activity: nil,
    idempotency_key: nil,
    request_id: nil,
    event_type: nil,
    wallet_transaction_id: nil
  )
    raise ArgumentError, 'amount_cents must be > 0' unless amount_cents.to_i > 0

    Circle.transaction do
      with_lock do
        self.balance_cents = balance_cents.to_i

        tx = circle_transactions.create!(
          user: user,
          amount_cents: amount_cents,
          direction: direction,
          kind: kind,
          description: description,
          reference: reference,
          idempotency_key: idempotency_key,
          request_id: request_id,
          event_type: event_type,
          wallet_transaction_id: wallet_transaction_id,
          metadata: metadata,
          circle_activity: circle_activity
        )

        if tx.direction_credit?
          update!(balance_cents: balance_cents + amount_cents)
        else
          new_balance = balance_cents - amount_cents
          raise InsufficientBalanceError, 'Insufficient circle balance' if new_balance.negative?
          update!(balance_cents: new_balance)
        end

        tx
      end
    end
  end

  private

  def min_contribution_not_above_max
    return if min_contribution_cents.blank? || max_contribution_cents.blank?
    return if min_contribution_cents.to_i <= max_contribution_cents.to_i

    errors.add(:min_contribution_cents, 'must be less than or equal to max contribution')
  end
end
