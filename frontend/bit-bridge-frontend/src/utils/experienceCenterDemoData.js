export const CHIDI_JULY_SECURITY_PAYMENT_EVENT_ID = 'evt_chidi_july_security_payment'
export const AMAKA_VENDOR_PAYOUT_REQUEST_EVENT_ID = 'evt_amaka_vendor_payout_requested'
export const TUNDE_VENDOR_PAYOUT_APPROVAL_EVENT_ID = 'evt_tunde_vendor_payout_approved'
export const AMAKA_VENDOR_PAYOUT_COMPLETED_EVENT_ID = 'evt_amaka_vendor_payout_completed'
export const AMAKA_JULY_SECURITY_VENDOR_PAYOUT_REQUEST_EVENT_ID = AMAKA_VENDOR_PAYOUT_REQUEST_EVENT_ID
export const TUNDE_JULY_SECURITY_VENDOR_PAYOUT_APPROVED_EVENT_ID = TUNDE_VENDOR_PAYOUT_APPROVAL_EVENT_ID
export const AMAKA_JULY_SECURITY_VENDOR_PAYOUT_COMPLETED_EVENT_ID = AMAKA_VENDOR_PAYOUT_COMPLETED_EVENT_ID

export const GREENFIELD_CIRCLE_ID = 'greenfield-estate'
export const GREENFIELD_TOTAL_DUES_EXPECTED = 2_100_000
export const GREENFIELD_MEMBER_PAYMENT_AMOUNT = 25_000
export const GREENFIELD_PAYOUT_PRINCIPAL = 600_000
export const GREENFIELD_PAYOUT_FEE = 100
export const GREENFIELD_PAYOUT_TOTAL = GREENFIELD_PAYOUT_PRINCIPAL + GREENFIELD_PAYOUT_FEE

export const GREENFIELD_CIRCLE_FIXTURE = {
  id: GREENFIELD_CIRCLE_ID,
  name: 'Greenfield Residents Association',
  shortLabel: 'Greenfield',
  location: 'Lekki, Lagos',
  memberCount: 84,
  chapterDisclosure:
    'The Experience Center demonstrates BitBridge’s unified Circle financial model, which is being consolidated across existing Circle and treasury rails.',
  overviewSummary:
    'Greenfield uses BitBridge to coordinate member dues, shared operating funds, vendor payments, and a visible record of every important financial action.',
  roles: {
    chidi: {
      id: 'chidi',
      name: 'Emma Carter',
      shortName: 'Emma',
      role: 'Resident',
      residenceLabel: 'House A12',
      contextLabel: 'Resident · House A12',
      summary: 'Pays her July security levy from her BitBridge NGN wallet.',
    },
    amaka: {
      id: 'amaka',
      name: 'Amaka',
      role: 'Treasurer',
      summary: 'Tracks collections, monitors available funds, and prepares vendor payments.',
    },
    tunde: {
      id: 'tunde',
      name: 'Tunde',
      role: 'Admin',
      summary: 'Reviews payout requests before money moves from the Circle.',
    },
  },
  treasury: {
    totalBalance: 5_975_000,
    availableBalance: 4_125_000,
    designatedBalance: 1_850_000,
    designatedLabel: 'Road-repair reserve',
    designatedSummary: 'Funds set aside by the association for road repairs.',
  },
  collections: {
    expectedAmount: GREENFIELD_TOTAL_DUES_EXPECTED,
    collectedAmount: 135_000,
    outstandingAmount: 1_965_000,
    contributionAmount: 25_000,
    name: 'July Security Dues',
    cadenceLabel: '2026 monthly collection',
    summary: 'Monthly dues support estate security operations and related vendor payments.',
  },
  obligation: {
    id: 'chidi-july-security-levy',
    label: 'July Security Levy',
    amount: GREENFIELD_MEMBER_PAYMENT_AMOUNT,
    dueContext: 'Due this month',
    status: 'Outstanding',
    purpose:
      'This levy covers Greenfield’s monthly security contribution and helps keep shared services funded on time.',
  },
  wallet: {
    label: 'BitBridge NGN Wallet',
    balanceBeforePayment: 185_000,
  },
  circleAccount: {
    label: 'Greenfield Circle Account',
    status: 'Active',
    bankName: '9 Payment Service Bank',
    accountNumberMasked: '6172 94•• ••64',
    purpose: 'External collections and treasury funding',
    providerLabel: 'BitBridge-provisioned Circle account',
  },
  externalInflow: {
    id: 'external-road-repair-contribution',
    title: 'External transfer received',
    subtitle: 'Road Repair Contribution',
    amount: 500_000,
    note: 'Earlier contributions are already reflected in Greenfield’s balance.',
  },
  payoutDraft: {
    id: 'security-vendor-july',
    beneficiaryName: 'SwiftShield Security Services',
    beneficiaryBank: 'First City Monument Bank',
    beneficiaryAccountMasked: '2005••••00',
    purpose: 'July estate security vendor payment',
    note: 'Prepared by Amaka after the month’s collections are reviewed.',
    principalAmount: GREENFIELD_PAYOUT_PRINCIPAL,
    feeAmount: GREENFIELD_PAYOUT_FEE,
  },
  recentActivitySeed: [
    {
      id: 'activity-july-dues-open',
      title: 'July security dues opened',
      detail: '84 member obligations were issued for the month.',
      amountLabel: null,
      tone: 'neutral',
      occurredAt: 'Earlier today',
    },
    {
      id: 'activity-road-repair-inflow',
      title: 'Road Repair Contribution received',
      detail: 'A road repair contribution was received for the association.',
      amountLabel: '+₦500,000',
      tone: 'positive',
      occurredAt: 'Yesterday',
    },
  ],
  timelineSeed: [
    {
      id: 'timeline-july-dues-created',
      title: 'July security dues were issued',
      description: 'Member obligations were created for the new billing cycle.',
      occurredAt: 'Earlier today',
      tone: 'neutral',
    },
    {
      id: 'timeline-road-repair-inflow',
      title: 'Road Repair Contribution was recorded',
      description: 'A road repair contribution was recorded for Greenfield.',
      occurredAt: 'Yesterday',
      tone: 'positive',
    },
  ],
  auditSeed: [
    {
      id: 'audit-july-dues-created',
      actor: 'System',
      actorRole: 'Circle service',
      action: 'Issued July member obligations',
      reference: 'AUD-JULY-DUES-001',
      occurredAt: 'Earlier today',
    },
    {
      id: 'audit-road-repair-inflow',
      actor: 'BitBridge rail',
      actorRole: 'Circle account',
      action: 'Recorded Road Repair Contribution',
      reference: 'AUD-ROAD-REPAIR-001',
      occurredAt: 'Yesterday',
    },
  ],
  freeExploreCards: [
    {
      id: 'explore-circle',
      title: 'Circle',
      description: 'See how shared obligations, collections, treasury, and payouts stay coordinated.',
    },
    {
      id: 'explore-transfers',
      title: 'Transfers',
      description: 'Move money across accounts with the same focus on clarity and completion.',
    },
    {
      id: 'explore-virtual-accounts',
      title: 'Virtual Accounts',
      description: 'Provision named accounts that help inbound payments arrive with better context.',
    },
    {
      id: 'explore-cards',
      title: 'Cards',
      description: 'Manage card access, controls, and spend visibility across customer journeys.',
    },
    {
      id: 'explore-utility-payments',
      title: 'Utility Payments',
      description: 'Handle recurring bills and service payments from the same financial platform.',
    },
    {
      id: 'explore-statements',
      title: 'Statements',
      description: 'Review money movement through records that stay readable after the action is complete.',
    },
    {
      id: 'explore-business-payments',
      title: 'Business Payments',
      description: 'Extend coordinated collections, treasury, and payouts to broader business operations.',
    },
  ],
}

export const validateExperienceCenterDemoFixture = (fixture = GREENFIELD_CIRCLE_FIXTURE) => {
  if (fixture.treasury.totalBalance !== fixture.treasury.availableBalance + fixture.treasury.designatedBalance) {
    throw new Error('Greenfield treasury totals must reconcile to available plus designated balances.')
  }

  if (
    fixture.collections.expectedAmount !==
    fixture.collections.collectedAmount + fixture.collections.outstandingAmount
  ) {
    throw new Error('Greenfield collection totals must reconcile to expected dues.')
  }

  if (fixture.wallet.balanceBeforePayment < fixture.obligation.amount) {
    throw new Error('Emma wallet balance must be sufficient to cover the obligation payment.')
  }

  const projectedAvailableAfterPayout =
    fixture.treasury.availableBalance +
    fixture.obligation.amount -
    fixture.payoutDraft.principalAmount -
    fixture.payoutDraft.feeAmount

  if (projectedAvailableAfterPayout < 0) {
    throw new Error('Greenfield payout draft cannot exceed available operating funds after the member payment.')
  }

  return true
}

validateExperienceCenterDemoFixture()
