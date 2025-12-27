# frozen_string_literal: true

class KycAuditLog < ApplicationRecord
  belongs_to :user, optional: true
  belongs_to :admin, class_name: 'User', optional: true
end
