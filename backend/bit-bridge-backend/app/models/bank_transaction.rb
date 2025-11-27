# frozen_string_literal: true

class BankTransaction < ApplicationRecord
  belongs_to :account
end
