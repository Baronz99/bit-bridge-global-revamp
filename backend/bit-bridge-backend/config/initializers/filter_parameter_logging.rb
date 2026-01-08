# frozen_string_literal: true

# Be sure to restart your server when you modify this file.

# Configure parameters to be filtered from the log file.
# See the ActiveSupport::ParameterFilter documentation for supported notations and behaviors.
Rails.application.config.filter_parameters += %i[
  passw password secret token access_token refresh_token id_token _key crypt salt certificate
  otp ssn bvn bvn_fingerprint

  # PIN / card data (PCI)
  pin transaction_pin cvv cvc pan card_number card_pan expiry expiry_month expiry_year

  # Auth header-ish values that sometimes land in params
  authorization bearer

  # Payment provider secrets
  monnify_api_key monnify_secret_key
]
