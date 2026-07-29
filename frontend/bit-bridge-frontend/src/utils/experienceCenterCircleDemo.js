import {
  AMAKA_VENDOR_PAYOUT_COMPLETED_EVENT_ID,
  AMAKA_VENDOR_PAYOUT_REQUEST_EVENT_ID,
  CHIDI_JULY_SECURITY_PAYMENT_EVENT_ID,
  GREENFIELD_CIRCLE_FIXTURE,
  GREENFIELD_MEMBER_PAYMENT_AMOUNT,
  GREENFIELD_PAYOUT_FEE,
  GREENFIELD_PAYOUT_PRINCIPAL,
  TUNDE_VENDOR_PAYOUT_APPROVAL_EVENT_ID,
} from './experienceCenterDemoData.js'

const clone = (value) => JSON.parse(JSON.stringify(value))

const formatNaira = (amount, maximumFractionDigits = 0) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: maximumFractionDigits,
    maximumFractionDigits,
  }).format(amount)

export const createInitialGreenfieldSimulationState = () => ({
  chapterState: {
    memberPaymentStep: 'review',
    payoutRequestStep: 'draft',
    payoutApprovalStep: 'awaiting_review',
    payoutExecutionStep: 'idle',
    activeActivityTab: 'activity',
  },
  wallet: {
    label: GREENFIELD_CIRCLE_FIXTURE.wallet.label,
    balanceBeforePayment: GREENFIELD_CIRCLE_FIXTURE.wallet.balanceBeforePayment,
    balanceCurrent: GREENFIELD_CIRCLE_FIXTURE.wallet.balanceBeforePayment,
  },
  obligation: {
    ...clone(GREENFIELD_CIRCLE_FIXTURE.obligation),
    status: 'Outstanding',
    paidAtLabel: null,
  },
  collections: {
    ...clone(GREENFIELD_CIRCLE_FIXTURE.collections),
  },
  treasury: {
    totalBalance: GREENFIELD_CIRCLE_FIXTURE.treasury.totalBalance,
    availableBalance: GREENFIELD_CIRCLE_FIXTURE.treasury.availableBalance,
    designatedBalance: GREENFIELD_CIRCLE_FIXTURE.treasury.designatedBalance,
    designatedLabel: GREENFIELD_CIRCLE_FIXTURE.treasury.designatedLabel,
    designatedSummary: GREENFIELD_CIRCLE_FIXTURE.treasury.designatedSummary,
    projectedOutgoing: 0,
    completedOutgoing: 0,
  },
  circleAccount: clone(GREENFIELD_CIRCLE_FIXTURE.circleAccount),
  externalInflow: clone(GREENFIELD_CIRCLE_FIXTURE.externalInflow),
  payoutRequest: {
    ...clone(GREENFIELD_CIRCLE_FIXTURE.payoutDraft),
    status: 'Not started',
    reviewStatus: 'Not started',
    executionStatus: 'Not started',
    requestedBy: null,
    approvedBy: null,
    submittedAtLabel: null,
    approvedAtLabel: null,
    completedAtLabel: null,
    reference: 'PAY-GREENFIELD-600100',
    statementReady: false,
  },
  recentActivityEntries: clone(GREENFIELD_CIRCLE_FIXTURE.recentActivitySeed),
  timelineEntries: clone(GREENFIELD_CIRCLE_FIXTURE.timelineSeed),
  auditEntries: clone(GREENFIELD_CIRCLE_FIXTURE.auditSeed),
  statementEntries: [],
})

const appendUnique = (items, nextItem) => {
  if (items.some((item) => item.id === nextItem.id)) {
    return items
  }
  return [nextItem, ...items]
}

const normalizeChapterState = (chapterState = {}) => ({
  memberPaymentStep: chapterState.memberPaymentStep || 'review',
  payoutRequestStep: chapterState.payoutRequestStep || 'draft',
  payoutApprovalStep: chapterState.payoutApprovalStep || 'awaiting_review',
  payoutExecutionStep: chapterState.payoutExecutionStep || 'idle',
  activeActivityTab: chapterState.activeActivityTab || 'activity',
})

export const normalizeGreenfieldSimulationState = (simulationState) => {
  const initialState = createInitialGreenfieldSimulationState()
  if (!simulationState || typeof simulationState !== 'object') {
    return initialState
  }

  const normalized = {
    ...initialState,
    ...simulationState,
    chapterState: normalizeChapterState(simulationState.chapterState),
    wallet: {
      ...initialState.wallet,
      ...(simulationState.wallet || {}),
    },
    obligation: {
      ...initialState.obligation,
      ...(simulationState.obligation || {}),
    },
    collections: {
      ...initialState.collections,
      ...(simulationState.collections || {}),
    },
    treasury: {
      ...initialState.treasury,
      ...(simulationState.treasury || {}),
    },
    circleAccount: {
      ...initialState.circleAccount,
      ...(simulationState.circleAccount || {}),
    },
    externalInflow: {
      ...initialState.externalInflow,
      ...(simulationState.externalInflow || {}),
    },
    payoutRequest: {
      ...initialState.payoutRequest,
      ...(simulationState.payoutRequest || {}),
    },
    recentActivityEntries: Array.isArray(simulationState.recentActivityEntries)
      ? simulationState.recentActivityEntries
      : initialState.recentActivityEntries,
    timelineEntries: Array.isArray(simulationState.timelineEntries)
      ? simulationState.timelineEntries
      : initialState.timelineEntries,
    auditEntries: Array.isArray(simulationState.auditEntries)
      ? simulationState.auditEntries
      : initialState.auditEntries,
    statementEntries: Array.isArray(simulationState.statementEntries)
      ? simulationState.statementEntries
      : initialState.statementEntries,
  }

  return normalized
}

export const getSimulationCompletedEventIds = (simulationState) => {
  const state = normalizeGreenfieldSimulationState(simulationState)
  const eventIds = []

  if (state.obligation.status === 'Paid') {
    eventIds.push(CHIDI_JULY_SECURITY_PAYMENT_EVENT_ID)
  }

  if (state.payoutRequest.status !== 'Not started') {
    eventIds.push(AMAKA_VENDOR_PAYOUT_REQUEST_EVENT_ID)
  }

  if (
    state.payoutRequest.reviewStatus === 'Approved' ||
    state.payoutRequest.executionStatus === 'Processing' ||
    state.payoutRequest.executionStatus === 'Completed'
  ) {
    eventIds.push(TUNDE_VENDOR_PAYOUT_APPROVAL_EVENT_ID)
  }

  if (state.payoutRequest.executionStatus === 'Completed') {
    eventIds.push(AMAKA_VENDOR_PAYOUT_COMPLETED_EVENT_ID)
  }

  return eventIds
}

export const recordChidiPayment = (simulationState) => {
  const current = normalizeGreenfieldSimulationState(simulationState)
  if (current.obligation.status === 'Paid') {
    return current
  }

  const member = GREENFIELD_CIRCLE_FIXTURE.roles.chidi

  return {
    ...current,
    chapterState: {
      ...current.chapterState,
      memberPaymentStep: 'recorded',
    },
    wallet: {
      ...current.wallet,
      balanceCurrent: current.wallet.balanceCurrent - GREENFIELD_MEMBER_PAYMENT_AMOUNT,
    },
    obligation: {
      ...current.obligation,
      status: 'Paid',
      paidAtLabel: 'Just now',
    },
    collections: {
      ...current.collections,
      collectedAmount: current.collections.collectedAmount + GREENFIELD_MEMBER_PAYMENT_AMOUNT,
      outstandingAmount: current.collections.outstandingAmount - GREENFIELD_MEMBER_PAYMENT_AMOUNT,
    },
    treasury: {
      ...current.treasury,
      totalBalance: current.treasury.totalBalance + GREENFIELD_MEMBER_PAYMENT_AMOUNT,
      availableBalance: current.treasury.availableBalance + GREENFIELD_MEMBER_PAYMENT_AMOUNT,
    },
    recentActivityEntries: appendUnique(current.recentActivityEntries, {
      id: 'activity-chidi-payment',
      title: `${member.name} paid July Security Levy`,
      detail: 'Recorded from Emma Carter’s BitBridge NGN Wallet.',
      amountLabel: '+₦25,000',
      tone: 'positive',
      occurredAt: 'Just now',
    }),
    timelineEntries: appendUnique(current.timelineEntries, {
      id: 'timeline-chidi-payment',
      title: `${member.name} paid July Security Levy`,
      description: 'Greenfield’s balance increased and the obligation was marked paid.',
      occurredAt: 'Just now',
      tone: 'positive',
    }),
    auditEntries: appendUnique(current.auditEntries, {
      id: 'audit-chidi-payment',
      actor: member.name,
      actorRole: member.role,
      action: 'Paid July Security Levy from BitBridge NGN Wallet',
      reference: 'AUD-CHIDI-PAYMENT-001',
      occurredAt: 'Just now',
    }),
  }
}

export const submitVendorPayoutRequest = (simulationState) => {
  const current = normalizeGreenfieldSimulationState(simulationState)
  if (current.payoutRequest.status !== 'Not started') {
    return current
  }

  return {
    ...current,
    chapterState: {
      ...current.chapterState,
      payoutRequestStep: 'submitted',
      payoutApprovalStep: 'awaiting_review',
    },
    treasury: {
      ...current.treasury,
      projectedOutgoing: GREENFIELD_PAYOUT_PRINCIPAL + GREENFIELD_PAYOUT_FEE,
    },
    payoutRequest: {
      ...current.payoutRequest,
      status: 'Awaiting review',
      reviewStatus: 'Awaiting review',
      executionStatus: 'Not started',
      requestedBy: 'Amaka',
      submittedAtLabel: 'Just now',
    },
    recentActivityEntries: appendUnique(current.recentActivityEntries, {
      id: 'activity-payout-request',
      title: 'Amaka submitted vendor payment request',
      detail: 'The request is awaiting review before money moves.',
      amountLabel: null,
      tone: 'neutral',
      occurredAt: 'Just now',
    }),
    timelineEntries: appendUnique(current.timelineEntries, {
      id: 'timeline-payout-request',
      title: 'Vendor payment request was submitted',
      description: 'Amaka prepared the July estate security vendor payment for review.',
      occurredAt: 'Just now',
      tone: 'neutral',
    }),
    auditEntries: appendUnique(current.auditEntries, {
      id: 'audit-payout-request',
      actor: 'Amaka',
      actorRole: 'Treasurer',
      action: 'Submitted July estate security vendor payment request',
      reference: 'AUD-PAYOUT-REQUEST-001',
      occurredAt: 'Just now',
    }),
  }
}

export const approveVendorPayoutRequest = (simulationState) => {
  const current = normalizeGreenfieldSimulationState(simulationState)
  if (
    current.payoutRequest.reviewStatus === 'Approved' ||
    current.payoutRequest.executionStatus === 'Processing' ||
    current.payoutRequest.executionStatus === 'Completed'
  ) {
    return current
  }

  const submitted =
    current.payoutRequest.status === 'Not started' ? submitVendorPayoutRequest(current) : current

  return {
    ...submitted,
    chapterState: {
      ...submitted.chapterState,
      payoutApprovalStep: 'approved',
      payoutExecutionStep: 'processing',
    },
    payoutRequest: {
      ...submitted.payoutRequest,
      status: 'Approved',
      reviewStatus: 'Approved',
      executionStatus: 'Processing',
      approvedBy: 'Tunde',
      approvedAtLabel: 'Just now',
    },
    recentActivityEntries: appendUnique(submitted.recentActivityEntries, {
      id: 'activity-payout-approved',
      title: 'Tunde approved vendor payment request',
      detail: 'The payout has entered processing after review.',
      amountLabel: null,
      tone: 'neutral',
      occurredAt: 'Just now',
    }),
    timelineEntries: appendUnique(submitted.timelineEntries, {
      id: 'timeline-payout-approved',
      title: 'Vendor payment request was approved',
      description: 'Another authorized Circle manager reviewed the request before submission.',
      occurredAt: 'Just now',
      tone: 'neutral',
    }),
    auditEntries: appendUnique(submitted.auditEntries, {
      id: 'audit-payout-approved',
      actor: 'Tunde',
      actorRole: 'Admin',
      action: 'Approved July estate security vendor payment request',
      reference: 'AUD-PAYOUT-APPROVAL-001',
      occurredAt: 'Just now',
    }),
  }
}

export const completeVendorPayout = (simulationState) => {
  const current = normalizeGreenfieldSimulationState(simulationState)
  if (current.payoutRequest.executionStatus === 'Completed') {
    return current
  }

  const approved =
    current.payoutRequest.reviewStatus === 'Approved' ||
    current.payoutRequest.executionStatus === 'Processing'
      ? current
      : approveVendorPayoutRequest(current)

  return {
    ...approved,
    chapterState: {
      ...approved.chapterState,
      payoutExecutionStep: 'completed',
    },
    treasury: {
      ...approved.treasury,
      totalBalance:
        approved.treasury.totalBalance - GREENFIELD_PAYOUT_PRINCIPAL - GREENFIELD_PAYOUT_FEE,
      availableBalance:
        approved.treasury.availableBalance - GREENFIELD_PAYOUT_PRINCIPAL - GREENFIELD_PAYOUT_FEE,
      projectedOutgoing: 0,
      completedOutgoing: GREENFIELD_PAYOUT_PRINCIPAL + GREENFIELD_PAYOUT_FEE,
    },
    payoutRequest: {
      ...approved.payoutRequest,
      status: 'Completed',
      reviewStatus: 'Approved',
      executionStatus: 'Completed',
      completedAtLabel: 'Just now',
      statementReady: true,
    },
    recentActivityEntries: appendUnique(
      appendUnique(approved.recentActivityEntries, {
        id: 'activity-payout-fee',
        title: 'Transfer fee recorded',
        detail: 'Fee recorded with the completed vendor payout.',
        amountLabel: '-₦100',
        tone: 'negative',
        occurredAt: 'Just now',
      }),
      {
        id: 'activity-payout-completed',
        title: 'Vendor payout completed',
        detail: 'Security vendor payment moved out of Greenfield’s balance.',
        amountLabel: '-₦600,000',
        tone: 'negative',
        occurredAt: 'Just now',
      }
    ),
    timelineEntries: appendUnique(approved.timelineEntries, {
      id: 'timeline-payout-completed',
      title: 'Vendor payout completed',
      description: 'The payout moved from processing to completed and the Circle balance updated.',
      occurredAt: 'Just now',
      tone: 'negative',
    }),
    auditEntries: appendUnique(approved.auditEntries, {
      id: 'audit-payout-completed',
      actor: 'BitBridge payout rail',
      actorRole: 'Simulated provider',
      action: 'Completed July estate security vendor payment',
      reference: approved.payoutRequest.reference,
      occurredAt: 'Just now',
    }),
    statementEntries: [
      {
        id: 'statement-chidi-payment',
        direction: 'Credit',
        label: `July Security Levy - ${GREENFIELD_CIRCLE_FIXTURE.roles.chidi.name}`,
        amount: GREENFIELD_MEMBER_PAYMENT_AMOUNT,
      },
      {
        id: 'statement-security-vendor-payout',
        direction: 'Debit',
        label: 'Security vendor payout',
        amount: GREENFIELD_PAYOUT_PRINCIPAL,
      },
      {
        id: 'statement-transfer-fee',
        direction: 'Debit',
        label: 'Transfer fee',
        amount: GREENFIELD_PAYOUT_FEE,
      },
    ],
  }
}

export const setActivityTab = (simulationState, tab) => ({
  ...normalizeGreenfieldSimulationState(simulationState),
  chapterState: {
    ...normalizeGreenfieldSimulationState(simulationState).chapterState,
    activeActivityTab: tab,
  },
})

export const deriveGreenfieldCircleView = (simulationState) => {
  const state = normalizeGreenfieldSimulationState(simulationState)
  const paidMembers = Math.round(state.collections.collectedAmount / state.collections.contributionAmount)
  const unpaidMembers = Math.max(GREENFIELD_CIRCLE_FIXTURE.memberCount - paidMembers, 0)
  const member = GREENFIELD_CIRCLE_FIXTURE.roles.chidi

  return {
    id: GREENFIELD_CIRCLE_FIXTURE.id,
    name: GREENFIELD_CIRCLE_FIXTURE.name,
    shortLabel: GREENFIELD_CIRCLE_FIXTURE.shortLabel,
    location: GREENFIELD_CIRCLE_FIXTURE.location,
    memberCount: GREENFIELD_CIRCLE_FIXTURE.memberCount,
    disclosure: GREENFIELD_CIRCLE_FIXTURE.chapterDisclosure,
    overviewSummary: GREENFIELD_CIRCLE_FIXTURE.overviewSummary,
    roles: clone(GREENFIELD_CIRCLE_FIXTURE.roles),
    memberIdentity: {
      id: member.id,
      name: member.name,
      shortName: member.shortName || member.name,
      role: member.role,
      residenceLabel: member.residenceLabel || '',
      contextLabel: member.contextLabel || member.role,
    },
    wallet: {
      ...state.wallet,
      balanceBeforeLabel: formatNaira(state.wallet.balanceBeforePayment),
      balanceCurrentLabel: formatNaira(state.wallet.balanceCurrent),
    },
    obligation: {
      ...state.obligation,
      amountLabel: formatNaira(state.obligation.amount),
    },
    obligations: [
      {
        id: state.obligation.id,
        label: state.obligation.label,
        amount: state.obligation.amount,
        amountLabel: formatNaira(state.obligation.amount),
        dueContext: state.obligation.dueContext,
        status: state.obligation.status,
        impactSummary: state.obligation.purpose,
      },
    ],
    collections: [
      {
        ...state.collections,
        paidMembers,
        unpaidMembers,
      },
    ],
    collectionSummary: {
      expectedAmount: state.collections.expectedAmount,
      collectedAmount: state.collections.collectedAmount,
      outstandingAmount: state.collections.outstandingAmount,
      expectedLabel: formatNaira(state.collections.expectedAmount),
      collectedLabel: formatNaira(state.collections.collectedAmount),
      outstandingLabel: formatNaira(state.collections.outstandingAmount),
      paidMembers,
      unpaidMembers,
    },
    treasury: {
      totalBalance: state.treasury.totalBalance,
      availableBalance: state.treasury.availableBalance,
      designatedBalance: state.treasury.designatedBalance,
      restrictedBalance: state.treasury.designatedBalance,
      totalBalanceLabel: formatNaira(state.treasury.totalBalance),
      availableBalanceLabel: formatNaira(state.treasury.availableBalance),
      designatedBalanceLabel: formatNaira(state.treasury.designatedBalance),
      designatedLabel: state.treasury.designatedLabel,
      designatedSummary: state.treasury.designatedSummary,
      projectedOutgoing: state.treasury.projectedOutgoing,
      projectedOutgoingLabel: formatNaira(state.treasury.projectedOutgoing),
      projectedAvailableAfterCompletion:
        state.treasury.availableBalance - state.treasury.projectedOutgoing,
      projectedAvailableAfterCompletionLabel: formatNaira(
        state.treasury.availableBalance - state.treasury.projectedOutgoing
      ),
    },
    circleAccount: clone(state.circleAccount),
    externalInflow: clone(state.externalInflow),
    memberPayment: {
      obligationId: state.obligation.id,
      fundingSourceLabel: state.wallet.label,
      amountLabel: formatNaira(state.obligation.amount),
      beforeBalanceLabel: formatNaira(state.wallet.balanceBeforePayment),
      currentBalanceLabel: formatNaira(state.wallet.balanceCurrent),
      disclaimer: 'This is a guided simulation. No real wallet balance or payout rail is being used.',
    },
    payoutRequest: {
      ...state.payoutRequest,
      principalLabel: formatNaira(state.payoutRequest.principalAmount),
      feeLabel: formatNaira(state.payoutRequest.feeAmount, 2),
      totalProjectedOutgoingLabel: formatNaira(
        state.payoutRequest.principalAmount + state.payoutRequest.feeAmount,
        2
      ),
      projectedBalanceAfterCompletionLabel: formatNaira(
        state.treasury.totalBalance -
          (state.payoutRequest.executionStatus === 'Completed'
            ? 0
            : state.payoutRequest.principalAmount + state.payoutRequest.feeAmount),
        2
      ),
      currentBalanceLabel: formatNaira(state.treasury.totalBalance, 2),
    },
    recentActivity: clone(state.recentActivityEntries),
    timelineEntries: clone(state.timelineEntries),
    auditTrail: clone(state.auditEntries),
    statementEntries: clone(state.statementEntries),
    chapterState: clone(state.chapterState),
    completedEventIds: getSimulationCompletedEventIds(state),
    paymentCompleted: state.obligation.status === 'Paid',
    payoutSubmitted: state.payoutRequest.status !== 'Not started',
    payoutApproved:
      state.payoutRequest.reviewStatus === 'Approved' ||
      state.payoutRequest.executionStatus === 'Processing' ||
      state.payoutRequest.executionStatus === 'Completed',
    payoutCompleted: state.payoutRequest.executionStatus === 'Completed',
  }
}

export const applyDemoEvent = (simulationState, eventId) => {
  switch (eventId) {
    case CHIDI_JULY_SECURITY_PAYMENT_EVENT_ID:
      return recordChidiPayment(simulationState)
    case AMAKA_VENDOR_PAYOUT_REQUEST_EVENT_ID:
      return submitVendorPayoutRequest(simulationState)
    case TUNDE_VENDOR_PAYOUT_APPROVAL_EVENT_ID:
      return approveVendorPayoutRequest(simulationState)
    case AMAKA_VENDOR_PAYOUT_COMPLETED_EVENT_ID:
      return completeVendorPayout(simulationState)
    default:
      return normalizeGreenfieldSimulationState(simulationState)
  }
}

export const hasCompletedDemoEvent = (eventIds, eventId) =>
  Array.isArray(eventIds) && eventIds.includes(eventId)
