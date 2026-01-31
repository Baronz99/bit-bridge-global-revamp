# frozen_string_literal: true

class BillOrder < ApplicationRecord
  attr_accessor :demand_category, :use_commission, :commission_balance
  TERMINAL_STATUSES = %w[completed failed refunded declined timedout].freeze

  belongs_to :user, optional: true
  has_one :wallet, through: :user
  has_one :transaction_record

  enum :status, {
    initialized: 0,
    completed: 1,
    declined: 2,
    timedout: 3,
    disputed: 4,
    processing: 5,
    failed: 6,
    refunded: 7,
    pending: 8
  }
  enum :meter_type, { PREPAID: 0, POSTPAID: 1 }
  enum :payment_type, { online: 0, B2B: 1 }
  enum :payment_method, { wallet: 0, card: 1 }

  validates :amount, presence: true
  # validate :validate_order, if: -> { persisted? && wallet_payment? }

  def metadata
    provider_response || {}
  end

  def metadata=(value)
    self.provider_response = value
  end


  before_save :calculate_total
  before_save :normalize_money_fields
  # before_save :set_usd_conversion
  # before_save :cal_unit, if: :is_electricty?

  validate :user_must_be_active
  validate :validate_money_scale

  before_update :prevent_terminal_status_regression
  before_update :apply_commission, if: :is_commission?

  after_update :save_commission, if: :should_apply_commission?
  after_commit :create_reward_transaction, on: :update



  default_scope { order(created_at: :desc) }

  def apply_commission
    commission_balance = wallet.commission || 0
    amount_to_pay = amount.to_f - commission_balance.to_f
    # return if commission_amount <= 0

    new_amount = amount_to_pay.positive? ? amount_to_pay : 0
    @commission_balance = new_amount.zero? ? amount_to_pay.abs : 0 # commission_balance - amount_to_pay.abs #should be zero
    self.amount = new_amount
    self.total_amount = new_amount
  end

  def bill_commission
    commission_balance = wallet&.commission.to_f
    amount_to_pay = amount.to_f - commission_balance
    new_amount = amount_to_pay.positive? ? amount_to_pay : 0

    %w[VTU DATA].include?(service_type) ? new_amount : nil
  end

  def user_must_be_active
    errors.add(:base, 'User Not Active') unless user&.active?
  end

  def calc_service_charge
    self.service_charge = service_type == 'ELECTRICITY' ? 100 : 0
  end

  def send_confirmation_mail
    OrderMailer.purchase_confirmation(self).deliver_now
  end

  def is_completed?
    status == 'completed'
  end

  def cal_unit
    # NMD = 14.5 for 1000

    rate = case demand_category
           when 'NMD'
             14.7
           when 'NMD_2'
             14.7
           when 'NMD_3'
             14.7
           else
             0.0
           end
    self.units = amount.to_f * (rate / 1000)
  end

  def is_electricty?
    service_type == 'ELECTRICITY'
  end

  def commission
    return 0 if service_type == 'ELECTRICITY'

    (amount.to_f * 0.01).round(2)
  end

  def reward_eligible?
    saved_change_to_status? &&
      status == 'completed' &&
      %w[VTU DATA].include?(service_type)
  end



  private

  def net_total
    amount.to_f + calc_service_charge.to_f
  end

  def save_commission
    commission_percent = amount.to_f * 0.01
    wallet.commission =
      if use_commission
        [wallet.commission.to_d - commission_used.to_d, 0.to_d].max
      else
        wallet.commission.to_f + commission_percent
      end
    wallet.save
  end

  def prevent_terminal_status_regression
    return unless will_save_change_to_status?
    return unless TERMINAL_STATUSES.include?(status_was.to_s)

    errors.add(:status, 'is terminal and cannot be changed')
    throw(:abort)
  end

  def create_reward_transaction
    return unless reward_eligible?
    return if user.blank?
    return if RewardTransaction.exists?(bill_order_id: id)

    reward_rate = 0.01
    reward_amount = (amount.to_d * reward_rate).round(2)
    return if reward_amount <= 0

    RewardTransaction.create!(
      user: user,
      bill_order: self,
      amount: reward_amount,
      source_amount: amount,
      reward_rate: reward_rate,
      currency: 'NGN',
      service_type: service_type,
      source_label: biller.presence || service_id.presence || service_type,
      status: :earned,
      earned_at: Time.current
    )
  end

  def calculate_total
    self.total_amount = net_total
  end

  def normalize_money_fields
    self.amount = MoneyScale.normalize(amount)
    self.total_amount = MoneyScale.normalize(total_amount)
    self.service_charge = MoneyScale.normalize(service_charge)
    self.commission_used = MoneyScale.normalize(commission_used)
    self.amount_cents = Money.to_cents(amount, 'NGN')
    self.total_amount_cents = Money.to_cents(total_amount, 'NGN')
    self.service_charge_cents = Money.to_cents(service_charge, 'NGN')
    self.commission_used_cents = Money.to_cents(commission_used, 'NGN')
  end

  def validate_money_scale
    {
      amount: amount,
      total_amount: total_amount,
      service_charge: service_charge,
      commission_used: commission_used
    }.each do |field, value|
      raw_value = read_attribute_before_type_cast(field)
      check_value = raw_value.nil? ? value : raw_value
      next if MoneyScale.valid_scale?(check_value)

      errors.add(field, 'must have at most 2 decimal places')
    end
  end

  def should_apply_commission?
    saved_change_to_status? && status == 'completed' && transaction_id.present? && %w[VTU
                                                                                      DATA].include?(service_type)
  end

  def net_usd_conversion
    currency = CurrencyService.new('ngn', 'ngn')

    amount_in_usd = currency.get_calculated_rate(net_total, 'ngn', 'ngn')

    amount_in_usd[:rate]
  end

  def set_usd_conversion
    self.usd_amount = net_total
  end

  def wallet_payment?
    payment_method === 'wallet'
  end

  def is_commission?
    use_commission == true && status == 'completed'
  end

  def validate_order
    return unless wallet.ledger_available_balance < net_total

    errors.add(:amount, 'insufficient balance')
  end
end
