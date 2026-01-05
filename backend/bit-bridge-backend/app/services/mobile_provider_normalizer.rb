# app/services/mobile_provider_normalizer.rb
class MobileProviderNormalizer
  def self.normalize(raw)
    s = raw.to_s.strip.downcase

    return 'mtn'     if s.include?('mtn')
    return 'airtel'  if s.include?('airtel')
    return 'glo'     if s.include?('glo')

    # 9mobile variations
    if s.include?('9mobile') ||
       s.include?('9-mobile') ||
       s.include?('9 mobile') ||
       s.include?('etisalat') ||
       s.include?('emts')
      return '9mobile'
    end

    # fallback: remove spaces & hyphens
    s.gsub(/[\s\-]/, '')
  end
end
