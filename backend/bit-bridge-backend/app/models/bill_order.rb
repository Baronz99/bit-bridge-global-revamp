# frozen_string_literal: true

class BillOrder < ApplicationRecord
  attr_accessor :demand_category, :use_commission, :commission_balance

  belongs_to :user, optional: true
  has_one :wallet, through: :user
  has_one :transaction_record

  enum :status, { initialized: 0, completed: 1, declined: 2, timedout: 3, disputed: 4 }
  enum :meter_type, { PREPAID: 0, POSTPAID: 1 }
  enum :payment_type, { online: 0, B2B: 1 }
  enum :payment_method, { wallet: 0, card: 1 }

  validates :amount, presence: true
  # validate :validate_order, if: -> { persisted? && wallet_payment? }


  before_save :calculate_total
  # before_save :set_usd_conversion
  # before_save :cal_unit, if: :is_electricty?

  validate :user_must_be_active

  before_update :apply_commission, if: :is_commission?

  after_update :save_commission, if: :should_apply_commission?



  default_scope { order(created_at: :desc) }

  def apply_commission
    commission_balance = wallet.commission || 0
    amount_to_pay = amount - commission_balance
    # return if commission_amount <= 0

    new_amount = amount_to_pay.positive? ? amount_to_pay : 0
    @commission_balance = new_amount.zero? ? amount_to_pay.abs : 0 # commission_balance - amount_to_pay.abs #should be zero
    self.amount = new_amount
    self.total_amount = new_amount
  end

  def bill_commission
    commission_balance = wallet&.commission || 0
    amount_to_pay = amount - commission_balance
    new_amount = amount_to_pay.positive? ? amount_to_pay : 0

    %w[VTU DATA].include?(service_type) ? new_amount : nil
  end

  def user_must_be_active
    errors.add(:base, 'User Not Active') unless user&.active?
  end

  def calc_service_charge
    self.service_charge = %w[VTU DATA].include?(service_type) ? 0 : 100
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
    self.units = amount * (rate / 1000)
  end

  def is_electricty?
    service_type == 'ELECTRICITY'
  end

  def commission
    return 0 if service_type == 'ELECTRICITY'

    (amount * 0.01).round(2)
  end



  private

  def net_total
    amount.to_i + calc_service_charge
  end

  def save_commission
    commission_percent = amount * 0.01
    wallet.commission = use_commission ? @commission_balance : wallet.commission + commission_percent
    wallet.save
  end

  def calculate_total
    self.total_amount = net_total
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
    return unless wallet.balance < net_total

    errors.add(:amount, 'insufficient balance')
  end
end
