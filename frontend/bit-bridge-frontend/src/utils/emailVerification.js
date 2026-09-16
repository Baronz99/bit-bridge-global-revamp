export const EMAIL_VERIFICATION_SUCCESS_MESSAGE = 'Verification email sent.'
export const EMAIL_VERIFICATION_COOLDOWN_MESSAGE =
  'Please wait before requesting another verification email.'

const asText = (value) => String(value || '').trim()

export const getEmailVerificationState = (user) => {
  const email = asText(user?.email)
  const emailVerifiedAt = user?.email_verified_at ?? null
  const emailVerificationPending = user?.email_verification_pending ?? null
  const emailVerificationSentAt = user?.email_verification_sent_at ?? null
  const isVerified = Boolean(emailVerifiedAt)
  const canPrompt = Boolean(email) && !isVerified

  return {
    email,
    emailVerifiedAt,
    emailVerificationPending,
    emailVerificationSentAt,
    isVerified,
    canPrompt,
  }
}

export const isEmailVerificationCooldownError = (error) => {
  const status = Number(error?.response?.status || 0)
  if (status === 429) return true

  const code = asText(error?.response?.data?.error_code || error?.response?.data?.code).toLowerCase()
  if (code.includes('cooldown') || code.includes('rate') || code.includes('limit')) return true

  const message = asText(error?.response?.data?.message || error?.response?.data?.error || error?.message).toLowerCase()
  return (
    message.includes('please wait') ||
    message.includes('too many') ||
    message.includes('rate limit') ||
    message.includes('cooldown') ||
    message.includes('try again later')
  )
}

export const getEmailVerificationFeedback = (error) => {
  if (isEmailVerificationCooldownError(error)) return EMAIL_VERIFICATION_COOLDOWN_MESSAGE

  return (
    asText(error?.response?.data?.message) ||
    asText(error?.response?.data?.error) ||
    'Unable to send verification email right now.'
  )
}

export const getEmailVerificationDismissKey = (email) =>
  `bb_email_verification_dismissed:${asText(email).toLowerCase()}`
