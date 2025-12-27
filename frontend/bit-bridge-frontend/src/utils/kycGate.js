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

  const hasAddress =
    profile?.address_line1 &&
    profile?.city &&
    profile?.state &&
    profile?.country

  if (!hasAddress) {
    missing.push('Address')
  }

  if (!profile?.proof_of_address_type) {
    missing.push('Proof of address type')
  }

  if (!profile?.id_document_url) {
    missing.push('ID document')
  }

  if (!profile?.proof_of_address_url) {
    missing.push('Proof of address')
  }

  return missing
}

export const withTier2MissingDetails = (user, baseMessage) => {
  const missing = getTier2MissingDetails(user)
  if (!missing.length) return baseMessage
  return `${baseMessage} Missing: ${missing.join(', ')}.`
}
