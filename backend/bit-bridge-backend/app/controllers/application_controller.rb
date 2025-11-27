# frozen_string_literal: true

class ApplicationController < ActionController::API
  before_action :authenticate_user!

  before_action :configure_permitted_parameters, if: :devise_controller?

  protected

  def configure_permitted_parameters
    devise_parameter_sanitizer.permit(:sign_up, keys: [:role,
                                                       { user_profile_attributes: %i[last_name first_name
                                                                                     phone_number] }])
    devise_parameter_sanitizer.permit(:account_update, keys: %i[screen_name])
  end
end
