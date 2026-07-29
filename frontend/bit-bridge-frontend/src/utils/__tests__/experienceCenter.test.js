import test from 'node:test'
import assert from 'node:assert/strict'

import {
  EXPERIENCE_CENTER_HOME_PATH,
  EXPERIENCE_CENTER_SELECTION_PATH,
  PERSPECTIVE_DEFINITIONS,
  buildExperiencePath,
  buildGuidedStepPath,
  clearExperienceCenterState,
  createExperienceSelectionState,
  getExperienceCenterState,
  getExperienceDefinition,
  getExperienceStepDefinition,
  getNextStepPath,
  getPreviousStepPath,
  getResumePath,
  normalizeExperienceId,
  normalizeExperienceStepId,
  normalizeGuidedAction,
  normalizePerspectiveId,
  persistGuidedStepState,
  resolveExperienceCenterRoute,
  saveExperienceCenterState,
} from '../experienceCenter.js'
import {
  GREENFIELD_CIRCLE_FIXTURE,
  GREENFIELD_MEMBER_PAYMENT_AMOUNT,
  GREENFIELD_PAYOUT_FEE,
  GREENFIELD_PAYOUT_PRINCIPAL,
  validateExperienceCenterDemoFixture,
} from '../experienceCenterDemoData.js'
import {
  applyDemoEvent,
  approveVendorPayoutRequest,
  completeVendorPayout,
  createInitialGreenfieldSimulationState,
  deriveGreenfieldCircleView,
  getSimulationCompletedEventIds,
  normalizeGreenfieldSimulationState,
  recordChidiPayment,
  submitVendorPayoutRequest,
} from '../experienceCenterCircleDemo.js'
import { resolveFeatureFlag } from '../featureFlags.js'

const createStorage = () => {
  const values = new Map()
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    dump: () => Object.fromEntries(values.entries()),
  }
}

test('Circle remains the recommended starting experience', () => {
  assert.equal(getExperienceDefinition('circle')?.recommended, true)
  assert.equal(getExperienceDefinition('platform-overview')?.recommended, false)
})

test('normalizes valid experience, step, and perspective ids safely', () => {
  assert.equal(normalizeExperienceId(' Circle '), 'circle')
  assert.equal(normalizeExperienceId('unknown'), '')
  assert.equal(normalizeExperienceStepId('circle', 'chidi-payment-review'), 'member-payment')
  assert.equal(normalizeExperienceStepId('circle', 'timeline'), 'activity-audit')
  assert.equal(normalizePerspectiveId(' tunde '), 'tunde')
  assert.equal(normalizePerspectiveId('viewer'), '')
})

test('defines the merged guided Circle steps with stable navigation', () => {
  assert.equal(getExperienceStepDefinition('circle', 'intro')?.nextStepId, 'overview')
  assert.equal(getExperienceStepDefinition('circle', 'prepare-payout')?.nextStepId, 'approve-payout')
  assert.equal(getExperienceStepDefinition('circle', 'treasury-update')?.nextStepId, 'activity-audit')
  assert.equal(getExperienceStepDefinition('circle', 'free-explore')?.previousStepId, 'activity-audit')
  assert.equal(getNextStepPath('circle', 'intro'), '/experience-center/circle/overview')
  assert.equal(getPreviousStepPath('circle', 'intro'), '/experience-center')
  assert.equal(getPreviousStepPath('circle', 'overview'), '/experience-center/circle/intro')
  assert.equal(buildGuidedStepPath('circle', 'member-payment'), '/experience-center/circle/chidi/payment')
  assert.equal(buildGuidedStepPath('circle', 'prepare-payout'), '/experience-center/circle/amaka/prepare-payout')
  assert.equal(buildGuidedStepPath('circle', 'approve-payout'), '/experience-center/circle/tunde/approve')
  assert.equal(buildGuidedStepPath('circle', 'free-explore'), '/experience-center/circle/explore')
})

test('protects Experience Center routes when disabled', () => {
  const result = resolveExperienceCenterRoute({
    enabled: false,
    experienceId: 'circle',
    stepId: 'intro',
    pathname: '/experience-center/circle/intro',
  })

  assert.equal(result.allowed, false)
  assert.equal(result.redirectTo, EXPERIENCE_CENTER_HOME_PATH)
})

test('recovers invalid experience routes to selection', () => {
  const result = resolveExperienceCenterRoute({
    enabled: true,
    experienceId: 'not-real',
    pathname: '/experience-center/not-real',
  })

  assert.equal(result.allowed, true)
  assert.equal(result.redirectTo, EXPERIENCE_CENTER_SELECTION_PATH)
})

test('recovers invalid Circle step routes to the valid Circle entry point', () => {
  const result = resolveExperienceCenterRoute({
    enabled: true,
    experienceId: 'circle',
    stepId: 'not-real',
    pathname: '/experience-center/circle/not-real',
  })

  assert.equal(result.allowed, true)
  assert.equal(result.redirectTo, '/experience-center/circle/intro')
})

test('maps old split routes to the merged chapters', () => {
  assert.equal(normalizeExperienceStepId('circle', 'chidi-payment-success'), 'member-payment')
  assert.equal(normalizeExperienceStepId('circle', 'amaka-payout-review'), 'prepare-payout')
  assert.equal(normalizeExperienceStepId('circle', 'tunde-review'), 'approve-payout')
  assert.equal(normalizeExperienceStepId('circle', 'guided-complete'), 'free-explore')
})

test('builds safe entry paths for guided and placeholder experiences', () => {
  assert.equal(buildExperiencePath('circle'), '/experience-center/circle/intro')
  assert.equal(buildExperiencePath('everyday-money'), '/experience-center/everyday-money')
})

test('stores only namespaced Experience Center progress and supports restart reset', () => {
  const storage = createStorage()
  const simulationState = recordChidiPayment(createInitialGreenfieldSimulationState())

  saveExperienceCenterState(
    {
      selectedExperienceId: 'circle',
      selectedPerspectiveId: 'amaka',
      currentStepId: 'amaka-collections',
      simulationState,
      hasSeenLanding: true,
      lastPath: '/experience-center/circle/amaka/collections',
    },
    storage
  )

  const persisted = getExperienceCenterState(storage)
  assert.equal(persisted.selectedExperienceId, 'circle')
  assert.equal(persisted.currentStepId, 'amaka-collections')
  assert.equal(persisted.simulationState.obligation.status, 'Paid')

  clearExperienceCenterState(storage)
  const reset = getExperienceCenterState(storage)
  assert.equal(reset.selectedExperienceId, '')
  assert.equal(reset.currentStepId, '')
  assert.equal(reset.hasSeenLanding, false)
  assert.equal(reset.lastPath, '/experience-center')
  assert.equal(reset.simulationState.obligation.status, 'Outstanding')
})

test('persists only the Experience Center namespace key', () => {
  const storage = createStorage()
  storage.setItem('UNRELATED_KEY', 'keep-me')

  saveExperienceCenterState(
    {
      selectedExperienceId: 'circle',
      selectedPerspectiveId: 'chidi',
      currentStepId: 'overview',
      hasSeenLanding: true,
      lastPath: '/experience-center/circle/overview',
    },
    storage
  )

  assert.equal(storage.dump().UNRELATED_KEY, 'keep-me')
})

test('ignores corrupted stored state and falls back safely', () => {
  const storage = createStorage()
  storage.setItem('BITBRIDGE_EXPERIENCE_CENTER_V1', '{not-json')
  const state = getExperienceCenterState(storage)
  assert.equal(state.selectedExperienceId, '')
  assert.equal(state.currentStepId, '')
  assert.equal(state.lastPath, '/experience-center')
})

test('rejects unsafe stored routes and derives a safe resume path from valid Circle state', () => {
  const storage = createStorage()
  saveExperienceCenterState(
    {
      selectedExperienceId: 'circle',
      selectedPerspectiveId: 'tunde',
      currentStepId: 'overview',
      hasSeenLanding: true,
      lastPath: '/experience-center/not-real/deeper',
    },
    storage
  )

  const persisted = getExperienceCenterState(storage)
  assert.equal(persisted.lastPath, '/experience-center/circle/overview')
  assert.equal(getResumePath(persisted), '/experience-center/circle/overview')
})

test('creates resumable state from experience selection with fresh simulation state', () => {
  const state = createExperienceSelectionState('circle', '/experience-center/circle/overview')

  assert.equal(state.selectedExperienceId, 'circle')
  assert.equal(state.currentStepId, 'overview')
  assert.equal(state.simulationState.obligation.status, 'Outstanding')
  assert.equal(state.simulationState.treasury.totalBalance, 5975000)
})

test('returns a safe resume path only after the landing screen has been passed', () => {
  assert.equal(
    getResumePath({ hasSeenLanding: true, lastPath: '/experience-center/circle/overview' }),
    '/experience-center/circle/overview'
  )
  assert.equal(getResumePath({ hasSeenLanding: true, lastPath: '/experience-center' }), '/experience-center')
  assert.equal(
    getResumePath({ hasSeenLanding: false, lastPath: '/experience-center/circle/overview' }),
    ''
  )
})

test('models guided controls with explicit disabled and unavailable states', () => {
  assert.equal(
    normalizeGuidedAction({ label: 'Review Treasury', state: 'disabled', reason: 'Complete the current step first.' }).state,
    'disabled'
  )
  assert.equal(
    normalizeGuidedAction({ label: 'Watch Overview', state: 'unavailable', reason: 'Available later.' }).state,
    'unavailable'
  )
})

test('keeps the approved perspective options available', () => {
  assert.deepEqual(PERSPECTIVE_DEFINITIONS.map((perspective) => perspective.id), ['chidi', 'amaka', 'tunde'])
  assert.equal(PERSPECTIVE_DEFINITIONS[0].label, 'Emma Carter')
  assert.equal(PERSPECTIVE_DEFINITIONS[0].role, 'Resident')
  assert.equal(PERSPECTIVE_DEFINITIONS[2].role, 'Admin')
})

test('uses a safe default-off feature flag for the Experience Center', () => {
  assert.equal(resolveFeatureFlag({ defaultValue: false, values: [undefined] }), false)
  assert.equal(resolveFeatureFlag({ defaultValue: false, values: ['true'] }), true)
  assert.equal(resolveFeatureFlag({ defaultValue: false, values: ['yes'] }), true)
  assert.equal(resolveFeatureFlag({ defaultValue: false, values: ['off'] }), false)
  assert.equal(resolveFeatureFlag({ defaultValue: false, values: ['0'] }), false)
})

test('validates the fictional Greenfield Circle fixture', () => {
  assert.equal(validateExperienceCenterDemoFixture(GREENFIELD_CIRCLE_FIXTURE), true)
})

test('derives a financially coherent base Greenfield Circle view', () => {
  const circle = deriveGreenfieldCircleView()
  assert.equal(circle.treasury.totalBalance, 5975000)
  assert.equal(circle.treasury.availableBalance, 4125000)
  assert.equal(circle.treasury.designatedBalance, 1850000)
  assert.equal(circle.collectionSummary.expectedAmount, 2100000)
  assert.equal(circle.collectionSummary.collectedAmount, 135000)
  assert.equal(circle.collectionSummary.outstandingAmount, 1965000)
  assert.equal(circle.paymentCompleted, false)
  assert.equal(circle.payoutSubmitted, false)
  assert.equal(circle.statementEntries.length, 0)
  assert.equal(circle.treasury.totalBalance, circle.treasury.availableBalance + circle.treasury.designatedBalance)
  assert.equal(
    circle.collectionSummary.expectedAmount,
    circle.collectionSummary.collectedAmount + circle.collectionSummary.outstandingAmount
  )
})

test('records the Emma payment idempotently and updates all financial surfaces', () => {
  const firstApply = recordChidiPayment(createInitialGreenfieldSimulationState())
  const secondApply = recordChidiPayment(firstApply)
  const circle = deriveGreenfieldCircleView(secondApply)

  assert.deepEqual(firstApply, secondApply)
  assert.equal(circle.paymentCompleted, true)
  assert.equal(circle.wallet.balanceCurrent, 160000)
  assert.equal(circle.treasury.totalBalance, 6000000)
  assert.equal(circle.treasury.availableBalance, 4150000)
  assert.equal(circle.treasury.designatedBalance, 1850000)
  assert.equal(circle.collectionSummary.collectedAmount, 160000)
  assert.equal(circle.collectionSummary.outstandingAmount, 1940000)
  assert.equal(circle.obligation.status, 'Paid')
  assert.equal(circle.recentActivity[0].title, 'Emma Carter paid July Security Levy')
  assert.equal(circle.timelineEntries[0].title, 'Emma Carter paid July Security Levy')
  assert.equal(circle.auditTrail[0].actor, 'Emma Carter')
  assert.equal(circle.statementEntries.length, 0)
  assert.deepEqual(getSimulationCompletedEventIds(secondApply), ['evt_chidi_july_security_payment'])
})

test('creates the payout request without deducting current funds', () => {
  const state = submitVendorPayoutRequest(recordChidiPayment(createInitialGreenfieldSimulationState()))
  const circle = deriveGreenfieldCircleView(state)

  assert.equal(circle.payoutSubmitted, true)
  assert.equal(circle.payoutRequest.status, 'Awaiting review')
  assert.equal(circle.payoutRequest.reviewStatus, 'Awaiting review')
  assert.equal(circle.payoutRequest.executionStatus, 'Not started')
  assert.equal(circle.treasury.totalBalance, 6000000)
  assert.equal(circle.treasury.availableBalance, 4150000)
  assert.equal(circle.treasury.projectedOutgoing, GREENFIELD_PAYOUT_PRINCIPAL + GREENFIELD_PAYOUT_FEE)
  assert.equal(circle.treasury.projectedAvailableAfterCompletion, 3549900)
})

test('approval moves the request into processing without completing the payout', () => {
  const state = approveVendorPayoutRequest(
    submitVendorPayoutRequest(recordChidiPayment(createInitialGreenfieldSimulationState()))
  )
  const circle = deriveGreenfieldCircleView(state)

  assert.equal(circle.payoutApproved, true)
  assert.equal(circle.payoutCompleted, false)
  assert.equal(circle.payoutRequest.reviewStatus, 'Approved')
  assert.equal(circle.payoutRequest.executionStatus, 'Processing')
  assert.equal(circle.treasury.totalBalance, 6000000)
  assert.equal(circle.statementEntries.length, 0)
})

test('completion updates treasury, activity, audit, and statement entries exactly once', () => {
  const state = completeVendorPayout(
    approveVendorPayoutRequest(
      submitVendorPayoutRequest(recordChidiPayment(createInitialGreenfieldSimulationState()))
    )
  )
  const circle = deriveGreenfieldCircleView(state)

  assert.equal(circle.payoutCompleted, true)
  assert.equal(circle.payoutRequest.executionStatus, 'Completed')
  assert.equal(circle.treasury.totalBalance, 5399900)
  assert.equal(circle.treasury.availableBalance, 3549900)
  assert.equal(circle.treasury.designatedBalance, 1850000)
  assert.equal(circle.treasury.projectedOutgoing, 0)
  assert.equal(circle.statementEntries.length, 3)
  assert.equal(circle.statementEntries[0].label, 'July Security Levy - Emma Carter')
  assert.equal(circle.statementEntries[1].amount, GREENFIELD_PAYOUT_PRINCIPAL)
  assert.equal(circle.statementEntries[2].amount, GREENFIELD_PAYOUT_FEE)
  assert.equal(circle.recentActivity[0].title, 'Vendor payout completed')
  assert.equal(circle.auditTrail[0].reference, 'PAY-GREENFIELD-600100')
  assert.equal(circle.treasury.totalBalance, circle.treasury.availableBalance + circle.treasury.designatedBalance)
})

test('statement entries appear only after completed money movement', () => {
  const preCompletion = deriveGreenfieldCircleView(
    approveVendorPayoutRequest(
      submitVendorPayoutRequest(recordChidiPayment(createInitialGreenfieldSimulationState()))
    )
  )
  const postCompletion = deriveGreenfieldCircleView(
    completeVendorPayout(
      approveVendorPayoutRequest(
        submitVendorPayoutRequest(recordChidiPayment(createInitialGreenfieldSimulationState()))
      )
    )
  )

  assert.equal(preCompletion.statementEntries.length, 0)
  assert.equal(postCompletion.statementEntries.length, 3)
})

test('normalizes missing or corrupted simulation state safely', () => {
  const normalized = normalizeGreenfieldSimulationState({
    wallet: { balanceCurrent: 111000 },
    treasury: { availableBalance: 4125000 },
    recentActivityEntries: 'bad-data',
  })

  assert.equal(normalized.wallet.balanceCurrent, 111000)
  assert.equal(normalized.wallet.balanceBeforePayment, 185000)
  assert.equal(normalized.treasury.availableBalance, 4125000)
  assert.ok(Array.isArray(normalized.recentActivityEntries))
})

test('persists resume state for the merged guided flow after payment and payout completion', () => {
  const storage = createStorage()
  const simulationState = completeVendorPayout(
    approveVendorPayoutRequest(
      submitVendorPayoutRequest(recordChidiPayment(createInitialGreenfieldSimulationState()))
    )
  )

  saveExperienceCenterState(
    {
      selectedExperienceId: 'circle',
      selectedPerspectiveId: 'amaka',
      currentStepId: 'activity-audit',
      simulationState,
      hasSeenLanding: true,
      lastPath: '/experience-center/circle/activity-audit',
    },
    storage
  )

  const persisted = getExperienceCenterState(storage)
  assert.equal(persisted.currentStepId, 'activity-audit')
  assert.equal(persisted.simulationState.payoutRequest.executionStatus, 'Completed')
  assert.equal(getResumePath(persisted), '/experience-center/circle/activity-audit')
})

test('persistGuidedStepState returns the normalized saved state for immediate rerender use', () => {
  const storage = createStorage()
  const simulationState = submitVendorPayoutRequest(recordChidiPayment(createInitialGreenfieldSimulationState()))

  const savedState = persistGuidedStepState(
    {
      experienceId: 'circle',
      stepId: 'approve-payout',
      perspectiveId: 'tunde',
      simulationState,
      storage,
    },
  )

  assert.equal(savedState.currentStepId, 'approve-payout')
  assert.equal(savedState.selectedPerspectiveId, 'tunde')
  assert.equal(savedState.simulationState.payoutRequest.status, 'Awaiting review')
  assert.equal(savedState.lastPath, '/experience-center/circle/tunde/approve')
})

test('legacy applyDemoEvent compatibility still maps event ids into the unified simulation state', () => {
  const afterPayment = applyDemoEvent(createInitialGreenfieldSimulationState(), 'evt_chidi_july_security_payment')
  const afterRequest = applyDemoEvent(afterPayment, 'evt_amaka_vendor_payout_requested')
  const afterApproval = applyDemoEvent(afterRequest, 'evt_tunde_vendor_payout_approved')
  const afterCompletion = applyDemoEvent(afterApproval, 'evt_amaka_vendor_payout_completed')
  const circle = deriveGreenfieldCircleView(afterCompletion)

  assert.equal(circle.paymentCompleted, true)
  assert.equal(circle.payoutCompleted, true)
})
