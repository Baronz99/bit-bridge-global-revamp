# frozen_string_literal: true

# app/controllers/users/confirmations_controller.rb
module Users
  class ConfirmationsController < Devise::ConfirmationsController
    # Confirmation must be public; user isn't logged in yet
    skip_before_action :authenticate_user!, only: [:show]

    # GET /confirmation?confirmation_token=abcdef
    def show
      self.resource = resource_class.confirm_by_token(params[:confirmation_token])

      if resource.errors.empty?
        user = resource

        # generate / rotate refresh token
        new_refresh_token = user.generate_refresh_token

        # issue access token
        access_token, _payload =
          Warden::JWTAuth::UserEncoder.new.call(user, :user, nil)

        # expose refresh token same way as login/refresh
        response.set_header('Bit-Refresh-Token', new_refresh_token)

        puts '✅ successful confirmation — returning tokens to frontend'

        render json: {
          message:       'User confirmed',
          access_token:  access_token,
          refresh_token: new_refresh_token
        }, status: :ok
      else
        render json: {
          message: 'Failed to confirm',
          errors:  resource.errors.full_messages
        }, status: :unprocessable_entity
      end
    end
  end
end
