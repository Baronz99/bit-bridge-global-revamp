# frozen_string_literal: true

# Be sure to restart your server when you modify this file.

# Configure parameters to be partially matched (e.g. passw matches password) and filtered from the log file.
# Use this to limit dissemination of sensitive information.
# See the ActiveSupport::ParameterFilter documentation for supported notations and behaviors.
Rails.application.config.filter_parameters += %i[
  passw password secret token _key crypt salt certificate otp ssn bvn bvn_fingerprint
  pin transaction_pin cvv cvc pan card_number card_pan expiry expiry_month expiry_year
  authorization bearer
  monnify_api_key monnify_secret_key
]

