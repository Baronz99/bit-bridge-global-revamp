# frozen_string_literal: true

module Api
  module V1
    module Core
      class KycProfileController < Api::V1::UsersController
        def update_kyc_level
          super
        end
      end
    end
  end
end
