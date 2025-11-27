# frozen_string_literal: true

class ElectricBillOrder < ApplicationRecord
  enum :status, { initialized: 0, completed: 1, declined: 2 }

  before_save :calculate_total

  private

  def calculate_total
    self.total_amount = amount + 200
  end
end
