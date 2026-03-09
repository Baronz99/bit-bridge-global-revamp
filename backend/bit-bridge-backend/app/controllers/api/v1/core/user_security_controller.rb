# frozen_string_literal: true

module Api
  module V1
    module Core
      class UserSecurityController < Api::V1::UsersController
        def password_reset
          super
        end

        def update_password
          super
        end

        def user_password_update
          super
        end
      end
    end
  end
end
