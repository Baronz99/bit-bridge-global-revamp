import {
  createInitialGreenfieldSimulationState,
  getSimulationCompletedEventIds,
  normalizeGreenfieldSimulationState,
} from './experienceCenterCircleDemo.js'

export const EXPERIENCE_CENTER_STORAGE_KEY = 'BITBRIDGE_EXPERIENCE_CENTER_V1'
export const EXPERIENCE_CENTER_ROOT_PATH = '/experience-center'
export const EXPERIENCE_CENTER_SELECTION_PATH = '/experience-center/select'
export const EXPERIENCE_CENTER_HOME_PATH = '/'

export const PERSPECTIVE_DEFINITIONS = [
  {
    id: 'chidi',
    label: 'Emma Carter',
    role: 'Resident',
    summary: 'See what one resident owes, where the payment comes from, and what changes after it is recorded.',
  },
  {
    id: 'amaka',
    label: 'Amaka',
    role: 'Treasurer',
    summary: 'See collections, Circle funds, and how shared spending stays coordinated.',
  },
  {
    id: 'tunde',
    label: 'Tunde',
    role: 'Admin',
    summary: 'See how another authorized Circle manager reviews spending before money moves.',
  },
]

export const EXPERIENCE_DEFINITIONS = [
  {
    id: 'circle',
    label: 'Circle',
    kicker: 'Flagship experience',
    valueHeadline: 'See how BitBridge helps groups coordinate money with transparency and trust.',
    description:
      'Follow one clear Circle operating cycle across a member, a treasurer, and an admin to understand why BitBridge matters first.',
    recommended: true,
  },
  {
    id: 'everyday-money',
    label: 'Everyday Money',
    kicker: 'Personal money movement',
    valueHeadline: 'See how BitBridge supports the payments people repeat every week.',
    description:
      'Preview wallets, transfers, bills, and everyday financial confidence beyond group coordination.',
    recommended: false,
    placeholderTitle: 'Everyday Money preview is coming next',
    placeholderBody:
      'This experience will introduce the personal money surfaces that make BitBridge useful every day.',
    placeholderFocus: [
      'NGN wallet and account access',
      'Bank transfers and receipts',
      'Airtime, data, electricity, and cable payments',
    ],
  },
  {
    id: 'dollar-access',
    label: 'Dollar Access',
    kicker: 'Cross-border readiness',
    valueHeadline: 'See how BitBridge expands into dollar-linked capability and online spend.',
    description:
      'Preview the platform story around USD access and virtual dollar-card capability without onboarding friction.',
    recommended: false,
    placeholderTitle: 'Dollar Access preview is coming next',
    placeholderBody:
      'This experience will later show how BitBridge supports dollar-linked activity and online spending.',
    placeholderFocus: ['USD wallet positioning', 'Virtual dollar card access', 'Platform breadth beyond local payments'],
  },
  {
    id: 'platform-overview',
    label: 'Platform Overview',
    kicker: 'Company story',
    valueHeadline: 'Understand how Circle, everyday money, and broader infrastructure fit together.',
    description:
      'Preview the bigger BitBridge story after you understand the flagship Circle experience.',
    recommended: false,
    placeholderTitle: 'Platform Overview is coming next',
    placeholderBody:
      'This area will connect the product surfaces into one company story once the core experiences are complete.',
    placeholderFocus: ['How the products connect', 'Why the platform matters across people and groups', 'What makes BitBridge broader than one use case'],
  },
]

export const GUIDED_EXPERIENCE_REGISTRY = {
  circle: [
    {
      experienceId: 'circle',
      stepId: 'intro',
      routeSegment: 'intro',
      label: 'Circle Introduction',
      order: 1,
      progressPosition: 1,
      previousStepId: '',
      nextStepId: 'overview',
      perspectiveAvailability: ['chidi', 'amaka', 'tunde'],
      skippable: false,
      resumable: true,
    },
    {
      experienceId: 'circle',
      stepId: 'overview',
      routeSegment: 'overview',
      label: 'Circle Overview',
      order: 2,
      progressPosition: 2,
      previousStepId: 'intro',
      nextStepId: 'chidi-obligation',
      perspectiveAvailability: ['chidi', 'amaka', 'tunde'],
      skippable: false,
      resumable: true,
    },
    {
      experienceId: 'circle',
      stepId: 'chidi-obligation',
      routeSegment: 'chidi/obligation',
      label: 'Member Obligation',
      order: 3,
      progressPosition: 3,
      previousStepId: 'overview',
      nextStepId: 'member-payment',
      perspectiveAvailability: ['chidi'],
      skippable: false,
      resumable: true,
    },
    {
      experienceId: 'circle',
      stepId: 'member-payment',
      routeSegment: 'chidi/payment',
      label: 'Member Payment',
      order: 4,
      progressPosition: 4,
      previousStepId: 'chidi-obligation',
      nextStepId: 'amaka-collections',
      perspectiveAvailability: ['chidi'],
      skippable: false,
      resumable: true,
    },
    {
      experienceId: 'circle',
      stepId: 'amaka-collections',
      routeSegment: 'amaka/collections',
      label: 'Collections',
      order: 5,
      progressPosition: 5,
      previousStepId: 'member-payment',
      nextStepId: 'amaka-treasury',
      perspectiveAvailability: ['amaka'],
      skippable: false,
      resumable: true,
    },
    {
      experienceId: 'circle',
      stepId: 'amaka-treasury',
      routeSegment: 'amaka/treasury',
      label: 'Treasury',
      order: 6,
      progressPosition: 6,
      previousStepId: 'amaka-collections',
      nextStepId: 'prepare-payout',
      perspectiveAvailability: ['amaka'],
      skippable: false,
      resumable: true,
    },
    {
      experienceId: 'circle',
      stepId: 'prepare-payout',
      routeSegment: 'amaka/prepare-payout',
      label: 'Prepare Payout',
      order: 7,
      progressPosition: 7,
      previousStepId: 'amaka-treasury',
      nextStepId: 'approve-payout',
      perspectiveAvailability: ['amaka'],
      skippable: false,
      resumable: true,
    },
    {
      experienceId: 'circle',
      stepId: 'approve-payout',
      routeSegment: 'tunde/approve',
      label: 'Approve Payout',
      order: 8,
      progressPosition: 8,
      previousStepId: 'prepare-payout',
      nextStepId: 'treasury-update',
      perspectiveAvailability: ['tunde'],
      skippable: false,
      resumable: true,
    },
    {
      experienceId: 'circle',
      stepId: 'treasury-update',
      routeSegment: 'amaka/treasury-update',
      label: 'Treasury Update',
      order: 9,
      progressPosition: 9,
      previousStepId: 'approve-payout',
      nextStepId: 'activity-audit',
      perspectiveAvailability: ['amaka'],
      skippable: false,
      resumable: true,
    },
    {
      experienceId: 'circle',
      stepId: 'activity-audit',
      routeSegment: 'activity-audit',
      label: 'Activity, Audit and Statement',
      order: 10,
      progressPosition: 10,
      previousStepId: 'treasury-update',
      nextStepId: 'free-explore',
      perspectiveAvailability: ['chidi', 'amaka', 'tunde'],
      skippable: false,
      resumable: true,
    },
    {
      experienceId: 'circle',
      stepId: 'free-explore',
      routeSegment: 'explore',
      label: 'Explore BitBridge',
      order: 11,
      progressPosition: 11,
      previousStepId: 'activity-audit',
      nextStepId: '',
      perspectiveAvailability: ['chidi', 'amaka', 'tunde'],
      skippable: false,
      resumable: true,
    },
  ],
}

const EXPERIENCE_IDS = new Set(EXPERIENCE_DEFINITIONS.map((experience) => experience.id))
const PERSPECTIVE_IDS = new Set(PERSPECTIVE_DEFINITIONS.map((perspective) => perspective.id))
const STEP_IDS_BY_EXPERIENCE = Object.fromEntries(
  Object.entries(GUIDED_EXPERIENCE_REGISTRY).map(([experienceId, steps]) => [
    experienceId,
    new Set(steps.map((step) => step.stepId)),
  ])
)

const STEP_ALIASES_BY_EXPERIENCE = {
  circle: {
    'chidi-obligations': 'chidi-obligation',
    'chidi-payment-review': 'member-payment',
    'chidi-payment-success': 'member-payment',
    'chidi-summary': 'member-payment',
    'amaka-payout-create': 'prepare-payout',
    'amaka-payout-review': 'prepare-payout',
    'amaka-awaiting-approval': 'prepare-payout',
    'tunde-review': 'approve-payout',
    'tunde-approval': 'approve-payout',
    'amaka-completion': 'treasury-update',
    timeline: 'activity-audit',
    audit: 'activity-audit',
    'guided-complete': 'free-explore',
    'free-explore': 'free-explore',
    'chidi-obligation': 'chidi-obligation',
    'chidi-payment': 'member-payment',
    'amaka-prepare-payout': 'prepare-payout',
    'tunde-approve': 'approve-payout',
    'amaka-treasury-update': 'treasury-update',
    explore: 'free-explore',
  },
}

const defaultState = Object.freeze({
  selectedExperienceId: '',
  selectedPerspectiveId: '',
  currentStepId: '',
  simulationState: createInitialGreenfieldSimulationState(),
  hasSeenLanding: false,
  lastPath: EXPERIENCE_CENTER_ROOT_PATH,
})

const getStorage = (storage) => {
  if (storage) return storage
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage
  return null
}

const stripQueryAndHash = (value) => String(value ?? '').split('#')[0].split('?')[0]

const readRawState = (storage) => {
  const target = getStorage(storage)
  if (!target || typeof target.getItem !== 'function') return null
  return target.getItem(EXPERIENCE_CENTER_STORAGE_KEY)
}

const deriveLastPath = ({ selectedExperienceId, currentStepId, hasSeenLanding }) => {
  if (selectedExperienceId) {
    if (currentStepId) {
      return buildGuidedStepPath(selectedExperienceId, currentStepId)
    }
    return buildExperiencePath(selectedExperienceId)
  }

  return hasSeenLanding ? EXPERIENCE_CENTER_SELECTION_PATH : EXPERIENCE_CENTER_ROOT_PATH
}

export const normalizeExperienceId = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase()
  return EXPERIENCE_IDS.has(normalized) ? normalized : ''
}

export const normalizePerspectiveId = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase()
  return PERSPECTIVE_IDS.has(normalized) ? normalized : ''
}

export const normalizeExperienceStepId = (experienceId, value) => {
  const normalizedExperienceId = normalizeExperienceId(experienceId)
  if (!normalizedExperienceId) return ''

  const normalizedStepId = String(value ?? '').trim().toLowerCase()
  const aliasedStepId =
    STEP_ALIASES_BY_EXPERIENCE[normalizedExperienceId]?.[normalizedStepId] || normalizedStepId

  return STEP_IDS_BY_EXPERIENCE[normalizedExperienceId]?.has(aliasedStepId) ? aliasedStepId : ''
}

export const isGuidedExperience = (experienceId) =>
  Array.isArray(GUIDED_EXPERIENCE_REGISTRY[normalizeExperienceId(experienceId)])

export const getPerspectiveDefinition = (value) => {
  const id = normalizePerspectiveId(value)
  return PERSPECTIVE_DEFINITIONS.find((perspective) => perspective.id === id) || null
}

export const getExperienceDefinition = (value) => {
  const id = normalizeExperienceId(value)
  return EXPERIENCE_DEFINITIONS.find((experience) => experience.id === id) || null
}

export const getGuidedSteps = (experienceId) =>
  GUIDED_EXPERIENCE_REGISTRY[normalizeExperienceId(experienceId)] || []

export const getExperienceStepDefinition = (experienceId, stepId) => {
  const normalizedExperienceId = normalizeExperienceId(experienceId)
  const normalizedStepId = normalizeExperienceStepId(normalizedExperienceId, stepId)

  return (
    getGuidedSteps(normalizedExperienceId).find((step) => step.stepId === normalizedStepId) || null
  )
}

export const getExperienceEntryPath = (experienceId) => {
  const normalizedExperienceId = normalizeExperienceId(experienceId)
  if (!normalizedExperienceId) return EXPERIENCE_CENTER_SELECTION_PATH

  const steps = getGuidedSteps(normalizedExperienceId)
  if (steps.length > 0) {
    return `${EXPERIENCE_CENTER_ROOT_PATH}/${normalizedExperienceId}/${steps[0].routeSegment}`
  }

  return `${EXPERIENCE_CENTER_ROOT_PATH}/${normalizedExperienceId}`
}

export const buildGuidedStepPath = (experienceId, stepId) => {
  const step = getExperienceStepDefinition(experienceId, stepId)
  return step
    ? `${EXPERIENCE_CENTER_ROOT_PATH}/${step.experienceId}/${step.routeSegment}`
    : getExperienceEntryPath(experienceId)
}

export const buildExperiencePath = (experienceId) => getExperienceEntryPath(experienceId)

export const getGuidedProgressLabel = (experienceId, stepId) => {
  const step = getExperienceStepDefinition(experienceId, stepId)
  const steps = getGuidedSteps(experienceId)
  if (!step || steps.length === 0) return ''
  return `Step ${step.progressPosition} of ${steps.length}`
}

export const getPreviousStepPath = (experienceId, stepId) => {
  const step = getExperienceStepDefinition(experienceId, stepId)
  if (!step) return EXPERIENCE_CENTER_SELECTION_PATH
  if (!step.previousStepId) return EXPERIENCE_CENTER_ROOT_PATH
  return buildGuidedStepPath(experienceId, step.previousStepId)
}

export const getNextStepPath = (experienceId, stepId) => {
  const step = getExperienceStepDefinition(experienceId, stepId)
  if (!step || !step.nextStepId) return ''
  return buildGuidedStepPath(experienceId, step.nextStepId)
}

export const normalizeExperienceCenterPath = (value) => {
  const path = stripQueryAndHash(value)

  if (path === EXPERIENCE_CENTER_ROOT_PATH || path === `${EXPERIENCE_CENTER_ROOT_PATH}/`) {
    return EXPERIENCE_CENTER_ROOT_PATH
  }

  if (path === EXPERIENCE_CENTER_SELECTION_PATH) {
    return EXPERIENCE_CENTER_SELECTION_PATH
  }

  const segments = path.split('/').filter(Boolean)
  if (segments[0] !== 'experience-center') return ''

  if (segments.length === 2) {
    const experienceId = normalizeExperienceId(segments[1])
    return experienceId ? buildExperiencePath(experienceId) : ''
  }

  if (segments.length >= 3) {
    const experienceId = normalizeExperienceId(segments[1])
    if (!experienceId) return ''

    const stepId = normalizeExperienceStepId(experienceId, segments.slice(2).join('-'))
    if (stepId) return buildGuidedStepPath(experienceId, stepId)
    return isGuidedExperience(experienceId) ? getExperienceEntryPath(experienceId) : ''
  }

  return ''
}

export const isExperienceCenterPath = (value) => normalizeExperienceCenterPath(value) !== ''

export const getExperienceCenterState = (storage) => {
  try {
    const raw = readRawState(storage)
    if (!raw) return { ...defaultState }

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return { ...defaultState }

    const selectedExperienceId = normalizeExperienceId(parsed.selectedExperienceId)
    const selectedPerspectiveId = normalizePerspectiveId(parsed.selectedPerspectiveId)
    const simulationState = normalizeGreenfieldSimulationState(parsed.simulationState)
    const hasSeenLanding = parsed.hasSeenLanding === true
    const currentStepId = normalizeExperienceStepId(selectedExperienceId, parsed.currentStepId)
    const lastPath =
      normalizeExperienceCenterPath(parsed.lastPath) ||
      deriveLastPath({ selectedExperienceId, currentStepId, hasSeenLanding })

    return {
      selectedExperienceId,
      selectedPerspectiveId,
      currentStepId,
      simulationState,
      hasSeenLanding,
      lastPath,
    }
  } catch {
    return { ...defaultState }
  }
}

export const saveExperienceCenterState = (nextState, storage) => {
  const target = getStorage(storage)
  if (!target || typeof target.setItem !== 'function') return { ...defaultState }

  const current = getExperienceCenterState(target)
  const selectedExperienceId = normalizeExperienceId(
    nextState?.selectedExperienceId ?? current.selectedExperienceId
  )
  const selectedPerspectiveId = normalizePerspectiveId(
    nextState?.selectedPerspectiveId ?? current.selectedPerspectiveId
  )
  const simulationState = normalizeGreenfieldSimulationState(
    nextState?.simulationState ?? current.simulationState
  )
  const hasSeenLanding = nextState?.hasSeenLanding === true || current.hasSeenLanding === true
  const currentStepId = normalizeExperienceStepId(
    selectedExperienceId,
    nextState?.currentStepId ?? current.currentStepId
  )
  const candidatePath = normalizeExperienceCenterPath(nextState?.lastPath)
  const lastPath =
    candidatePath || deriveLastPath({ selectedExperienceId, currentStepId, hasSeenLanding })

  const normalized = {
    selectedExperienceId,
    selectedPerspectiveId,
    currentStepId,
    simulationState,
    hasSeenLanding,
    lastPath,
  }

  target.setItem(EXPERIENCE_CENTER_STORAGE_KEY, JSON.stringify(normalized))
  return normalized
}

export const clearExperienceCenterState = (storage) => {
  const target = getStorage(storage)
  if (!target || typeof target.removeItem !== 'function') return
  target.removeItem(EXPERIENCE_CENTER_STORAGE_KEY)
}

export const isKnownExperienceId = (value) => normalizeExperienceId(value) !== ''

export const resolveExperienceCenterRoute = ({ enabled, experienceId, stepId, pathname }) => {
  if (!enabled) {
    return { allowed: false, redirectTo: EXPERIENCE_CENTER_HOME_PATH }
  }

  if (!pathname || pathname === EXPERIENCE_CENTER_ROOT_PATH || pathname === `${EXPERIENCE_CENTER_ROOT_PATH}/`) {
    return { allowed: true, redirectTo: EXPERIENCE_CENTER_ROOT_PATH }
  }

  if (pathname === EXPERIENCE_CENTER_SELECTION_PATH) {
    return { allowed: true, redirectTo: EXPERIENCE_CENTER_SELECTION_PATH }
  }

  const normalizedExperienceId = normalizeExperienceId(experienceId)
  if (!normalizedExperienceId) {
    return { allowed: true, redirectTo: EXPERIENCE_CENTER_SELECTION_PATH }
  }

  if (isGuidedExperience(normalizedExperienceId)) {
    const normalizedStepId = normalizeExperienceStepId(normalizedExperienceId, stepId)
    return {
      allowed: true,
      redirectTo: normalizedStepId
        ? buildGuidedStepPath(normalizedExperienceId, normalizedStepId)
        : getExperienceEntryPath(normalizedExperienceId),
    }
  }

  return { allowed: true, redirectTo: buildExperiencePath(normalizedExperienceId) }
}

export const getResumePath = (state) => {
  if (!state || !state.hasSeenLanding) return ''

  const normalizedPath = normalizeExperienceCenterPath(state.lastPath)
  if (!normalizedPath) return ''
  return normalizedPath
}

export const createExperienceSelectionState = (experienceId, currentPath) => {
  const selectedExperienceId = normalizeExperienceId(experienceId)
  const normalizedPath = normalizeExperienceCenterPath(currentPath)
  const currentStepId = normalizeExperienceStepId(
    selectedExperienceId,
    stripQueryAndHash(normalizedPath).split('/').filter(Boolean).slice(2).join('-')
  )

  return {
    selectedExperienceId,
    selectedPerspectiveId: selectedExperienceId === 'circle' ? 'chidi' : '',
    currentStepId,
    simulationState: createInitialGreenfieldSimulationState(),
    hasSeenLanding: true,
    lastPath: normalizedPath || buildExperiencePath(experienceId),
  }
}

export const createGuidedStepState = ({
  experienceId,
  stepId,
  perspectiveId,
  simulationState = createInitialGreenfieldSimulationState(),
}) => ({
  selectedExperienceId: normalizeExperienceId(experienceId),
  selectedPerspectiveId: normalizePerspectiveId(perspectiveId),
  currentStepId: normalizeExperienceStepId(experienceId, stepId),
  simulationState: normalizeGreenfieldSimulationState(simulationState),
  hasSeenLanding: true,
  lastPath: buildGuidedStepPath(experienceId, stepId),
})

export const persistGuidedStepState = ({
  experienceId,
  stepId,
  perspectiveId,
  simulationState = createInitialGreenfieldSimulationState(),
  storage,
}) =>
  saveExperienceCenterState(
    createGuidedStepState({
      experienceId,
      stepId,
      perspectiveId,
      simulationState,
    }),
    storage
  )

export const createPerspectiveState = ({
  experienceId,
  stepId,
  perspectiveId,
  simulationState = createInitialGreenfieldSimulationState(),
}) => ({
  selectedExperienceId: normalizeExperienceId(experienceId),
  selectedPerspectiveId: normalizePerspectiveId(perspectiveId),
  currentStepId: normalizeExperienceStepId(experienceId, stepId),
  simulationState: normalizeGreenfieldSimulationState(simulationState),
  hasSeenLanding: true,
  lastPath: buildGuidedStepPath(experienceId, stepId),
})

export const getExperienceCenterCompletedEventIds = (state) =>
  getSimulationCompletedEventIds(state?.simulationState)

export const normalizeGuidedAction = (action) => {
  if (!action || action.hidden) {
    return { hidden: true, state: 'hidden', label: '', reason: '', onClick: undefined }
  }

  const state = ['enabled', 'disabled', 'unavailable'].includes(action.state)
    ? action.state
    : 'enabled'

  return {
    hidden: false,
    state,
    label: String(action.label || ''),
    reason: String(action.reason || ''),
    onClick: typeof action.onClick === 'function' ? action.onClick : undefined,
  }
}
