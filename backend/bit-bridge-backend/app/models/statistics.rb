# frozen_string_literal: true

class Statistics
  include ActiveModel::Model

  attr_accessor :total_users, :total_deposits, :total_withdrawals



  def initialize
    @total_users = User.all.count
    @total_deposits = Transaction.where(transaction_type: :deposit, status: :approved).sum(:amount)
    @total_withdrawals = Transaction.where(transaction_type: :withdrawal, status: :approved).sum(:amount)
  end
end
