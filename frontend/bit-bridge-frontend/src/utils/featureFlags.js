const truthy = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase()
  return ['1', 'true', 'yes', 'on'].includes(normalized)
}

const explicitFlagValue = (...values) =>
  values.find((value) => String(value ?? '').trim() !== '')

const phoneFirstSignupFlag =
  typeof __PHONE_FIRST_SIGNUP_ENABLED__ !== 'undefined' ? __PHONE_FIRST_SIGNUP_ENABLED__ : undefined
const phoneFirstSignupLegacyFlag =
  typeof __PHONE_FIRST_SIGNUP_LEGACY__ !== 'undefined' ? __PHONE_FIRST_SIGNUP_LEGACY__ : undefined

export const resolveFeatureFlag = ({ defaultValue = false, values = [] } = {}) => {
  const flag = explicitFlagValue(...values)
  if (flag === undefined) return defaultValue
  return truthy(flag)
}

export const isPhoneFirstSignupEnabled = () =>
  resolveFeatureFlag({
    defaultValue: true,
    values: [phoneFirstSignupFlag, phoneFirstSignupLegacyFlag],
  })
