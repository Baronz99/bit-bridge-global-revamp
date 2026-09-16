import { toActionDescriptor } from './financialAccountState'

const STEP_CONFIG = {
  profile: {
    key: 'profile',
    label: 'Business details',
    shortLabel: 'Details',
    description: 'Share your business details and add the person authorised to act for it.',
    route: '/dashboard/business/onboarding',
  },
  documents: {
    key: 'documents',
    label: 'Review and submit',
    shortLabel: 'Submit',
    description: 'Confirm your details and submit your business for review.',
    route: '/dashboard/business/kyb',
  },
  review: {
    key: 'review',
    label: 'In review',
    shortLabel: 'In review',
    description: 'We are reviewing your details and will let you know if anything else is needed.',
    route: '/dashboard/business/kyb',
  },
  live: {
    key: 'live',
    label: 'Account ready',
    shortLabel: 'Ready',
    description: 'Your business account is ready for transfers, payments, and day-to-day use.',
    route: '/dashboard/business',
  },
}

const STATUS_BADGES = {
  setup: 'Complete your business details',
  kyb_review: 'Ready for review',
  awaiting_provision: 'Almost ready',
  live: 'Account ready',
}

const PROFILE_FIELD_GROUPS = {
  company_details: [
    'name',
    'legal_name',
    'business_type',
    'registration_number',
    'business_bvn',
    'date_of_registration',
    'category',
    'business_description',
  ],
  contact_details: [
    'contact_email',
    'contact_phone',
    'address_line_1',
    'city',
    'state',
    'country',
    'registered_address_line_1',
    'registered_city',
    'registered_state',
    'registered_country',
  ],
  signatory_details: ['signatories'],
}

const normalizeString = (value) => String(value || '').trim()

const titleCase = (value) =>
  normalizeString(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())

const filterBlockingItems = (blockingItems, allowedKeys) => {
  const allowSet = new Set(allowedKeys)
  return (Array.isArray(blockingItems) ? blockingItems : []).filter((item) => allowSet.has(item.key))
}

const buildStepperSteps = ({ status, currentStep, progress }) =>
  Object.values(STEP_CONFIG).map((step) => {
    let state = 'upcoming'

    if (step.key === 'profile') {
      state = progress?.profileReady ? 'complete' : currentStep === 'profile' ? 'current' : 'upcoming'
    } else if (step.key === 'documents') {
      state =
        status === 'kyb_review' || status === 'awaiting_provision' || status === 'live'
          ? 'complete'
          : currentStep === 'documents'
          ? 'current'
          : 'upcoming'
    } else if (step.key === 'review') {
      state =
        status === 'awaiting_provision' || status === 'live'
          ? 'complete'
          : status === 'kyb_review' || currentStep === 'review'
          ? 'current'
          : 'upcoming'
    } else if (step.key === 'live') {
      state = status === 'live' ? 'complete' : currentStep === 'live' ? 'current' : 'upcoming'
    }

    return {
      ...step,
      state,
      isCurrent: currentStep === step.key,
      isComplete: state === 'complete',
    }
  })

const buildProfileContent = (viewModel) => {
  const requirements = viewModel.onboarding?.requirements || {}
  const companyFields = requirements?.groups?.company_details?.missing_fields || []
  const contactFields = requirements?.groups?.contact_details?.missing_fields || []
  const signatoryItems = (viewModel.blockingRequirements || []).filter((item) =>
    [
      'signatories',
      'signatory',
      'authorized_signatory',
      'full_name',
      'email',
      'phone',
      'title',
      'date_of_birth',
      'nationality',
      'address_line_1',
      'city',
      'state',
      'postal_code',
      'country',
      'bvn',
      'identification_type',
      'id_document_number',
    ].includes(item.key)
  )

  return {
    title: 'Tell us about your business',
    description: 'Enter your business details and authorised signatory to continue.',
    helperContent: 'We save your draft automatically, so you can return and continue without starting over.',
    formSections: [
      {
        key: 'company_details',
        title: 'Business details',
        description: 'Enter your registered business information exactly as it appears on your documents.',
        fieldGroups: PROFILE_FIELD_GROUPS.company_details,
        blockingItems: filterBlockingItems(viewModel.blockingRequirements, companyFields),
      },
      {
        key: 'contact_details',
        title: 'Contact and address',
        description: 'Add the best contact details for your business and where it operates.',
        fieldGroups: PROFILE_FIELD_GROUPS.contact_details,
        blockingItems: filterBlockingItems(viewModel.blockingRequirements, contactFields),
      },
      {
        key: 'signatory_details',
        title: 'Authorised signatory',
        description: 'Add the person who can verify and manage this business account.',
        fieldGroups: PROFILE_FIELD_GROUPS.signatory_details,
        blockingItems: signatoryItems,
      },
    ],
    primaryAction: {
      key: 'save_onboarding_profile',
      label: 'Save and continue',
      route: '/dashboard/business/onboarding',
      kind: 'submit',
      tone: 'primary',
    },
  }
}

const buildDocumentsContent = (viewModel) => {
  const provider = viewModel.kyb?.provider || null
  const gate = viewModel.kyb?.gate || null
  const hasAnchorCustomer = Boolean(provider?.anchor_customer_id)
  const readiness = viewModel.progress?.readiness || {}
  const profileBlockingItems = filterBlockingItems(viewModel.blockingRequirements, [
    ...(readiness.missing_profile_fields || []),
    ...(viewModel.onboarding?.requirements?.groups?.company_details?.missing_fields || []),
    ...(viewModel.onboarding?.requirements?.groups?.contact_details?.missing_fields || []),
  ])
  const signatoryKeys = [
    ...((readiness.missing_signatory_requirements || []).filter((item) => item !== 'officer_details')),
    ...(readiness.missing_signatory_fields || []),
  ]
  const signatoryBlockingItems = filterBlockingItems(viewModel.blockingRequirements, signatoryKeys)

  return {
    title: 'Review and submit your business',
    description: hasAnchorCustomer
      ? 'Additional documents are needed to continue verification. Upload them here.'
      : 'Review the checklist below, keep those documents ready, and submit your business for review from this screen.',
    helperContent: hasAnchorCustomer
      ? 'Only requested documents need attention right now.'
      : 'You do not need to upload anything before submission unless we ask for it later.',
    formSections: [
      {
        key: 'submission_requirements',
        title: 'Required before submission',
        description: 'Complete these items before you send your business for review.',
        fieldGroups: ['submission_requirements'],
        blockingItems: [...profileBlockingItems, ...signatoryBlockingItems],
      },
      {
        key: 'pre_submission_documents',
        title: 'Keep ready if requested',
        description: 'These documents do not block submission right now. Keep them ready in case we ask for them during review.',
        fieldGroups: ['pre_submission_documents'],
        blockingItems: [],
      },
    ],
    primaryAction: gate?.submitted
      ? {
          key: 'upload_required_documents',
          label: 'Upload requested documents',
          route: '/dashboard/business/kyb',
          kind: 'upload',
          tone: 'primary',
        }
      : {
          key: 'submit_for_provider_review',
          label: 'Submit for review',
          route: '/dashboard/business/kyb',
          kind: 'submit',
          tone: 'primary',
        },
  }
}

const buildReviewContent = (viewModel) => {
  const gate = viewModel.kyb?.gate || null
  const provider = viewModel.kyb?.provider || null
  const submitted = Boolean(gate?.submitted)
  const approvedForProvisioning = Boolean(viewModel.progress?.approvedForProvisioning)
  const canProvision = Boolean(viewModel.progress?.canProvision)

  let primaryAction = {
    key: 'refresh_provider_status',
    label: 'Check review status',
    route: '/dashboard/business/kyb',
    kind: 'refresh',
    tone: 'primary',
  }

  if (approvedForProvisioning && canProvision) {
    primaryAction = toActionDescriptor('activate_business_account', {
      route: '/dashboard/business',
      tone: 'primary',
    })
  } else if (!submitted) {
    primaryAction = {
      key: 'submit_for_provider_review',
      label: 'Submit for review',
      route: '/dashboard/business/kyb',
      kind: 'submit',
      tone: 'primary',
    }
  }

  const reviewBlockingItems = []

  if (!submitted) {
    reviewBlockingItems.push({
      key: 'provider_submission',
      label: 'Submit your business for review',
    })
  }

  if (submitted && !provider?.anchor_customer_id) {
    reviewBlockingItems.push({
      key: 'provider_customer_creation',
      label: 'We are preparing your verification review',
    })
  }

  if (submitted && !approvedForProvisioning) {
    reviewBlockingItems.push({
      key: 'provider_approval',
      label: 'Review is still in progress',
    })
  }

  return {
    title: approvedForProvisioning ? 'Your business is approved' : 'Verification in progress',
    description: approvedForProvisioning
      ? 'Verification is complete. We are now preparing your account for live use.'
      : 'We are reviewing your submission. If anything else is needed, you will see it here.',
    helperContent: approvedForProvisioning
      ? 'You can return here until your account is fully ready.'
      : 'We will keep this page updated as your review moves forward.',
    formSections: [
      {
        key: 'provider_review',
        title: 'Review status',
        description: 'See where your verification stands and whether anything else is needed.',
        fieldGroups: ['provider_review'],
        blockingItems: reviewBlockingItems,
      },
    ],
    primaryAction,
  }
}

const buildLiveContent = () => ({
  title: 'Your business account is ready',
  description: 'Your wallet and receiving account are now available.',
  helperContent: 'You can now move into your full business workspace.',
  formSections: [],
  primaryAction: toActionDescriptor('activate_business_account', {
    label: 'Open account overview',
    route: '/dashboard/business',
    tone: 'primary',
  }),
})

export const deriveBusinessOnboardingPresentation = (viewModel, requestedStep) => {
  const safeRequestedStep = STEP_CONFIG[requestedStep] ? requestedStep : 'profile'
  const status = viewModel.status
  const currentStep = status === 'live' ? 'live' : safeRequestedStep
  const statusBadge = STATUS_BADGES[status] || 'Business onboarding'
  const providerRequestedDocuments = Array.isArray(viewModel.kyb?.requirements?.documents?.provider_requested)
    ? viewModel.kyb.requirements.documents.provider_requested
    : []

  let currentStepContent = buildProfileContent(viewModel)
  if (currentStep === 'documents') currentStepContent = buildDocumentsContent(viewModel)
  if (currentStep === 'review') currentStepContent = buildReviewContent(viewModel)
  if (currentStep === 'live') currentStepContent = buildLiveContent()

  const blockingItems =
    currentStepContent.formSections.flatMap((section) => section.blockingItems || []).filter((item, index, collection) => {
      const key = item?.key || item?.label || index
      return collection.findIndex((entry) => (entry?.key || entry?.label) === key) === index
    })

  const navigationItems = [
    { key: 'overview', label: 'Overview', route: '/dashboard/business' },
    {
      key: currentStep,
      label: STEP_CONFIG[currentStep]?.label || titleCase(currentStep),
      route: STEP_CONFIG[currentStep]?.route || '/dashboard/business',
    },
    { key: 'settings', label: 'Settings', route: '/dashboard/business/settings' },
  ].filter((item, index, collection) => collection.findIndex((entry) => entry.key === item.key) === index)

  const stepOrder = Object.keys(STEP_CONFIG)
  const activeIndex = Math.max(
    0,
    stepOrder.findIndex((stepKey) => stepKey === currentStep)
  )
  const activeStep = STEP_CONFIG[currentStep] || STEP_CONFIG.profile
  const previousStep = activeIndex > 0 ? STEP_CONFIG[stepOrder[activeIndex - 1]] : null
  const nextStep = activeIndex < stepOrder.length - 1 ? STEP_CONFIG[stepOrder[activeIndex + 1]] : null
  const completedSteps = buildStepperSteps({
    status,
    currentStep,
    progress: viewModel.progress,
  }).filter((step) => step.isComplete).length
  const currentStepBlockers = blockingItems
  const primaryAction = currentStepContent.primaryAction || null
  const secondaryAction = previousStep
    ? {
        key: `back_to_${previousStep.key}`,
        label: 'Back',
        route: previousStep.route,
        tone: 'neutral',
      }
    : {
        key: 'return_to_overview',
        label: 'Return to overview',
        route: '/dashboard/business',
        tone: 'neutral',
      }
  const steps = buildStepperSteps({
    status,
    currentStep,
    progress: viewModel.progress,
  }).map((step) => {
    if (step.key === 'review' && providerRequestedDocuments.length > 0) {
      return {
        ...step,
        label: 'More information needed',
        shortLabel: 'More info',
        description: 'Add the requested information so we can continue your review.',
      }
    }

    return step
  })

  return {
    screenMode: 'onboarding',
    activeStep,
    previousStep,
    nextStep,
    currentStepTitle: currentStepContent.title,
    currentStepDescription: currentStepContent.description,
    hero: {
      title: viewModel.entity?.name || 'Set up your business account',
      subtitle:
        currentStepContent.description ||
        viewModel.nextAction ||
        'Complete each step to verify your business and unlock your account.',
      statusBadge,
    },
    stepper: {
      steps,
      currentStep,
      currentIndex: activeIndex + 1,
      totalSteps: steps.length,
      completedSteps,
    },
    currentStepContent,
    blockingItems: currentStepBlockers,
    currentStepBlockers,
    compactHelperContent: currentStepContent.helperContent || '',
    primaryAction,
    secondaryAction,
    navigation: {
      minimalNavItems: navigationItems,
    },
  }
}
