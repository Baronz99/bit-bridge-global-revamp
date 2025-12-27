# frozen_string_literal: true

class KycAttempt < ApplicationRecord
  belongs_to :user, optional: true
end
