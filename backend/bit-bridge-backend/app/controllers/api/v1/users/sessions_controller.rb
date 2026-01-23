# frozen_string_literal: true

module Api
  module V1
    module Users
      class SessionsController < ::Users::SessionsController
        prepend_before_action :set_devise_mapping

        private

        def set_devise_mapping
          request.env['devise.mapping'] ||= Devise.mappings[:user]
        end
      end
    end
  end
end
