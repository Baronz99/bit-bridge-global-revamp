const asObject = (value) => (value && typeof value === 'object' ? value : {})

const asArray = (value) => (Array.isArray(value) ? value : [])

const pickString = (...values) => {
  for (const value of values) {
    const normalized = String(value ?? '').trim()
    if (normalized) return normalized
  }
  return ''
}

const extractAccountsList = (raw) => {
  const root = asObject(raw)
  const payload = root?.data ?? root

  if (Array.isArray(payload)) return payload

  const objectPayload = asObject(payload)
  const candidates = [
    objectPayload.accounts,
    objectPayload.items,
    objectPayload.results,
    objectPayload.data,
    objectPayload.user_accounts,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate
  }

  return []
}

const detectAnchorAccount = (accounts) =>
  asArray(accounts).find((account) => String(account?.vendor || '').toLowerCase() === 'anchor') || null

const extractDetailData = (detailResponse) => {
  if (detailResponse == null) return null
  if (Object.prototype.hasOwnProperty.call(detailResponse, 'data')) {
    const payload = detailResponse?.data
    if (!payload || Array.isArray(payload) || typeof payload !== 'object') return null
    return payload
  }
  if (Array.isArray(detailResponse) || typeof detailResponse !== 'object') return null
  return detailResponse
}

const extractDetailAccountNumber = (detailData) => {
  const attributes = asObject(detailData?.attributes)
  const bank = asObject(attributes?.bank)

  return pickString(
    detailData?.account_number,
    detailData?.accountNumber,
    attributes?.account_number,
    attributes?.accountNumber,
    bank?.accountNumber
  )
}

const extractDetailAccountName = (detailData) => {
  const attributes = asObject(detailData?.attributes)
  const bank = asObject(attributes?.bank)

  return pickString(
    detailData?.account_name,
    detailData?.accountName,
    detailData?.name,
    attributes?.account_name,
    attributes?.accountName,
    attributes?.name,
    bank?.accountName,
    bank?.account_name
  )
}

const extractDetailBankName = (detailData) => {
  const attributes = asObject(detailData?.attributes)
  const bank = asObject(attributes?.bank)

  return pickString(
    detailData?.bank_name,
    detailData?.bankName,
    detailData?.bank,
    attributes?.bank_name,
    attributes?.bankName,
    bank?.name
  )
}

const parseBackendFlow = (onboardingResponse, detailResponse) => {
  const flow =
    onboardingResponse?.flow ||
    onboardingResponse?.data?.flow ||
    detailResponse?.flow ||
    detailResponse?.data?.flow ||
    {}

  const state = String(flow?.state || '').trim().toLowerCase() || 'unknown'
  const nextAction = String(flow?.next_action || '').trim() || null

  return {
    state,
    nextAction,
  }
}

export const normalizeAnchorOnboarding = ({
  detailResponse,
  userAccountsResponse,
  onboardingResponse,
} = {}) => {
  const detailData = extractDetailData(detailResponse)
  const accounts = extractAccountsList(userAccountsResponse)
  const anchorAccount = detectAnchorAccount(accounts)
  const backendFlow = parseBackendFlow(onboardingResponse, detailResponse)
  const capabilities = asObject(onboardingResponse?.capabilities)
  const requirements = asObject(onboardingResponse?.requirements)

  const hasAnchorAccount =
    onboardingResponse?.has_anchor_account === true ||
    onboardingResponse?.extra?.has_anchor_account === true ||
    Boolean(anchorAccount) ||
    Boolean(detailData && Object.keys(detailData).length > 0)

  const accountNumber = pickString(
    anchorAccount?.account_number,
    anchorAccount?.accountNumber,
    extractDetailAccountNumber(detailData)
  )

  const accountName = pickString(
    anchorAccount?.account_name,
    anchorAccount?.accountName,
    extractDetailAccountName(detailData)
  )

  const bankName = pickString(
    anchorAccount?.bank_name,
    anchorAccount?.bankName,
    anchorAccount?.bank,
    extractDetailBankName(detailData)
  )

  const hasAccountNumber =
    onboardingResponse?.has_deposit_account === true ||
    onboardingResponse?.extra?.has_deposit_account === true ||
    Boolean(accountNumber)

  const depositReady =
    backendFlow.state === 'provisioned' ||
    capabilities?.can_fund_wallet === true ||
    hasAccountNumber

  const nextStep =
    backendFlow.state === 'provisioned'
      ? 'DONE'
      : backendFlow.state === 'customer_created_no_deposit_account'
      ? 'GENERATE_NUMBER'
      : backendFlow.state === 'blocked_kyc'
      ? 'DO_KYC'
      : backendFlow.state === 'pending_kyc_review'
      ? 'DO_KYC'
      : 'CREATE_ANCHOR'

  return {
    hasAnchorAccount,
    hasAccountNumber,
    accountNumber: accountNumber || null,
    accountName: accountName || null,
    bankName: bankName || null,
    depositReady,
    backendFlowState: backendFlow.state,
    backendNextAction: backendFlow.nextAction,
    nextStep,
    capabilities: Object.keys(capabilities).length ? capabilities : null,
    requirements: Object.keys(requirements).length ? requirements : null,
    anchorAccount,
  }
}

export const describeAnchorFlow = (normalized) => {
  switch (normalized?.backendFlowState) {
    case 'provisioned':
      return {
        eyebrow: 'Deposit account ready',
        title: 'Your NGN receiving account is active',
        detail: 'Use this account to receive local transfers directly into your BitBridge wallet.',
      }
    case 'customer_created_no_deposit_account':
      return {
        eyebrow: 'Provision account number',
        title: 'Your Anchor profile is verified',
        detail: 'Finish setup to generate the deposit account number tied to your NGN wallet.',
      }
    case 'pending_kyc_review':
      return {
        eyebrow: 'Provider review',
        title: 'Anchor is reviewing your identity',
        detail: 'Your profile is with the provider. Refresh shortly to check if the account number is ready.',
      }
    case 'blocked_kyc':
      return {
        eyebrow: 'Complete identity check',
        title: 'Anchor still needs KYC confirmation',
        detail: 'We can continue setup as soon as the required identity fields are confirmed.',
      }
    case 'blocked_profile_incomplete':
      return {
        eyebrow: 'Complete profile',
        title: 'Profile details are required first',
        detail: 'Anchor needs a complete address and identity profile before a deposit account can be created.',
      }
    case 'blocked_phone_exists':
      return {
        eyebrow: 'Provider attention needed',
        title: 'This phone number already exists at provider',
        detail: 'Retry after refresh or contact support if the account does not recover automatically.',
      }
    default:
      return {
        eyebrow: 'Create deposit account',
        title: 'Set up your NGN receiving account',
        detail: 'Create an Anchor-backed account once and use it for local transfers into BitBridge.',
      }
  }
}
