# frozen_string_literal: true

class Wallet < ApplicationRecord
  belongs_to :user
  has_many :transactions, class_name: 'Transaction'
  has_many :bill_orders, through: :user
  has_many :order_details, through: :user

  enum :wallet_type, { ngn: 0, usdt: 1 }

  validates :wallet_type, presence: true, uniqueness: { scope: :user_id }



  def total_bills
    bill_orders.where(status: %w[completed timedout disputed], payment_method: 'wallet').sum(:total_amount)
  end

  def total_commission
    bill_orders.where(status: 'completed', payment_method: 'wallet').sum(:commission)
  end

  def net_commission
    bill_orders.where(status: 'completed', payment_method: 'wallet').sum(:commission)
  end

  def total_withdrawal
    # transactions.where(transaction_type: "withdrawal", status: "approved").sum(:amount)
    transactions.where(transaction_type: 'withdrawal', status: %w[approved pending]).sum(:amount)
  end

  def total_real_withdrawal
    transactions.where(transaction_type: 'withdrawal', status: 'approved').sum(:amount)
  end

  def withdrawn
    transactions.where(transaction_type: 'withdrawal', status: 'approved').sum(:amount)
  end

  def total_deposit
    transactions.where(transaction_type: 'deposit', status: 'approved').sum(&:deposit_amount)
  end

  def balance
    (total_deposit + user.total_sale) - (total_withdrawal + user.user_net_expense + total_bills)
  end

  def real_balance
    (total_deposit + user.total_sale) - (total_real_withdrawal + user.user_net_expense + total_bills)
  end
end
