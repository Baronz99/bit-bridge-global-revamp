# frozen_string_literal: true

class AnchorOnboardingMapper
  CANONICAL_KEYS = %i[
    first_name
    last_name
    email
    phone_number
    bvn
    dob
    address
    city
    state
    postal_code
    user_id
    vendor
  ].freeze

  FIELD_ALIASES = {
    first_name: %w[first_name firstname given_name],
    last_name: %w[last_name lastname surname family_name],
    email: %w[email],
    phone_number: %w[phone_number phone mobile msisdn],
    bvn: %w[bvn bvn_number],
    dob: %w[dob date_of_birth birthdate],
    address: %w[
      address address_line1 address_line_1 addressLine1 addressLine_1
      addressLine_1 address_line addressLine street street_address residential_address
    ],
    city: %w[city lga_city town],
    state: %w[state state_of_residence province region],
    postal_code: %w[postal_code postcode zip zip_code]
  }.freeze

  def self.build_account_info(user:, account_params:)
    new(user, account_params).build_account_info
  end

  def initialize(user, account_params)
    @user = user
    @account_params = normalize_hash(account_params)
    @profile = user.user_profile
    @profile_params = normalize_hash(@profile&.attributes || {})
    @user_params = normalize_hash(@user&.attributes || {})
  end

  def build_account_info
    mapped = {}

    CANONICAL_KEYS.each do |key|
      mapped[key] = pick_value(FIELD_ALIASES.fetch(key, []))
    end

    mapped[:user_id] = @user&.id
    mapped[:vendor] = @account_params['vendor'] || @profile_params['vendor'] || @user_params['vendor']
    mapped[:phone_number] = normalize_string(mapped[:phone_number])
    mapped[:address] = @profile&.address_line1 if mapped[:address].blank? && @profile&.address_line1.present?

    mapped
  end

  private

  def normalize_hash(hash)
    return {} unless hash

    if hash.is_a?(ActionController::Parameters)
      hash = hash.to_unsafe_h
    elsif hash.respond_to?(:to_h)
      hash = hash.to_h
    end

    hash.each_with_object({}) do |(k, v), acc|
      acc[k.to_s] = v
    end
  end

  def pick_value(keys)
    keys.each do |key|
      value =
        @account_params[key] ||
        @profile_params[key] ||
        @user_params[key]

      return value if value.present?
    end

    nil
  end

  def normalize_string(value)
    return nil if value.blank?

    value.to_s.strip
  end
end
