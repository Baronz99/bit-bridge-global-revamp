# app/services/phone_normalizer.rb
class PhoneNormalizer
  # Normalize Nigerian numbers to digits-only E164 form:
  #   2348012345678
  #
  # Accepts:
  # - 08012345678
  # - 8012345678
  # - 2348012345678
  # - +2348012345678
  #
  # Returns:
  # - "2348012345678" (String) OR nil if invalid
  def self.to_e164_ng(raw)
    s = raw.to_s.strip
    return nil if s.empty?

    digits = s.gsub(/\D+/, "") # keep only numbers
    return nil if digits.empty?

    # 0XXXXXXXXXX (11 digits) -> 234XXXXXXXXXX
    if digits.length == 11 && digits.start_with?("0")
      digits = "234" + digits[1..]
    end

    # 10-digit local (no leading 0) -> assume Nigeria
    if digits.length == 10
      digits = "234" + digits
    end

    # Must now be 234 + 10 digits = 13 digits
    return nil unless digits.start_with?("234") && digits.length == 13

    digits
  end
end
