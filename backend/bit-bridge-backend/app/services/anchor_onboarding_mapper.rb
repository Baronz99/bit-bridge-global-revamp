# frozen_string_literal: true

class AnchorOnboardingMapper
  NIGERIAN_STATE_CANONICAL = {
    'ABIA' => 'Abia',
    'ADAMAWA' => 'Adamawa',
    'AKWA IBOM' => 'Akwa Ibom',
    'ANAMBRA' => 'Anambra',
    'BAUCHI' => 'Bauchi',
    'BAYELSA' => 'Bayelsa',
    'BENUE' => 'Benue',
    'BORNO' => 'Borno',
    'CROSS RIVER' => 'Cross River',
    'DELTA' => 'Delta',
    'EBONYI' => 'Ebonyi',
    'EDO' => 'Edo',
    'EKITI' => 'Ekiti',
    'ENUGU' => 'Enugu',
    'GOMBE' => 'Gombe',
    'IMO' => 'Imo',
    'JIGAWA' => 'Jigawa',
    'KADUNA' => 'Kaduna',
    'KANO' => 'Kano',
    'KATSINA' => 'Katsina',
    'KEBBI' => 'Kebbi',
    'KOGI' => 'Kogi',
    'KWARA' => 'Kwara',
    'LAGOS' => 'Lagos',
    'NASARAWA' => 'Nasarawa',
    'NASSARAWA' => 'Nasarawa',
    'NIGER' => 'Niger',
    'OGUN' => 'Ogun',
    'ONDO' => 'Ondo',
    'OSUN' => 'Osun',
    'OYO' => 'Oyo',
    'PLATEAU' => 'Plateau',
    'RIVERS' => 'Rivers',
    'SOKOTO' => 'Sokoto',
    'TARABA' => 'Taraba',
    'YOBE' => 'Yobe',
    'ZAMFARA' => 'Zamfara',
    'FCT' => 'FCT',
    'ABUJA' => 'FCT',
    'FEDERAL CAPITAL TERRITORY' => 'FCT'
  }.freeze

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
    phone_number: %w[phone_number phone mobile msisdn phone_e164],
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
    @user_kyc = user.user_kyc
    @profile_params = normalize_hash(@profile&.attributes || {})
    @user_params = normalize_hash(@user&.attributes || {})
  end

  def build_account_info
    mapped = {}

    CANONICAL_KEYS.each do |key|
      mapped[key] = pick_value(FIELD_ALIASES.fetch(key, []))
    end

    mapped[:user_id] = @user&.id
    mapped[:vendor] = @account_params['vendor'] || @profile_params['vendor'] || @user_params['vendor'] || 'anchor'
    mapped[:phone_number] = normalize_phone(mapped[:phone_number])
    mapped[:address] = @profile&.address_line1 if mapped[:address].blank? && @profile&.address_line1.present?
    mapped[:state] = normalize_state(mapped[:state])
    apply_verified_name_overrides!(mapped)

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

  def normalize_state(value)
    return nil if value.blank?

    raw = value.to_s.strip
    normalized = raw.gsub(/\s+/, ' ')
    normalized = normalized.gsub(/\(([^)]*)\)/, ' \1 ')
    normalized = normalized.sub(/\s+state\z/i, '')
    normalized = normalized.gsub(/[^A-Za-z0-9\s]/, ' ').gsub(/\s+/, ' ').strip
    return 'FCT' if normalized.casecmp('fct abuja').zero? || normalized.casecmp('abuja').zero? || normalized.casecmp('fct').zero?

    key = normalized.upcase
    canonical = NIGERIAN_STATE_CANONICAL[key]
    return canonical if canonical.present?

    nil
  end

  def normalize_string(value)
    return nil if value.blank?

    value.to_s.strip
  end

  def normalize_phone(value)
    raw = normalize_string(value)
    return nil if raw.blank?

    digits = PhoneNormalizer.to_e164_ng(raw)
    return raw if digits.blank?

    "+#{digits}"
  end

  def apply_verified_name_overrides!(mapped)
    verified_names = verified_bvn_name_snapshot
    return mapped unless verified_names

    mapped[:first_name] = verified_names[:first_name] if verified_names[:first_name].present?
    mapped[:last_name] = verified_names[:last_name] if verified_names[:last_name].present?
    mapped
  end

  def verified_bvn_name_snapshot
    return nil unless @user_kyc&.verified_and_reusable_bvn?

    local_snapshot = {
      first_name: normalize_string(@user_kyc.bvn_snapshot_first_name),
      last_name: normalize_string(@user_kyc.bvn_snapshot_last_name)
    }
    return local_snapshot if local_snapshot[:first_name].present? && local_snapshot[:last_name].present?

    fingerprint = @user_kyc.bvn_fingerprint.to_s.strip
    return nil if fingerprint.blank?

    snapshot = Kyc::VerificationSnapshotStore.find_reusable(document_type: 'bvn', fingerprint: fingerprint)
    return nil unless snapshot

    {
      first_name: normalize_string(snapshot.first_name),
      last_name: normalize_string(snapshot.last_name)
    }
  rescue StandardError
    nil
  end
end
