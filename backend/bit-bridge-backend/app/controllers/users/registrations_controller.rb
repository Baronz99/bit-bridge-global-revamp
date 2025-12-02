# frozen_string_literal: true

module Users
  class RegistrationsController < Devise::RegistrationsController
    respond_to :json
    include RackSessionFix

    # before_action :configure_sign_up_params, only: [:create]
    # before_action :configure_account_update_params, only: [:update]

    # GET /resource/sign_up
    # def new
    #   super
    # end

    # POST /resource
    # def create
    #   super
    # end

    # GET /resource/edit
    # def edit
    #   super
    # end

    # PUT /resource
    # def update
    #   super
    # end

    # DELETE /resource
    # def destroy
    #   super
    # end

    # GET /resource/cancel
    # Forces the session data which is usually expired after sign
    # in to be expired now. This is useful if the user wants to
    # cancel oauth signing in/up in the middle of the process,
    # removing all OAuth session data.
    # def cancel
    #   super
    # end

    # protected

    # If you have extra params to permit, append them to the sanitizer.
    # def configure_sign_up_params
    #   devise_parameter_sanitizer.permit(:sign_up, keys: [:attribute])
    # end

    # If you have extra params to permit, append them to the sanitizer.
    # def configure_account_update_params
    #   devise_parameter_sanitizer.permit(:account_update, keys: [:attribute])
    # end

    # The path used after sign up.
    # def after_sign_up_path_for(resource)
    #   super(resource)
    # end

    # The path used after sign up for inactive accounts.
    # def after_inactive_sign_up_path_for(resource)
    #   super(resource)
    # end




    def respond_with(resource, _opts = {})
  if request.method == 'POST' && resource.persisted?
    # UserMailer.welcome_email(resource).deliver_now
    render json: {
      status: { code: 200, message: 'Signed up sucessfully.' },
      data: UserSerializer.new(resource).as_json
    }, status: :ok
  elsif request.method == 'DELETE'
    render json: {
      status: { code: 200, message: 'Account deleted successfully.' }
    }, status: :ok
  else
    # More detailed error for debugging
    error_details = {
      errors: resource.errors.full_messages,
      error_details: resource.errors.details
    }
    
    Rails.logger.error "Signup failed: #{error_details.inspect}"
    
    render json: {
      status: { 
        code: 422, 
        message: "User couldn't be created successfully. #{resource.errors.full_messages.to_sentence}" 
      },
      debug: error_details
    }, status: :unprocessable_entity
  end
rescue StandardError => e
  # Catch any unexpected errors
  Rails.logger.error "Signup exception: #{e.class} - #{e.message}"
  Rails.logger.error e.backtrace.join("\n")
  
  render json: {
    status: { code: 500, message: "Server error: #{e.message}" },
    error_class: e.class.name
  }, status: :internal_server_error
end
  end
end
