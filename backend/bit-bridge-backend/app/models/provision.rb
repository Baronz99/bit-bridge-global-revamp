# frozen_string_literal: true

class Provision < ApplicationRecord
  SERVICE_TYPE_ALIASES = {
    'AIRTIME' => 'VTU',
    'CABLE' => 'TV',
    'CABLETV' => 'TV',
    'CABLE_TV' => 'TV',
    'POWER' => 'ELECTRICITY'
  }.freeze
  SERVICE_TYPES = %w[VTU DATA TV ELECTRICITY UTILITY].freeze

  belongs_to :product
  has_many :order_items
  enum :currency, { ngn: 0, usd: 1, gbp: 2, eur: 3, btc: 4, eth: 5, doge: 6 }
  enum :provision_value_type, { fixed: 0, range: 1 }

  before_validation :normalize_fields

  validates :product, presence: true
  validates :name, presence: true
  validates :currency, presence: true
  validates :provision_value_type, presence: true
  validates :service_type, inclusion: { in: SERVICE_TYPES }, allow_blank: true
  validates :min_value, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :max_value, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validate :value_range_must_be_numeric
  validate :min_must_not_exceed_max
  validate :service_type_must_match_product_category

  private

  def normalize_fields
    @submitted_value_range = submitted_value_range

    self.name = name.to_s.strip.presence
    self.service_type = normalized_service_type

    normalized_range = normalize_numeric_range(value_range)
    fixed_value = normalized_decimal(value)

    if normalized_range.blank? && fixed_value.present? && provision_value_type.to_s == 'fixed'
      normalized_range = [fixed_value, fixed_value]
    end

    self.value_range = normalized_range if normalized_range.present?

    range_min = normalized_range&.first
    range_max = normalized_range&.last

    self.min_value = normalized_decimal(min_value || range_min)
    self.max_value = normalized_decimal(max_value || range_max)

    if normalized_range.blank? && min_value.present? && max_value.present?
      self.value_range = [normalized_decimal(min_value), normalized_decimal(max_value)]
    end
  end

  def submitted_value_range
    raw = value_range_before_type_cast
    return Array(value_range).dup if raw.nil?
    return raw if raw.is_a?(Array)

    Array(raw)
  end

  def normalized_service_type
    raw = service_type.to_s.strip.upcase
    return nil if raw.blank?

    SERVICE_TYPE_ALIASES.fetch(raw, raw)
  end

  def normalize_numeric_range(range_values)
    values = Array(range_values).filter_map { |raw| parsed_decimal(raw) }
    return if values.empty?

    values.sort.map { |decimal| decimal.to_s('F') }
  end

  def normalized_decimal(value)
    parsed = parsed_decimal(value)
    parsed&.to_s('F')
  end

  def parsed_decimal(value)
    string_value = value.to_s.strip
    return nil if string_value.blank?

    BigDecimal(string_value)
  rescue ArgumentError
    nil
  end

  def value_range_must_be_numeric
    raw_values = Array(@submitted_value_range.presence || value_range).reject { |value| value.to_s.strip.blank? }
    return if raw_values.empty? && provision_value_type.to_s == 'fixed' && normalized_decimal(value).present?
    return if raw_values.empty?

    if raw_values.size < 2
      errors.add(:value_range, 'must include both a minimum and maximum value')
      return
    end

    if raw_values.any? { |value| normalized_decimal(value).nil? }
      errors.add(:value_range, 'must contain only numeric values')
      return
    end

    min, max = raw_values.first(2).map { |value| parsed_decimal(value) }
    errors.add(:value_range, 'minimum must be less than or equal to maximum') if min > max
  end

  def min_must_not_exceed_max
    return if min_value.blank? || max_value.blank?
    return unless BigDecimal(min_value.to_s) > BigDecimal(max_value.to_s)

    errors.add(:min_value, 'must be less than or equal to max value')
  end

  def service_type_must_match_product_category
    return if service_type.blank? || product.blank?

    allowed_types =
      case product.category
      when 'mobile provider'
        %w[VTU DATA]
      when 'utility', 'power'
        %w[TV ELECTRICITY UTILITY]
      else
        SERVICE_TYPES
      end

    return if allowed_types.include?(service_type)

    errors.add(:service_type, "is not valid for #{product.category}")
  end
end
