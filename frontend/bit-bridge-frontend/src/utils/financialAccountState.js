const DEFAULT_ROUTE_BY_ACTION = {
  complete_business_details: '/dashboard/business/onboarding',
  complete_contact_details: '/dashboard/business/onboarding',
  add_signatory: '/dashboard/business/onboarding',
  upload_documents: '/dashboard/business/kyb',
  track_verification: '/dashboard/business/kyb',
  review_provider_status: '/dashboard/business/kyb',
  activate_business_account: '/dashboard/business',
}

const ACTION_LABELS = {
  complete_business_details: 'Complete business details',
  complete_contact_details: 'Add contact details',
  add_signatory: 'Add signatory',
  upload_documents: 'Upload required documents',
  track_verification: 'Track KYB review',
  review_provider_status: 'Review provider status',
  activate_business_account: 'Activate business account',
  open_transfer_workspace: 'New transfer',
  open_payroll_workspace: 'Open payroll',
  open_approval_inbox: 'Open approval inbox',
  manage_team: 'Manage team',
  manage_policies: 'Manage approval policies',
  manage_settings: 'Manage transfer controls',
  review_receipts: 'Review receipts',
}

const NAV_ITEMS = [
  { key: 'overview', label: 'Overview', route: '/dashboard/business' },
  { key: 'transfers', label: 'Transfers', route: '/dashboard/business/transfers' },
  { key: 'payroll', label: 'Payroll', route: '/dashboard/business/payouts' },
  { key: 'approvals', label: 'Approvals', route: '/dashboard/business/approvals' },
  { key: 'team', label: 'Team', route: '/dashboard/business/team' },
  { key: 'policies', label: 'Policies', route: '/dashboard/business/policies' },
  { key: 'settings', label: 'Settings', route: '/dashboard/business/settings' },
  { key: 'receipts', label: 'Receipts', route: '/dashboard/business/receipts' },
]

const normalizeString = (value) => String(value || '').trim()
const normalizeLower = (value) => normalizeString(value).toLowerCase()

const uniqueList = (values) => [...new Set((Array.isArray(values) ? values : []).filter(Boolean))]

const titleCase = (value) =>
  normalizeString(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())

export const toActionDescriptor = (actionKey, override = {}) => {
  if (!actionKey && !override.label && !override.route) return null

  return {
    key: actionKey || override.key || null,
    label: override.label || ACTION_LABELS[actionKey] || 'Continue',
    route: override.route || DEFAULT_ROUTE_BY_ACTION[actionKey] || '/dashboard/business',
    tone: override.tone || 'neutral',
    disabled: Boolean(override.disabled),
    reason: override.reason || '',
  }
}

export const deriveFinancialAccountState = ({
  entity = null,
  onboarding = null,
  kyb = null,
  wallet = null,
  account = null,
  approvalSummary = null,
  settings = null,
  approvalPolicies = [],
} = {}) => {
  const readiness = onboarding?.readiness || kyb?.readiness || null
  const journey = onboarding?.journey || kyb?.journey || null
  const requirements = onboarding?.requirements || kyb?.requirements || null
  const kybGate = kyb?.gate || null
  const normalizedStatus = normalizeLower(entity?.status)
  const role = normalizeLower(entity?.current_user_role || onboarding?.business_entity?.current_user_role)
  const hasReceivingAccount = Boolean(account?.account_number)
  const approvedForProvisioning =
    Boolean(kybGate?.approved_for_provisioning) || ['approved', 'active'].includes(normalizedStatus)
  const canProvision =
    Boolean(entity?.provisioning_gate?.can_provision_business_account) ||
    Boolean(kybGate?.can_provision_business_account)

  let status = 'setup'
  if (normalizedStatus === 'active' || hasReceivingAccount) status = 'live'
  else if (approvedForProvisioning) status = 'awaiting_provision'
  else if (normalizedStatus === 'under_review' || kybGate?.submitted) status = 'kyb_review'

  const activePolicyFromEntity = Array.isArray(entity?.active_approval_policies)
    ? entity.active_approval_policies.find((policy) => policy?.active) || entity.active_approval_policies[0] || null
    : null
  const activePolicyFromList = Array.isArray(approvalPolicies)
    ? approvalPolicies.find((policy) => policy?.active) || approvalPolicies[0] || null
    : null
  const activeApprovalPolicy = activePolicyFromEntity || activePolicyFromList || null

  const transferControls = settings?.transfer_controls || settings || {}
  const initiatorRoles = uniqueList(transferControls?.initiator_roles)
  const draftOnlyRoles = uniqueList(transferControls?.draft_only_roles)
  const requiredApprovalRoles = uniqueList(activeApprovalPolicy?.required_roles)
  const defaultReviewRoles = uniqueList(['owner', 'admin', 'approver'])
  const reviewRoles = requiredApprovalRoles.length
    ? uniqueList([...requiredApprovalRoles, ...defaultReviewRoles])
    : defaultReviewRoles

  const canInitiateTransferByRole = initiatorRoles.length
    ? initiatorRoles.includes(role)
    : ['owner', 'admin'].includes(role)
  const canDraftTransferByRole = draftOnlyRoles.length ? draftOnlyRoles.includes(role) : false

  const canInitiateTransfer = status === 'live' && canInitiateTransferByRole
  const canDraftTransfer = status === 'live' && !canInitiateTransfer && canDraftTransferByRole
  const canRunPayroll = status === 'live' && (canInitiateTransfer || canDraftTransfer)
  const canReviewApprovals = status === 'live' && reviewRoles.includes(role)

  const blockingRequirements = uniqueList([
    ...(Array.isArray(readiness?.missing_profile_fields) ? readiness.missing_profile_fields : []),
    ...(() => {
      const signatoryRequirements = Array.isArray(readiness?.missing_signatory_requirements)
        ? readiness.missing_signatory_requirements
        : []
      const signatoryFields = Array.isArray(readiness?.missing_signatory_fields) ? readiness.missing_signatory_fields : []
      return signatoryFields.length ? signatoryRequirements.filter((item) => item !== 'officer_details') : signatoryRequirements
    })(),
    ...(Array.isArray(readiness?.missing_signatory_fields) ? readiness.missing_signatory_fields : []),
    ...(Array.isArray(readiness?.missing_document_kinds) ? readiness.missing_document_kinds : []),
    ...(Array.isArray(requirements?.groups?.company_details?.missing_fields)
      ? requirements.groups.company_details.missing_fields
      : []),
    ...(Array.isArray(requirements?.groups?.contact_details?.missing_fields)
      ? requirements.groups.contact_details.missing_fields
      : []),
  ]).map((item) => ({
    key: item,
    label: titleCase(item),
  }))

  const journeyAction = normalizeString(journey?.next_action)
  const nextRoute = normalizeString(journey?.next_route) || DEFAULT_ROUTE_BY_ACTION[journeyAction] || '/dashboard/business'
  const nextAction = ACTION_LABELS[journeyAction] || journey?.title || journey?.body || 'Continue business setup'

  const dashboardMode = status === 'live' ? 'operational' : 'onboarding'

  let primaryFinancialAction = null
  if (status === 'live') {
    if (canInitiateTransfer) {
      primaryFinancialAction = toActionDescriptor('open_transfer_workspace', {
        route: '/dashboard/business/send',
        tone: 'primary',
      })
    } else if (canDraftTransfer) {
      primaryFinancialAction = toActionDescriptor('open_transfer_workspace', {
        label: 'Draft transfer',
        route: '/dashboard/business/send',
        tone: 'primary',
      })
    } else if (canReviewApprovals) {
      primaryFinancialAction = toActionDescriptor('open_approval_inbox', {
        route: '/dashboard/business/approvals',
        tone: 'primary',
      })
    }
  } else if (status === 'awaiting_provision' && canProvision) {
    primaryFinancialAction = toActionDescriptor('activate_business_account', {
      route: '/dashboard/business',
      tone: 'primary',
    })
  } else {
    primaryFinancialAction = toActionDescriptor(journeyAction, {
      label: nextAction,
      route: nextRoute,
      tone: 'primary',
    })
  }

  const secondaryActions = [
    status !== 'live'
      ? toActionDescriptor(null, {
          key: 'continue_setup',
          label: nextAction,
          route: nextRoute,
          tone: 'accent',
        })
      : null,
    status !== 'setup'
      ? toActionDescriptor('track_verification', {
          route: '/dashboard/business/kyb',
          tone: 'neutral',
        })
      : null,
    status === 'awaiting_provision' && canProvision
      ? toActionDescriptor('activate_business_account', {
          route: '/dashboard/business',
          tone: 'accent',
        })
      : null,
    canInitiateTransfer || canDraftTransfer
      ? toActionDescriptor('open_transfer_workspace', {
          label: canDraftTransfer && !canInitiateTransfer ? 'Draft transfer' : 'New transfer',
          route: '/dashboard/business/send',
        })
      : null,
    canRunPayroll
      ? toActionDescriptor('open_payroll_workspace', {
          route: '/dashboard/business/payouts',
        })
      : null,
    canReviewApprovals || (approvalSummary?.total_pending || 0) > 0
      ? toActionDescriptor('open_approval_inbox', {
          route: '/dashboard/business/approvals',
        })
      : null,
    toActionDescriptor('manage_team', {
      route: '/dashboard/business/team',
    }),
    toActionDescriptor('manage_policies', {
      route: '/dashboard/business/policies',
    }),
    toActionDescriptor('manage_settings', {
      route: '/dashboard/business/settings',
    }),
    status === 'live'
      ? toActionDescriptor('review_receipts', {
          route: '/dashboard/business/receipts',
        })
      : null,
    status !== 'live'
      ? toActionDescriptor(null, {
          key: 'review_kyb_documents',
          label: 'Review KYB documents',
          route: '/dashboard/business/kyb',
        })
      : null,
  ]
    .filter(Boolean)
    .filter((item, index, collection) => collection.findIndex((entry) => entry.key === item.key) === index)
    .slice(0, 12)

  const visibleNavigationItems = NAV_ITEMS.filter((item) => {
    if (status === 'live') {
      if (item.key === 'transfers') return canInitiateTransfer || canDraftTransfer || canReviewApprovals
      if (item.key === 'payroll') return canRunPayroll
      if (item.key === 'approvals') return canReviewApprovals || (approvalSummary?.total_pending || 0) > 0
      if (item.key === 'receipts') return true
      return true
    }

    return ['overview', 'team', 'policies', 'settings'].includes(item.key)
  }).map((item) => ({
    ...item,
    badge: item.key === 'approvals' && (approvalSummary?.total_pending || 0) > 0 ? approvalSummary.total_pending : null,
  }))

  const heroActions = [
    primaryFinancialAction,
    ...secondaryActions.filter((item) => item.key !== primaryFinancialAction?.key),
  ].slice(0, status === 'live' ? 3 : 2)

  return {
    entity,
    wallet,
    account,
    approvalSummary,
    currentUserRole: role,
    onboarding: {
      readiness,
      journey,
      requirements,
    },
    kyb: {
      gate: kybGate,
      provider: kyb?.provider || null,
      events: Array.isArray(kyb?.events) ? kyb.events : [],
    },
    financialControls: {
      settings: transferControls,
      initiatorRoles,
      draftOnlyRoles,
      approvalPolicies: Array.isArray(approvalPolicies) ? approvalPolicies : [],
      activeApprovalPolicy,
    },
    role,
    status,
    isSetup: status === 'setup',
    isUnderReview: status === 'kyb_review',
    isAwaitingProvision: status === 'awaiting_provision',
    isLive: status === 'live',
    canInitiateTransfer,
    canDraftTransfer,
    canRunPayroll,
    canReviewApprovals,
    permissions: {
      canInitiateTransfer,
      canDraftTransfer,
      canRunPayroll,
      canReviewApprovals,
    },
    progress: {
      readiness,
      journey,
      blockingRequirements,
      profileReady: Boolean(readiness?.profile_ready) || (normalizedStatus !== 'draft' && Boolean(entity)),
      submissionReady:
        Boolean(kybGate?.can_submit_kyb) ||
        Boolean(readiness?.provider_submission_ready) ||
        Boolean(readiness?.ready_for_kyb_submission),
      documentsReady:
        Boolean(readiness?.documents_ready) || ['under_review', 'approved', 'active'].includes(normalizedStatus),
      approvedForProvisioning,
      canProvision,
    },
    nextAction,
    nextRoute,
    blockingRequirements,
    dashboardMode,
    primaryFinancialAction,
    secondaryActions,
    visibleNavigationItems,
    heroActions,
    ui: {
      dashboardMode,
      primaryFinancialAction,
      secondaryActions,
      visibleNavigationItems,
      heroActions,
    },
  }
}
