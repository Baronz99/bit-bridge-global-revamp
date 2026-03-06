export const getTier1MissingDetails = (user) => {
  const missing = []
  const profile = user?.user_profile || {}

  if (!profile?.first_name || !profile?.last_name) {
    missing.push('Full name')
  }

  if (!profile?.date_of_birth) {
    missing.push('Date of birth')
  }

  const phoneVerified =
    user?.phone_verified === true ||
    !!user?.phone_verified_at ||
    !!profile?.phone_verified_at

  if (!phoneVerified) {
    missing.push('Phone verification')
  }

  return missing
}

const TIER_RANKS = {
  tier_0: 0,
  tier_1: 1,
  tier_2: 2,
  tier_3: 3,
  tier_4: 4,
}

export const normalizeKycLevel = (raw) => {
  const value = (raw ?? '').toString().toLowerCase()
  if (!value || value === 'nil') return 'tier_0'
  if (value.includes('tier_4') || value.includes('tier4')) return 'tier_4'
  if (value.includes('tier_3')) return 'tier_3'
  if (value.includes('tier_2')) return 'tier_2'
  if (value.includes('tier_1')) return 'tier_1'
  if (value.includes('tier_0')) return 'tier_0'
  return value
}

export const kycRank = (rawLevel) => {
  const normalized = normalizeKycLevel(rawLevel)
  return TIER_RANKS[normalized] ?? 0
}

export const kycAtLeast = (rawLevel, requiredLevel) =>
  kycRank(rawLevel) >= kycRank(requiredLevel)

export const needsTier2Access = (user) => !kycAtLeast(user?.kyc_level, 'tier_2')

export const withTier1MissingDetails = (user, baseMessage) => {
  const missing = getTier1MissingDetails(user)
  if (!missing.length) return baseMessage
  return `${baseMessage} Missing: ${missing.join(', ')}.`
}

export const getTier2MissingDetails = (user) => {
  const missing = []
  const profile = user?.user_profile || {}
  const kyc = user?.user_kyc || {}

  if (kyc?.bvn_status !== 'verified') {
    missing.push('BVN verification')
  }

  if (!user?.id_type) {
    missing.push('ID type')
  }

  const hasIdentityEvidence =
    !!profile?.id_document_url || kyc?.nin_status === 'verified' || !!kyc?.nin_verified_at

  if (!hasIdentityEvidence) {
    missing.push('ID document')
  }

  return missing
}

export const withTier2MissingDetails = (user, baseMessage) => {
  const missing = getTier2MissingDetails(user)
  if (!missing.length) return baseMessage
  return `${baseMessage} Missing: ${missing.join(', ')}.`
}
