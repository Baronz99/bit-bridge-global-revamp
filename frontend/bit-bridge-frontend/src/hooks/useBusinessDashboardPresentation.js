import { useMemo } from 'react'
import useFinancialAccountViewModel from './useFinancialAccountViewModel'

const MAX_SECONDARY_ACTIONS = 2

const LIFECYCLE_BADGES = {
  setup: 'Complete your business details',
  kyb_review: 'In review',
  awaiting_provision: 'Almost ready',
  live: 'Account ready',
}

const ensureAction = (action) => {
  if (!action?.label || !action?.route) return null
  return {
    key: action.key || action.route,
    label: action.label,
    route: action.route,
    tone: action.tone || 'neutral',
    disabled: Boolean(action.disabled),
    reason: action.reason || '',
  }
}

const uniqueActions = (actions) =>
  actions.filter(Boolean).filter((action, index, collection) => {
    const actionKey = action.key || action.route || action.label
    return collection.findIndex((entry) => (entry.key || entry.route || entry.label) === actionKey) === index
  })

const buildActivationSecondaryActions = ({ status, nextRoute }) => {
  const actions = []

  if (status !== 'setup') {
    actions.push({
      key: 'review_verification',
      label: 'Review verification',
      label: 'Check verification',
      route: '/dashboard/business/kyb',
      tone: 'neutral',
    })
  }

  if (status === 'setup' && nextRoute !== '/dashboard/business/onboarding') {
    actions.push({
      key: 'review_business_profile',
      label: 'Review business details',
      route: '/dashboard/business/onboarding',
      tone: 'neutral',
    })
  }

  actions.push({
    key: 'manage_team',
    label: 'Manage team',
    route: '/dashboard/business/team',
    tone: 'neutral',
  })

  return uniqueActions(actions).slice(0, MAX_SECONDARY_ACTIONS)
}

const buildOperationalSecondaryActions = ({ permissions, approvalSummary }) => {
  const actions = []

  if (permissions.canRunPayroll) {
    actions.push({
      key: 'open_payroll_workspace',
      label: 'Run payroll',
      route: '/dashboard/business/payouts',
      tone: 'neutral',
    })
  }

  if ((approvalSummary?.total_pending || 0) > 0 || permissions.canReviewApprovals) {
    actions.push({
      key: 'open_approval_inbox',
      label: 'Review approvals',
      route: '/dashboard/business/approvals',
      tone: (approvalSummary?.total_pending || 0) > 0 ? 'accent' : 'neutral',
    })
  }

  return uniqueActions(actions).slice(0, MAX_SECONDARY_ACTIONS)
}

const buildActivationOverview = ({ status, progress, nextAction, nextRoute, account, blockingRequirements }) => {
  const overviewItems = []

  if (status === 'awaiting_provision') {
    overviewItems.push({
      key: 'provisioning',
      label: 'Account setup',
      value: account?.account_number ? 'Your receiving account is ready' : 'We are preparing your receiving account',
      tone: account?.account_number ? 'positive' : 'warning',
    })
  } else if (status === 'kyb_review') {
    overviewItems.push({
      key: 'verification',
      label: 'Verification',
      value: 'Your business is being reviewed',
      tone: 'warning',
    })
  } else {
    overviewItems.push({
      key: 'profile',
      label: 'Business details',
      value: progress?.profileReady ? 'Your details are complete' : 'Your business details still need attention',
      tone: progress?.profileReady ? 'positive' : 'warning',
    })
  }

  overviewItems.push({
    key: 'documents',
    label: 'Documents',
    value: progress?.documentsReady ? 'Your documents are complete' : 'Some documents are still needed',
    tone: progress?.documentsReady ? 'positive' : 'warning',
  })

  if (status === 'awaiting_provision') {
    overviewItems.push({
      key: 'next_unlock',
      label: 'What happens next',
      value: account?.account_number ? 'Your business account is ready to use' : 'Your receiving account and inbound funding will be enabled',
      tone: account?.account_number ? 'positive' : 'neutral',
    })
  } else {
    overviewItems.push({
      key: 'next_step',
      label: 'Next step',
      value: nextAction || 'Continue setting up your business account',
      route: nextRoute || '/dashboard/business',
      tone: 'neutral',
    })
  }

  return {
    title: 'Your account progress',
    lifecycleState: status,
    nextStep: nextAction || 'Continue setting up your business account',
    nextRoute: nextRoute || '/dashboard/business',
    progress,
    blockingItems: blockingRequirements,
    items: overviewItems,
  }
}

const buildMetrics = ({ wallet, account, approvalSummary }) => {
  const metrics = [
    {
      key: 'balance',
      type: 'balance',
      label: 'Available balance',
      value: Number(wallet?.available_balance ?? wallet?.balance ?? 0),
      currency: wallet?.currency || 'NGN',
    },
    {
      key: 'receiving_account',
      type: 'receiving_account',
      label: 'Receiving account',
      value: account?.account_number || 'Not provisioned',
      bankName: account?.bank_name || '',
      accountName: account?.account_name || '',
      status: account?.account_status || 'not_available',
    },
  ]

  if ((approvalSummary?.total_pending || 0) > 0) {
    metrics.push({
      key: 'approvals',
      type: 'approvals',
      label: 'Pending approvals',
      value: approvalSummary.total_pending,
      approved: approvalSummary?.total_approved || 0,
      rejected: approvalSummary?.total_rejected || 0,
    })
  }

  return metrics
}

const buildPresentationModel = (viewModel) => {
  const screenMode = viewModel.isLive ? 'operational' : 'activation'
  const lifecycleState = viewModel.status
  const statusBadge = LIFECYCLE_BADGES[lifecycleState] || 'Business banking'

  if (screenMode === 'activation') {
    const primaryAction = ensureAction(viewModel.primaryFinancialAction)
    const secondaryActions = buildActivationSecondaryActions({
      status: lifecycleState,
      nextRoute: viewModel.nextRoute,
    }).filter((action) => action.key !== primaryAction?.key)

    return {
      screenMode,
      hero: {
        title: viewModel.entity?.name || 'Set up your business account',
        subtitle:
          viewModel.nextAction ||
          'Complete the remaining steps to verify your business and unlock your account.',
        statusBadge,
        primaryAction,
        secondaryActions,
      },
      statusSummary: buildActivationOverview({
        status: lifecycleState,
        progress: viewModel.progress,
        nextAction: viewModel.nextAction,
        nextRoute: viewModel.nextRoute,
        account: viewModel.account,
        blockingRequirements: viewModel.blockingRequirements,
      }),
      metrics: [],
      activitySection: null,
      navigationItems: [
        { key: 'overview', label: 'Overview', route: '/dashboard/business' },
        { key: 'onboarding', label: 'Business details', route: '/dashboard/business/onboarding' },
        { key: 'verification', label: 'Documents and review', route: '/dashboard/business/kyb' },
        { key: 'team', label: 'Team', route: '/dashboard/business/team' },
        { key: 'settings', label: 'Settings', route: '/dashboard/business/settings' },
      ],
    }
  }

  const primaryAction = ensureAction(viewModel.primaryFinancialAction)
  const secondaryActions = buildOperationalSecondaryActions({
    permissions: viewModel.permissions,
    approvalSummary: viewModel.approvalSummary,
  }).filter((action) => action.key !== primaryAction?.key)

  return {
    screenMode,
    hero: {
      title: viewModel.entity?.name || 'Business account overview',
      subtitle: 'View balances, account details, and approvals from one place.',
      statusBadge,
      primaryAction,
      secondaryActions,
    },
    statusSummary: {
      lifecycleState,
      progress: null,
      nextStep: null,
      blockingItems: [],
    },
    metrics: buildMetrics({
      wallet: viewModel.wallet,
      account: viewModel.account,
      approvalSummary: viewModel.approvalSummary,
    }),
    activitySection: {
      key: 'recent_activity',
      title: 'Recent business activity',
      emptyState: 'Transactions and incoming funds will appear here once your account starts moving money.',
    },
    navigationItems: viewModel.visibleNavigationItems,
  }
}

const useBusinessDashboardPresentation = (accountId) => {
  const financialAccount = useFinancialAccountViewModel(accountId)

  const presentation = useMemo(() => buildPresentationModel(financialAccount), [financialAccount])

  return {
    ...financialAccount,
    presentation,
    screenMode: presentation.screenMode,
    hero: presentation.hero,
    statusSummary: presentation.statusSummary,
    metrics: presentation.metrics,
    activitySection: presentation.activitySection,
    navigationItems: presentation.navigationItems,
  }
}

export default useBusinessDashboardPresentation
