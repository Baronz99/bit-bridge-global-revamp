# frozen_string_literal: true

module Api
  module V1
    module Core
      class UsersController < Api::V1::UsersController
        def user_profile
          super
        end

        def user_update
          super
        end

        def basic_profile
          super
        end

        def request_email_change
          super
        end

        def confirm_email_change
          super
        end
      end
    end
  end
end
