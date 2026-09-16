const getObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {})

const getArray = (value) => (Array.isArray(value) ? value : [])

export const extractCirclePayload = (payload) => {
  const root = getObject(payload)
  return getObject(root.data && typeof root.data === 'object' && !Array.isArray(root.data) ? root.data : root)
}

export const extractCircleContextPayload = (payload) => {
  const root = extractCirclePayload(payload)
  return {
    circle: getObject(root.circle),
    balance: getObject(root.balance),
    permissions: getObject(root.permissions),
    dues_summary: getObject(root.dues_summary),
    approvals: getObject(root.approvals),
    recent_activity: getObject(root.recent_activity),
  }
}

export const extractCircleRecentActivity = (payload) => {
  const root = extractCirclePayload(payload)
  const context = extractCircleContextPayload(root)

  return getArray(context.recent_activity.items).length
    ? getArray(context.recent_activity.items)
    : getArray(root.recent_transactions).length
      ? getArray(root.recent_transactions)
      : getArray(root.transactions).length
        ? getArray(root.transactions)
        : getArray(root.timeline)
}

const normalizeLegacyDuesSummary = (circle) => {
  const plan = getObject(circle.monthly_due_plan)
  if (!Object.keys(plan).length) return { enabled: false }

  return {
    enabled: true,
    ...plan,
  }
}

const normalizeTreasuryAccount = (payload) => {
  const root = getObject(payload?.data ?? payload)
  const treasuryAccount = getObject(
    root.treasury_account && typeof root.treasury_account === 'object' && !Array.isArray(root.treasury_account)
      ? root.treasury_account
      : root.account && typeof root.account === 'object' && !Array.isArray(root.account)
        ? root.account
        : root
  )

  if (!Object.keys(treasuryAccount).length) return {}
  return treasuryAccount
}

export const normalizeCircleWorkspace = ({ circlePayload, contextPayload, treasuryPayload } = {}) => {
  const circle = extractCirclePayload(circlePayload)
  const context = extractCircleContextPayload(contextPayload)
  const treasuryAccount = normalizeTreasuryAccount(treasuryPayload)
  const recentItems = extractCircleRecentActivity(contextPayload || circlePayload)
  const balance = getObject(context.balance)
  const permissions = getObject(context.permissions)
  const approvals = getObject(context.approvals)
  const duesSummary = Object.keys(context.dues_summary || {}).length
    ? context.dues_summary
    : normalizeLegacyDuesSummary(circle)
  const treasuryBalanceCents =
    treasuryAccount.balance_cents != null ? Number(treasuryAccount.balance_cents || 0) : null
  const contextBalanceCents =
    balance.balance_cents != null ? Number(balance.balance_cents || 0) : null
  const circleBalanceCents = Number(circle.balance_cents || 0)
  const resolvedBalanceCents =
    treasuryBalanceCents != null
      ? treasuryBalanceCents
      : contextBalanceCents != null
        ? contextBalanceCents
        : circleBalanceCents

  return {
    ...circle,
    ...context.circle,
    current_user_role:
      context.circle.role ||
      circle.current_user_role ||
      circle.membership_role ||
      circle.role ||
      'member',
    role:
      context.circle.role ||
      circle.role ||
      circle.current_user_role ||
      circle.membership_role ||
      'member',
    member_count:
      Number(context.circle.member_count || circle.member_count || circle.members_count || 0) || 0,
    balance_cents: resolvedBalanceCents,
    treasury_balance_cents: treasuryBalanceCents,
    treasury_account: treasuryAccount,
    circle_balance_cents: circleBalanceCents,
    balance_visible: balance.visible != null ? Boolean(balance.visible) : circle.balance_visible !== false,
    permissions: {
      can_contribute: permissions.can_contribute !== false,
      can_pay_dues: Boolean(permissions.can_pay_dues),
      can_manage_due_plan: Boolean(permissions.can_manage_due_plan),
      can_withdraw: Boolean(permissions.can_withdraw ?? circle.can_withdraw),
      can_approve_withdrawals: Boolean(permissions.can_approve_withdrawals),
      can_invite_members: Boolean(permissions.can_invite_members ?? circle.can_invite),
      can_manage_members: Boolean(permissions.can_manage_members ?? circle.can_invite),
      can_assign_admin: Boolean(permissions.can_assign_admin ?? circle.can_assign_admin),
      can_manage_settings: Boolean(permissions.can_manage_settings ?? circle.can_assign_admin),
      can_manage_governance: Boolean(permissions.can_manage_governance ?? circle.can_assign_admin),
      can_view_reports: Boolean(permissions.can_view_reports),
      can_view_balance: balance.visible != null ? Boolean(balance.visible) : circle.balance_visible !== false,
    },
    dues_summary: duesSummary,
    monthly_due_plan: duesSummary.enabled ? duesSummary : circle.monthly_due_plan || null,
    approvals,
    recent_activity: {
      ...context.recent_activity,
      items: recentItems,
    },
    recent_transactions: recentItems,
  }
}

export const buildCircleWorkspaceActions = (circleId, workspace) => {
  const permissions = getObject(workspace?.permissions)
  const duesSummary = getObject(workspace?.dues_summary)
  const actions = []

  if (permissions.can_contribute !== false) {
    actions.push({
      key: 'contribute',
      label: 'Contribute to Treasury',
      to: `/dashboard/shared-groups/${circleId}/pay`,
      primary: true,
    })
  }

  if (permissions.can_pay_dues && duesSummary.enabled) {
    actions.push({
      key: 'dues',
      label: 'Pay Dues',
      to: `/dashboard/shared-groups/${circleId}/pay`,
    })
  }

  if (permissions.can_approve_withdrawals) {
    actions.push({
      key: 'approvals',
      label: 'Review Approvals',
      to: `/dashboard/shared-groups/${circleId}`,
    })
  }

  if (permissions.can_manage_governance || permissions.can_assign_admin) {
    actions.push({
      key: 'governance',
      label: 'Governance',
      to: `/dashboard/shared-groups/${circleId}`,
    })
  }

  actions.push({
    key: 'open-circle',
    label: 'Open Circle',
    to: `/dashboard/shared-groups/${circleId}`,
  })
  actions.push({
    key: 'all-circles',
    label: 'All Circles',
    to: '/dashboard/shared-groups',
  })

  return actions
}
