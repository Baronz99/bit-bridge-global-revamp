import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import BusinessSetupShell from '../../components/business/BusinessSetupShell'
import useSelectedBusiness from '../../hooks/useSelectedBusiness'
import useBusinessOnboardingPresentation from '../../hooks/useBusinessOnboardingPresentation'
import BusinessWorkspaceRequired from '../../components/business/BusinessWorkspaceRequired'
import {
  getBusinessOnboarding,
  getBusinessKyb,
  getBusinessKybDocuments,
  getBusinessKybStatus,
  resyncBusinessKyb,
  submitBusinessKyb,
  uploadBusinessKybDocument,
} from '../../api/business'

const cardClass =
  'rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.22)]'

const documentCatalog = {
  registration_certificate: {
    title: 'Registration certificate',
    description: 'Your certificate of incorporation or CAC registration document.',
  },
  proof_of_address: {
    title: 'Proof of address',
    description: 'A recent utility bill or other official proof of business address.',
  },
  tax_registration: {
    title: 'Tax registration',
    description: 'Your tax or TIN registration document, if requested.',
  },
  memorandum_of_association: {
    title: 'Memorandum / formation document',
    description: 'Your memorandum or other formation document, if requested.',
  },
}

const CUSTOMER_STATUS_LABELS = {
  draft: 'In progress',
  pending: 'In progress',
  submitted: 'In review',
  under_review: 'In review',
  approved: 'Ready for activation',
  active: 'Account ready',
}

const formatLabel = (value) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())

const formatDate = (value) => {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return date.toLocaleString()
}

const toneForStatus = (value) => {
  const status = String(value || '').toLowerCase()
  if (['approved', 'verified', 'active', 'successful'].includes(status)) {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
  }
  if (['rejected', 'failed', 'restricted', 'expired'].includes(status)) {
    return 'border-rose-500/30 bg-rose-500/10 text-rose-200'
  }
  return 'border-amber-500/30 bg-amber-500/10 text-amber-200'
}

const formatCustomerStatus = (value) => {
  const normalized = String(value || '').toLowerCase()
  return CUSTOMER_STATUS_LABELS[normalized] || 'In progress'
}

const listFormatter = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' })

const buildOnboardingRoute = (params = {}) => {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  })
  const search = query.toString()
  return `/dashboard/business/onboarding${search ? `?${search}` : ''}`
}

const summaryItem = (label, value) => ({
  label,
  value: String(value || '').trim() || 'Not provided yet',
})

const buildSubmissionErrorMessage = (error) => {
  const responseData = error?.response?.data || {}
  const details = Array.isArray(responseData.details) ? responseData.details : []
  const firstDetail = details[0]

  if (firstDetail?.message) {
    return firstDetail.message
  }

  return responseData.message || 'We could not submit your business for review right now.'
}

const extractSubmissionErrorDetails = (error) => {
  const responseData = error?.response?.data || {}
  return Array.isArray(responseData.details) ? responseData.details : []
}

const BusinessKyb = () => {
  const { ownerMode, selectedBusiness } = useSelectedBusiness()
  const [loading, setLoading] = useState(true)
  const [uploadingKind, setUploadingKind] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [resyncing, setResyncing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [businessEntity, setBusinessEntity] = useState(null)
  const [documents, setDocuments] = useState([])
  const [readiness, setReadiness] = useState(null)
  const [gate, setGate] = useState(null)
  const [requirements, setRequirements] = useState(null)
  const [provider, setProvider] = useState(null)
  const [onboardingProfile, setOnboardingProfile] = useState(null)
  const [onboardingSignatories, setOnboardingSignatories] = useState([])
  const [submissionErrorDetails, setSubmissionErrorDetails] = useState([])

  const currentRole = String(selectedBusiness?.current_user_role || '').toLowerCase()
  const canUpload = ['owner', 'admin'].includes(currentRole)
  const canSubmit = ['owner', 'admin'].includes(currentRole)
  const normalizedStatus = String(businessEntity?.status || '').toLowerCase()
  const approvedForProvisioning = Boolean(gate?.approved_for_provisioning)
  const isLive = normalizedStatus === 'active'
  const hasAnchorCustomer = Boolean(provider?.anchor_customer_id)
  const presentationStep = approvedForProvisioning || gate?.submitted || isLive ? 'review' : 'documents'
  const { hero, stepper, currentStepContent, compactHelperContent } = useBusinessOnboardingPresentation(
    selectedBusiness?.id,
    presentationStep
  )
  const statusLabel = formatCustomerStatus(businessEntity?.status)
  const canSubmitNow = Boolean(gate?.can_submit_kyb) && canSubmit
  const officerRules = requirements?.signatories?.officer_rules || null

  useEffect(() => {
    let active = true

    const loadKyb = async () => {
      if (!selectedBusiness?.id) {
        setLoading(false)
        return
      }

      setLoading(true)
      setErrorMessage('')
      try {
        const [kybRes, docsRes, statusRes, onboardingRes] = await Promise.all([
          getBusinessKyb(selectedBusiness.id),
          getBusinessKybDocuments(selectedBusiness.id),
          getBusinessKybStatus(selectedBusiness.id),
          getBusinessOnboarding(selectedBusiness.id).catch(() => null),
        ])

        if (!active) return

        const kybData = kybRes?.data?.data || {}
        const docsData = docsRes?.data?.data || {}
        const statusData = statusRes?.data?.data || {}

        setBusinessEntity(kybData.business_entity || statusData.business_entity || null)
        setDocuments(Array.isArray(docsData.documents) ? docsData.documents : Array.isArray(kybData.documents) ? kybData.documents : [])
        setReadiness(kybData.readiness || statusData.readiness || null)
        setGate(kybData.gate || statusData.gate || null)
        setRequirements(kybData.requirements || docsData.requirements || statusData.requirements || null)
      setProvider(statusData.provider || docsData.provider || null)
      setOnboardingProfile(onboardingRes?.data?.data?.profile || null)
      setOnboardingSignatories(Array.isArray(onboardingRes?.data?.data?.signatories) ? onboardingRes.data.data.signatories : [])
      setSubmissionErrorDetails([])
    } catch (error) {
        if (!active) return
        setErrorMessage(error?.response?.data?.message || 'We could not load your verification details right now.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadKyb()
    return () => {
      active = false
    }
  }, [selectedBusiness?.id])

  const preSubmissionDocuments = useMemo(() => {
    const configured = requirements?.documents?.pre_submission
    if (Array.isArray(configured) && configured.length) return configured

    const missing = Array.isArray(readiness?.missing_document_kinds) ? readiness.missing_document_kinds : []
    const present = documents.map((item) => item.document_kind)
    return [...new Set([...missing, ...present, 'registration_certificate', 'proof_of_address'])].map((kind) => ({
      kind,
      label: documentCatalog[kind]?.title || formatLabel(kind),
      description: documentCatalog[kind]?.description || 'Business verification document required for review.',
    }))
  }, [documents, readiness, requirements?.documents?.pre_submission])

  const providerRequestedDocuments = useMemo(() => {
    const configured = requirements?.documents?.provider_requested
    return Array.isArray(configured) ? configured : []
  }, [requirements?.documents?.provider_requested])

  const submissionTasks = useMemo(() => {
    if (gate?.submitted) return []

    if (!canSubmit) {
      return [
        {
          key: 'submit_role',
          title: 'Use an owner or admin account',
          description: 'Only the business owner or an admin can submit this business for review.',
          route: '/dashboard/business',
          ctaLabel: 'Return to overview',
        },
      ]
    }

    const companyFields = requirements?.groups?.company_details?.missing_fields || []
    const contactFields = requirements?.groups?.contact_details?.missing_fields || []
    const signatoryRequirements = [...new Set(Array.isArray(readiness?.missing_signatory_requirements) ? readiness.missing_signatory_requirements : [])]
    const signatoryIssues = Array.isArray(readiness?.signatory_issues) ? readiness.signatory_issues : []
    const tasks = []
    const detailCodes = new Set(submissionErrorDetails.map((item) => String(item?.code || '').trim()).filter(Boolean))

    if (companyFields.length) {
      const fieldLabels = companyFields.map((field) => requirements?.fields?.[field]?.label || formatLabel(field))
      tasks.push({
        key: 'company_details',
        title: 'Complete business details',
        description: `Finish the remaining business information: ${listFormatter.format(fieldLabels)}.`,
        route: buildOnboardingRoute({ section: 'business', fields: companyFields.join(',') }),
        ctaLabel: 'Finish business details',
      })
    }

    if (contactFields.length) {
      const fieldLabels = contactFields.map((field) => requirements?.fields?.[field]?.label || formatLabel(field))
      tasks.push({
        key: 'contact_details',
        title: 'Complete contact and address',
        description: `Finish the remaining contact details: ${listFormatter.format(fieldLabels)}.`,
        route: buildOnboardingRoute({ section: 'contact', fields: contactFields.join(',') }),
        ctaLabel: 'Finish contact details',
      })
    }

    if (signatoryRequirements.includes('authorized_signatory')) {
      tasks.push({
        key: 'authorized_signatory',
        title: 'Choose an authorised signatory',
        description: 'Mark at least one person as the authorised signatory for this business before submission.',
        route: buildOnboardingRoute({ section: 'signatory', fields: 'authorized_signatory' }),
        ctaLabel: 'Update signatory',
      })
    }

    if (detailCodes.has('anchor_director_required')) {
      tasks.push({
        key: 'director_required',
        title: 'Add a director signatory',
        description: 'Private incorporated businesses require at least one DIRECTOR and one OWNER before submission.',
        route: buildOnboardingRoute({ section: 'signatory', fields: 'director' }),
        ctaLabel: 'Add director',
      })
    }

    if (detailCodes.has('anchor_owner_required')) {
      tasks.push({
        key: 'owner_required',
        title: 'Add an owner signatory',
        description: 'Private incorporated businesses require at least one OWNER signatory before submission.',
        route: buildOnboardingRoute({ section: 'signatory', fields: 'ownership_percentage' }),
        ctaLabel: 'Add owner',
      })
    }

    signatoryIssues
      .filter((issue) => Array.isArray(issue?.missing_fields) && issue.missing_fields.length)
      .forEach((issue) => {
        const fieldLabels = issue.missing_fields.map((field) => requirements?.signatories?.fields?.[field]?.label || formatLabel(field))
        tasks.push({
          key: `signatory_${issue.signatory_index}`,
          title: `Finish ${issue.signatory_label || `signatory ${Number(issue.signatory_index || 0) + 1}`}`,
          description: `This signatory is still missing ${listFormatter.format(fieldLabels)}.`,
          route: buildOnboardingRoute({
            section: 'signatory',
            signatory: issue.signatory_index,
            fields: issue.missing_fields.join(','),
          }),
          ctaLabel: 'Complete signatory details',
        })
      })

    return tasks
  }, [
    canSubmit,
    gate?.submitted,
    readiness?.missing_signatory_requirements,
    readiness?.signatory_issues,
    requirements?.fields,
    requirements?.groups?.company_details?.missing_fields,
    requirements?.groups?.contact_details?.missing_fields,
    requirements?.signatories?.fields,
    submissionErrorDetails,
  ])

  const primaryRecoveryTask = submissionTasks[0] || null
  const reviewSections = useMemo(
    () => [
      {
        key: 'business',
        title: 'Business details',
        editRoute: buildOnboardingRoute({ section: 'business' }),
        items: [
          summaryItem('Business name', onboardingProfile?.legal_name || businessEntity?.name),
          summaryItem('Business type', formatLabel(onboardingProfile?.business_type)),
          summaryItem('Registration number', onboardingProfile?.registration_number),
          summaryItem('Business BVN', onboardingProfile?.business_bvn),
          summaryItem('Business category', formatLabel(onboardingProfile?.category)),
          summaryItem('Date of registration', onboardingProfile?.date_of_registration),
        ],
      },
      {
        key: 'contact',
        title: 'Contact and address',
        editRoute: buildOnboardingRoute({ section: 'contact' }),
        items: [
          summaryItem('Contact email', onboardingProfile?.contact_email),
          summaryItem('Contact phone', onboardingProfile?.contact_phone),
          summaryItem('Operating address', onboardingProfile?.address_line_1),
          summaryItem(
            'Location',
            [onboardingProfile?.city, onboardingProfile?.state, onboardingProfile?.country].filter(Boolean).join(', ')
          ),
        ],
      },
      {
        key: 'signatory',
        title: 'Authorised signatory',
        editRoute: buildOnboardingRoute({ section: 'signatory' }),
        items:
          onboardingSignatories.length > 0
            ? onboardingSignatories.slice(0, 2).map((item, index) => ({
                label: onboardingSignatories.length > 1 ? `Signatory ${index + 1}` : 'Primary signatory',
                value: [
                  item?.full_name || [item?.first_name, item?.last_name].filter(Boolean).join(' '),
                  item?.director === false ? 'Owner' : 'Director',
                  item?.director === false && item?.ownership_percentage !== null && item?.ownership_percentage !== undefined
                    ? `${item.ownership_percentage}% owned`
                    : null,
                  item?.title,
                  item?.email,
                  item?.phone,
                ]
                  .filter(Boolean)
                  .join(' · '),
              }))
            : [summaryItem('Primary signatory', '')],
      },
    ],
    [businessEntity?.name, onboardingProfile, onboardingSignatories]
  )
  const submissionState = !canSubmit
    ? 'role_locked'
    : canSubmitNow
      ? 'ready'
      : 'blocked'

  const refreshKybState = async () => {
    if (!selectedBusiness?.id) return
    const [kybRes, docsRes, statusRes, onboardingRes] = await Promise.all([
      getBusinessKyb(selectedBusiness.id),
      getBusinessKybDocuments(selectedBusiness.id),
      getBusinessKybStatus(selectedBusiness.id),
      getBusinessOnboarding(selectedBusiness.id).catch(() => null),
    ])
    const kybData = kybRes?.data?.data || {}
    const docsData = docsRes?.data?.data || {}
    const statusData = statusRes?.data?.data || {}
    setBusinessEntity(kybData.business_entity || statusData.business_entity || null)
    setDocuments(Array.isArray(docsData.documents) ? docsData.documents : Array.isArray(kybData.documents) ? kybData.documents : [])
    setReadiness(kybData.readiness || statusData.readiness || null)
    setGate(kybData.gate || statusData.gate || null)
    setRequirements(kybData.requirements || docsData.requirements || statusData.requirements || null)
    setProvider(statusData.provider || docsData.provider || null)
    setOnboardingProfile(onboardingRes?.data?.data?.profile || null)
    setOnboardingSignatories(Array.isArray(onboardingRes?.data?.data?.signatories) ? onboardingRes.data.data.signatories : [])
  }

  const handleUpload = async (documentKind, file) => {
    if (!selectedBusiness?.id || !file) return
    setUploadingKind(documentKind)
    setErrorMessage('')
    try {
      await uploadBusinessKybDocument(selectedBusiness.id, {
        document_kind: documentKind,
        file,
      })
      toast.success(`${formatLabel(documentKind)} uploaded.`)
      await refreshKybState()
    } catch (error) {
      const message = error?.response?.data?.message || 'We could not upload that document right now.'
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setUploadingKind(null)
    }
  }

  const handleSubmitKyb = async () => {
    if (!selectedBusiness?.id) return
    setSubmitting(true)
    setErrorMessage('')
    setSubmissionErrorDetails([])
    try {
      const response = await submitBusinessKyb(selectedBusiness.id)
      toast.success(response?.data?.message || 'Your business has been submitted for review.')
      await refreshKybState()
    } catch (error) {
      const message = buildSubmissionErrorMessage(error)
      const details = extractSubmissionErrorDetails(error)
      setSubmissionErrorDetails(details)
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleResync = async () => {
    if (!selectedBusiness?.id) return
    setResyncing(true)
    setErrorMessage('')
    try {
      const response = await resyncBusinessKyb(selectedBusiness.id)
      toast.success(response?.data?.message || 'Review status updated.')
      await refreshKybState()
    } catch (error) {
      const message = error?.response?.data?.message || 'We could not refresh your review status right now.'
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setResyncing(false)
    }
  }

  if (ownerMode !== 'business') return <Navigate to="/dashboard/home" replace />

  if (!selectedBusiness) {
    return <BusinessWorkspaceRequired message="Select a business workspace from the switcher to continue verifying your business account." />
  }

  return (
    <BusinessSetupShell
      eyebrow="Business review"
      title={hero?.title || selectedBusiness.name}
      subtitle={compactHelperContent || currentStepContent?.description || 'We will guide you through the last step before review.'}
      statusBadge={hero?.statusBadge || 'Verification in progress'}
      progress={stepper}
      backAction={
        <Link
          to="/dashboard/business/onboarding"
          className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300 transition hover:border-slate-500 hover:text-white"
        >
          Back
        </Link>
      }
    >
      <section className={cardClass}>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{gate?.submitted ? 'Review status' : 'Submit for review'}</div>
            <h2 className="mt-2 text-xl font-semibold text-white">{currentStepContent?.title || 'Complete your business verification'}</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              {currentStepContent?.description || 'Follow the next step below so we can continue reviewing your business.'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-3 text-sm text-slate-300">
            Current status: <span className="font-semibold text-white">{statusLabel}</span>
          </div>
        </div>

        {errorMessage ? (
          <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
            {errorMessage}
          </div>
        ) : null}

        {loading ? (
          <div className="text-sm text-slate-400">Loading your verification details...</div>
        ) : !gate?.submitted ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4 text-sm text-slate-300">
              {submissionState === 'ready'
                ? 'Everything needed is ready. Submit your business for review when you are ready.'
                : submissionState === 'role_locked'
                  ? 'An owner or admin account must complete the final submission from this screen.'
                  : 'Complete only the remaining blockers below, then submit.'}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
              <div className="text-sm font-semibold text-white">
                {submissionState === 'ready' ? 'Submission status' : 'What still needs attention'}
              </div>
              <div className="mt-2 text-sm text-slate-400">
                {submissionState === 'ready'
                  ? 'There are no blockers left. You can submit from the action below.'
                  : 'Only true submission blockers are shown here.'}
              </div>
              <div className="mt-4">
                {submissionTasks.length ? (
                  <div className="space-y-3">
                    {submissionTasks.map((task) => (
                      <div key={task.key} className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-4 text-sm text-amber-100">
                        <div className="font-semibold text-white">{task.title}</div>
                        <div className="mt-1 text-amber-100/90">{task.description}</div>
                        <Link
                          to={task.route}
                          className="mt-3 inline-flex rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-50 transition hover:border-amber-300/50 hover:bg-amber-500/16"
                        >
                          {task.ctaLabel}
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-100">
                    Your business details are complete. You can submit for review now.
                  </div>
                )}
              </div>
            </div>

            <details className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-white">Review saved business details</summary>
              <div className="mt-4 space-y-4">
                {reviewSections.map((section) => (
                  <div key={section.key} className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-white">{section.title}</div>
                      <Link
                        to={section.editRoute}
                        className="text-xs font-semibold uppercase tracking-[0.14em] text-[#FFB05A] transition hover:text-[#ffd2a0]"
                      >
                        Edit
                      </Link>
                    </div>
                    <div className="mt-3 space-y-2">
                      {section.items.map((item) => (
                        <div key={`${section.key}-${item.label}`} className="text-sm text-slate-300">
                          <span className="text-slate-500">{item.label}:</span> <span className="text-slate-200">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </details>

            {officerRules ? (
              <details className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-white">Show signatory guidance</summary>
                <div className="mt-3 space-y-3 text-sm text-slate-300">
                  <div>{officerRules.summary || 'Officer requirements depend on the business registration type and review stage.'}</div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/55 px-4 py-3">
                      Registration type: <span className="font-semibold text-white">{formatLabel(officerRules.registration_type)}</span>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/55 px-4 py-3">
                      Accepted roles:{' '}
                      <span className="font-semibold text-white">
                        {Array.isArray(officerRules.accepted_roles) && officerRules.accepted_roles.length
                          ? officerRules.accepted_roles.join(', ')
                          : 'OWNER, DIRECTOR'}
                      </span>
                    </div>
                  </div>
                </div>
              </details>
            ) : null}

            <details className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-white">What to prepare</summary>
              <div className="mt-4 space-y-3">
                {preSubmissionDocuments.map((item) => {
                  const kind = String(item?.kind || '')
                  const document = documents.find((entry) => entry.document_kind === kind) || null
                  return (
                    <div key={kind} className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-white">
                            {item?.label || documentCatalog[kind]?.title || formatLabel(kind)}
                          </div>
                          <div className="mt-1 text-sm text-slate-400">
                            {item?.description || documentCatalog[kind]?.description || 'This document may be needed later in review.'}
                          </div>
                        </div>
                        <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.14em] ${toneForStatus(document?.status || 'required')}`}>
                          {document?.file_name ? 'Added' : 'Keep ready'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </details>

            <div className="flex flex-col gap-3 border-t border-slate-800 pt-2">
              {!gate?.submitted ? (
                canSubmitNow ? (
                  <button
                    type="button"
                    onClick={handleSubmitKyb}
                    disabled={submitting}
                    className="rounded-2xl bg-[#FFB05A] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#ffc27d] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? 'Submitting for review...' : currentStepContent?.primaryAction?.label || 'Submit for review'}
                  </button>
                ) : (
                  <>
                    <Link
                      to={primaryRecoveryTask?.route || '/dashboard/business/onboarding'}
                      className="rounded-2xl bg-[#FFB05A] px-4 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-[#ffc27d]"
                    >
                      {primaryRecoveryTask?.ctaLabel || 'Complete business details'}
                    </Link>
                    {primaryRecoveryTask ? (
                      <div className="text-sm text-slate-400">
                        Next required action: <span className="text-white">{primaryRecoveryTask.title}</span>
                      </div>
                    ) : null}
                  </>
                )
              ) : null}

              {!gate?.submitted && canSubmit && !gate?.can_submit_kyb && submissionTasks.length ? (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-4 text-sm text-amber-100">
                  Submission stays locked until the remaining checklist is complete.
                </div>
              ) : null}

              {!canSubmit ? (
                <div className="text-xs text-slate-500">Only the business owner or an admin can send this business for review.</div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className={`rounded-2xl border px-4 py-4 text-sm ${toneForStatus(provider?.anchor_kyb_status || provider?.anchor_customer_status || 'pending')}`}>
              <div className="font-semibold text-white">
                {approvedForProvisioning ? 'Approved' : isLive ? 'Account ready' : providerRequestedDocuments.length ? 'More information needed' : 'Under review'}
              </div>
              <div className="mt-2 text-sm text-slate-200">
                {approvedForProvisioning
                  ? 'Your review is complete. We are preparing your account for live use.'
                  : isLive
                    ? 'Your business account is ready and available for day-to-day use.'
                    : providerRequestedDocuments.length
                      ? 'Please add the requested document below so we can continue your review.'
                      : 'Your submission is in review. We will update this page if anything else is needed.'}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-300 md:grid-cols-2">
                <div>Status: {formatLabel(provider?.anchor_kyb_status || provider?.anchor_customer_status || 'pending')}</div>
                <div>Last checked: {formatDate(provider?.anchor_last_synced_at)}</div>
                <div>Reference: {provider?.anchor_customer_id || 'Being prepared'}</div>
                <div>Submission ref: {provider?.anchor_submission_reference || 'In progress'}</div>
              </div>
            </div>

            {providerRequestedDocuments.length ? (
              <div className="space-y-4">
                {providerRequestedDocuments.map((item) => {
                  const kind = String(item?.kind || '')
                  const document = documents.find((entry) => entry.document_kind === kind) || null
                  return (
                    <div key={`provider-${kind}`} className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-white">{item?.label || formatLabel(kind)}</div>
                          <div className="mt-1 text-sm text-slate-400">
                            {item?.description || 'Please add this document so we can continue your verification.'}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.14em] ${toneForStatus(document?.status || item?.provider_status || 'required')}`}>
                              {formatLabel(document?.status || item?.provider_status || 'required')}
                            </span>
                            {document?.provider_status ? (
                              <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.14em] ${toneForStatus(document.provider_status)}`}>
                                Review status: {formatLabel(document.provider_status)}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex flex-col items-start gap-2 lg:items-end">
                          <label className="cursor-pointer rounded-2xl border border-sky-400/30 bg-sky-500/10 px-4 py-3 text-sm font-medium text-sky-100 transition hover:border-sky-300/60 hover:bg-sky-500/16">
                            <span>{uploadingKind === kind ? 'Uploading...' : 'Add document'}</span>
                            <input
                              type="file"
                              className="hidden"
                              disabled={!canUpload || uploadingKind === kind}
                              onChange={(event) => {
                                const file = event.target.files?.[0]
                                if (file) handleUpload(kind, file)
                                event.target.value = ''
                              }}
                            />
                          </label>
                          {!canUpload ? <div className="text-xs text-slate-500">Only the business owner or an admin can upload files.</div> : null}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4 text-sm text-slate-300">
                There is nothing else to add right now. We will show any new request here if your review status changes.
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-slate-800 pt-2">
              {approvedForProvisioning && !isLive ? (
                <Link
                  to="/dashboard/business"
                  className="rounded-2xl bg-[#FFB05A] px-4 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-[#ffc27d]"
                >
                  {currentStepContent?.primaryAction?.label || 'Return to account overview'}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={handleResync}
                  disabled={!canSubmit || resyncing}
                  className="rounded-2xl bg-[#FFB05A] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#ffc27d] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resyncing ? 'Checking review status...' : currentStepContent?.primaryAction?.label || 'Check review status'}
                </button>
              )}

              {!hasAnchorCustomer && gate?.submitted ? (
                <div className="text-xs text-slate-500">Your review reference is still being prepared. Please check again shortly.</div>
              ) : null}
            </div>
          </div>
        )}
      </section>
    </BusinessSetupShell>
  )
}

export default BusinessKyb
