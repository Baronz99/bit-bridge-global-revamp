import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import {
  BankOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  SafetyOutlined,
  UserOutlined,
} from '@ant-design/icons'

import { getServiceAvailability } from '../../api/home'
import { getBvnStatus, getTier3Status } from '../../api/kyc'
import { getBusinessKyb } from '../../api/business'
import useSelectedBusiness from '../../hooks/useSelectedBusiness'

const darkCard = 'border-slate-800/80 bg-slate-950/90 text-slate-50 shadow-[0_24px_80px_rgba(15,23,42,0.28)]'
const lightCard = 'border-slate-200 bg-white text-slate-900 shadow-[0_24px_80px_rgba(15,23,42,0.08)]'

const toneMap = {
  operational: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  degraded: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  outage: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
  unknown: 'border-slate-500/30 bg-slate-500/10 text-slate-200',
}

const statusLabelMap = {
  operational: 'Operational',
  degraded: 'Degraded',
  outage: 'Unavailable',
  unknown: 'Status unavailable',
}

const formatDate = (value) => {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return date.toLocaleString()
}

const formatLabel = (value) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())

const joinParts = (parts) => parts.map((part) => String(part || '').trim()).filter(Boolean).join(' · ')

const normalizeStatus = (value) => String(value || '').trim().toLowerCase()

const statusTone = (value) => toneMap[normalizeStatus(value)] || toneMap.unknown

const statusLabel = (value) => statusLabelMap[normalizeStatus(value)] || formatLabel(value)

const clampList = (items, limit = 3) => (Array.isArray(items) ? items.slice(0, limit) : [])

const SectionCard = ({ title, subtitle, icon: Icon, children, action, className = '' }) => (
  <section
    className={`rounded-[28px] border p-5 md:p-6 ${className}`}
  >
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-800/70 bg-black/20">
            <Icon className="text-lg text-alt" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg md:text-xl font-semibold leading-tight">{title}</h2>
            {subtitle ? (
              <p className="mt-1 text-sm leading-6 text-slate-400">{subtitle}</p>
            ) : null}
          </div>
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>

    <div className="mt-5">{children}</div>
  </section>
)

const StatePill = ({ value }) => {
  const state = normalizeStatus(value)
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone(state)}`}>
      {state === 'operational' ? <CheckCircleOutlined /> : null}
      {state === 'degraded' ? <ClockCircleOutlined /> : null}
      {state === 'outage' ? <ExclamationCircleOutlined /> : null}
      {statusLabel(state)}
    </span>
  )
}

const InfoRow = ({ label, value, hint, valueClassName = '' }) => (
  <div className="rounded-2xl border border-slate-800/70 bg-black/20 px-4 py-3">
    <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">{label}</div>
    <div className={`mt-2 text-sm font-semibold ${valueClassName}`}>{value}</div>
    {hint ? <div className="mt-1 text-xs leading-5 text-slate-400">{hint}</div> : null}
  </div>
)

const EmptyState = ({ title, description, action }) => (
  <div className="rounded-2xl border border-dashed border-slate-700/80 bg-black/10 p-4">
    <div className="text-sm font-semibold text-slate-100">{title}</div>
    <div className="mt-1 text-sm leading-6 text-slate-400">{description}</div>
    {action ? <div className="mt-3">{action}</div> : null}
  </div>
)

const ErrorState = ({ message, onRetry }) => (
  <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-100">
    <div className="flex items-start gap-3">
      <ExclamationCircleOutlined className="mt-1 text-rose-200" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">Unable to load this section</div>
        <div className="mt-1 text-sm leading-6 text-rose-100/90">
          {message || 'Please retry in a moment.'}
        </div>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-rose-300/30 bg-white/10 px-3 py-2 text-xs font-semibold text-rose-50 hover:bg-white/15"
          >
            <ReloadOutlined />
            Retry
          </button>
        ) : null}
      </div>
    </div>
  </div>
)

const SkeletonLine = ({ className = 'w-full' }) => (
  <div className={`animate-pulse rounded-full bg-slate-800/80 ${className}`} />
)

const HeroButton = ({ children, onClick, variant = 'primary' }) => {
  const base = 'inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition'
  const tone =
    variant === 'secondary'
      ? 'border border-slate-700 bg-transparent text-slate-100 hover:bg-white/5'
      : 'bg-alt text-black hover:brightness-110'

  return (
    <button type="button" onClick={onClick} className={`${base} ${tone}`}>
      {children}
    </button>
  )
}

const AssistanceCenter = () => {
  const navigate = useNavigate()
  const { ownerMode, businessEntities, selectedCircleId, circleEntities } = useSelector((state) => state.app || {})
  const user = useSelector((state) => state.auth?.user || null)
  const { themeMode } = useSelector((state) => state.app || {})
  const { selectedBusiness } = useSelectedBusiness()

  const isDark = String(themeMode || 'dark').toLowerCase() !== 'light'
  const cardClass = isDark ? darkCard : lightCard
  const mutedText = isDark ? 'text-slate-400' : 'text-slate-600'
  const borderClass = isDark ? 'border-slate-800/70' : 'border-slate-200'
  const sectionBg = isDark ? 'bg-black/20' : 'bg-slate-50'

  const activeCircle = useMemo(
    () => circleEntities?.find((circle) => String(circle?.id) === String(selectedCircleId || '')) || null,
    [circleEntities, selectedCircleId]
  )

  const activeBusiness = useMemo(() => {
    if (ownerMode === 'business' && selectedBusiness) return selectedBusiness
    if (Array.isArray(businessEntities) && businessEntities.length === 1) return businessEntities[0]
    return null
  }, [businessEntities, ownerMode, selectedBusiness])

  const hasBusinessProfile = Array.isArray(businessEntities) && businessEntities.length > 0

  const [serviceLoading, setServiceLoading] = useState(true)
  const [serviceError, setServiceError] = useState('')
  const [serviceSnapshot, setServiceSnapshot] = useState(null)

  const [verificationLoading, setVerificationLoading] = useState(true)
  const [verificationError, setVerificationError] = useState('')
  const [bvnSnapshot, setBvnSnapshot] = useState(null)
  const [tier3Snapshot, setTier3Snapshot] = useState(null)
  const [businessSnapshot, setBusinessSnapshot] = useState(null)

  const accountDisplayName =
    user?.user_profile?.full_name ||
    [user?.user_profile?.first_name, user?.user_profile?.last_name].filter(Boolean).join(' ') ||
    user?.email ||
    'Member'
  const securityLocked = Boolean(user?.security_lock?.active || user?.security_lock?.security_locked)
  const kycLabel = String(user?.kyc_level || 'unverified').replace(/_/g, ' ').toUpperCase()

  const accountSummary = useMemo(() => {
    if (ownerMode === 'business' && activeBusiness) {
      return {
        mode: 'Business',
        name: activeBusiness?.businessName || activeBusiness?.name || 'Business workspace',
        route: '/dashboard/business/kyb',
      }
    }

    if (ownerMode === 'business') {
      return {
        mode: 'Business',
        name: 'Business workspace',
        route: '/dashboard/business',
      }
    }

    if (ownerMode === 'circle' && activeCircle) {
      return {
        mode: 'Circle',
        name: activeCircle?.name || activeCircle?.title || 'Circle workspace',
        route: `/dashboard/shared-groups/${selectedCircleId || activeCircle?.id}`,
      }
    }

    return {
      mode: 'Personal',
      name: 'Personal wallet',
      route: '/dashboard/kyc',
    }
  }, [activeBusiness, activeCircle, ownerMode, selectedCircleId])

  const heroAction = () => {
    navigate(accountSummary.route)
  }

  const reloadServiceStatus = useCallback(async () => {
    setServiceLoading(true)
    setServiceError('')
    try {
      const response = await getServiceAvailability()
      const payload = response?.data?.data || response?.data || null
      setServiceSnapshot(payload)
    } catch (error) {
      setServiceError(error?.response?.data?.message || 'Service status is unavailable right now.')
      setServiceSnapshot(null)
    } finally {
      setServiceLoading(false)
    }
  }, [])

  const reloadVerificationStatus = useCallback(async () => {
    setVerificationLoading(true)
    setVerificationError('')
    try {
      const [bvnRes, tier3Res, businessRes] = await Promise.allSettled([
        getBvnStatus(),
        getTier3Status(),
        activeBusiness ? getBusinessKyb(activeBusiness.id) : Promise.resolve(null),
      ])

      if (bvnRes.status === 'fulfilled') {
        setBvnSnapshot(bvnRes.value?.data || null)
      } else {
        setBvnSnapshot(null)
      }

      if (tier3Res.status === 'fulfilled') {
        setTier3Snapshot(tier3Res.value?.data || null)
      } else {
        setTier3Snapshot(null)
      }

      if (businessRes.status === 'fulfilled') {
        const payload = businessRes.value?.data?.data || businessRes.value?.data || null
        setBusinessSnapshot(payload)
      } else {
        setBusinessSnapshot(null)
      }

      const allMissing =
        (bvnRes.status !== 'fulfilled' || !bvnRes.value) &&
        (tier3Res.status !== 'fulfilled' || !tier3Res.value) &&
        (activeBusiness ? businessRes.status !== 'fulfilled' || !businessRes.value : false)

      if (allMissing) {
        throw new Error('Verification status is unavailable right now.')
      }
    } catch (error) {
      setVerificationError(error?.response?.data?.message || error?.message || 'Verification status is unavailable right now.')
    } finally {
      setVerificationLoading(false)
    }
  }, [activeBusiness])

  useEffect(() => {
    void reloadServiceStatus()
  }, [reloadServiceStatus])

  useEffect(() => {
    void reloadVerificationStatus()
  }, [reloadVerificationStatus])

  const serviceRows = useMemo(
    () => clampList(serviceSnapshot?.services || serviceSnapshot?.rows || [], 6),
    [serviceSnapshot]
  )

  const bvnStatus = normalizeStatus(bvnSnapshot?.status || bvnSnapshot?.bvn_status)
  const tier3Status = normalizeStatus(tier3Snapshot?.tier3_status || tier3Snapshot?.status)
  const businessStatus = normalizeStatus(
    businessSnapshot?.business_entity?.status ||
      businessSnapshot?.business_entity?.verification_status ||
      businessSnapshot?.business_entity?.kyb_status ||
      businessSnapshot?.provider?.anchor_kyb_status ||
      businessSnapshot?.status
  )

  const personalNotes = [
    bvnSnapshot?.display?.message || bvnSnapshot?.reason || bvnSnapshot?.message,
    tier3Snapshot?.tier3_error || tier3Snapshot?.message,
  ]
    .map((item) => String(item || '').trim())
    .filter(Boolean)

  const businessReadiness = businessSnapshot?.readiness || null
  const missingDocuments = Array.isArray(businessReadiness?.missing_document_kinds)
    ? businessReadiness.missing_document_kinds
    : []
  const missingSignatoryRequirements = Array.isArray(businessReadiness?.missing_signatory_requirements)
    ? businessReadiness.missing_signatory_requirements
    : []
  const businessProviderNote =
    businessSnapshot?.provider?.verification_note ||
    businessSnapshot?.provider?.message ||
    businessSnapshot?.provider?.status_message ||
    businessReadiness?.note ||
    businessReadiness?.message

  return (
    <div className={`min-h-[calc(100vh-110px)] px-4 py-5 md:px-6 lg:px-8 ${isDark ? 'text-slate-50' : 'text-slate-900'}`}>
      <div className={`rounded-[32px] border ${borderClass} ${isDark ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950' : 'bg-white'} p-5 md:p-7`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-alt/30 bg-alt/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-alt">
              <SafetyOutlined />
              Assistance Center
            </div>
            <h1 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight">Check your account health in one place.</h1>
            <p className={`mt-3 max-w-2xl text-sm md:text-base leading-7 ${mutedText}`}>
              View service status, verification state, and the current health of your workspace without leaving BitBridge.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <HeroButton onClick={heroAction}>Check my account</HeroButton>
            <HeroButton variant="secondary" onClick={reloadVerificationStatus}>
              Refresh status
            </HeroButton>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <SectionCard
          title="Account Health"
          subtitle="Your current workspace, security posture, and identity tier."
          icon={UserOutlined}
          className={`${cardClass} ${sectionBg} ${borderClass}`}
          action={
            <button
              type="button"
              onClick={heroAction}
              className="inline-flex items-center gap-2 rounded-2xl border border-alt/30 bg-alt/10 px-3 py-2 text-xs font-semibold text-alt hover:bg-alt/15"
            >
              Open workspace
            </button>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <InfoRow label="Signed in as" value={accountDisplayName} hint={user?.email || 'Account identity'} valueClassName={isDark ? 'text-white' : 'text-slate-900'} />
            <InfoRow label="Workspace" value={joinParts([accountSummary.mode, accountSummary.name])} hint={activeBusiness ? 'Business profile available' : 'Personal workspace'} valueClassName={isDark ? 'text-white' : 'text-slate-900'} />
            <InfoRow label="Protection" value={securityLocked ? 'Security lock active' : 'Ready'} hint={`KYC: ${kycLabel}`} valueClassName={securityLocked ? 'text-amber-200' : 'text-emerald-200'} />
          </div>
          {hasBusinessProfile && !activeBusiness ? (
            <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              You have one or more business profiles. Switch to business mode to view the corresponding KYB status.
            </div>
          ) : null}
          {activeCircle && ownerMode === 'circle' ? (
            <div className="mt-4 rounded-2xl border border-slate-700/70 bg-black/20 px-4 py-3 text-sm text-slate-300">
              Active circle: <span className="font-semibold text-slate-100">{activeCircle?.name || activeCircle?.title || 'Circle workspace'}</span>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          title="Service Status"
          subtitle="Operational status for the core services BitBridge depends on."
          icon={BankOutlined}
          className={`${cardClass} ${sectionBg} ${borderClass}`}
          action={
            <button
              type="button"
              onClick={reloadServiceStatus}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-700/70 bg-black/20 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/5"
            >
              <ReloadOutlined />
              Refresh
            </button>
          }
        >
          {serviceLoading ? (
            <div className="space-y-3">
              <SkeletonLine className="h-5 w-40" />
              <div className="grid gap-3 md:grid-cols-2">
                <SkeletonLine className="h-24 w-full rounded-2xl" />
                <SkeletonLine className="h-24 w-full rounded-2xl" />
              </div>
            </div>
          ) : serviceError ? (
            <ErrorState message={serviceError} onRetry={reloadServiceStatus} />
          ) : serviceRows.length ? (
            <div className="space-y-3">
              <div className={`flex items-center justify-between rounded-2xl border ${borderClass} px-4 py-3`}>
                <div>
                  <div className={`text-[10px] uppercase tracking-[0.22em] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Last updated</div>
                  <div className={`mt-1 text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    {formatDate(serviceSnapshot?.generated_at || serviceSnapshot?.updated_at)}
                  </div>
                </div>
                <div className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${isDark ? 'border-slate-700 bg-black/20 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                  {serviceRows.length} service{serviceRows.length === 1 ? '' : 's'}
                </div>
              </div>
              <div className="grid gap-3">
                {serviceRows.map((service, index) => (
                  <div
                    key={service?.key || service?.label || index}
                    className={`rounded-2xl border ${borderClass} px-4 py-3`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                          {service?.label || service?.key || 'Service'}
                        </div>
                        <div className={`mt-1 text-sm leading-6 ${mutedText}`}>
                          {service?.advice?.message || service?.metrics?.success_rate || service?.metrics?.p95_latency_ms
                            ? joinParts([
                                service?.advice?.message,
                                service?.metrics?.success_rate ? `${Math.round(Number(service.metrics.success_rate) * 100)}% success` : '',
                                service?.metrics?.p95_latency_ms ? `P95 ${service.metrics.p95_latency_ms} ms` : '',
                              ])
                            : 'Status delivered by the live service availability feed.'}
                        </div>
                      </div>
                      <StatePill value={service?.state} />
                    </div>
                    {service?.last_updated_at ? (
                      <div className={`mt-2 text-xs ${mutedText}`}>Updated {formatDate(service.last_updated_at)}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              title="No live service status available."
              description="BitBridge could not return a service snapshot. Retry to refresh the live feed."
              action={
                <button
                  type="button"
                  onClick={reloadServiceStatus}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-700/70 bg-black/20 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/5"
                >
                  <ReloadOutlined />
                  Retry
                </button>
              }
            />
          )}
        </SectionCard>
      </div>

      <div className="mt-5">
        <SectionCard
          title="Verification Status"
          subtitle="Personal KYC and business KYB status, plus the next thing that needs attention."
          icon={SafetyOutlined}
          className={`${cardClass} ${sectionBg} ${borderClass}`}
          action={
            <button
              type="button"
              onClick={reloadVerificationStatus}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-700/70 bg-black/20 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/5"
            >
              <ReloadOutlined />
              Refresh
            </button>
          }
        >
          {verificationLoading ? (
            <div className="space-y-3">
              <SkeletonLine className="h-5 w-48" />
              <div className="grid gap-3 md:grid-cols-2">
                <SkeletonLine className="h-28 w-full rounded-2xl" />
                <SkeletonLine className="h-28 w-full rounded-2xl" />
              </div>
            </div>
          ) : verificationError && !bvnSnapshot && !tier3Snapshot && !businessSnapshot ? (
            <ErrorState message={verificationError} onRetry={reloadVerificationStatus} />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              <div className={`rounded-2xl border ${borderClass} p-4`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className={`text-[10px] uppercase tracking-[0.22em] ${mutedText}`}>Personal verification</div>
                    <div className={`mt-1 text-base font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>KYC / BVN / Tier 3</div>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${statusTone(bvnStatus || tier3Status || 'unknown')}`}>
                    {bvnStatus === 'verified' || tier3Status === 'verified'
                      ? 'Verified'
                      : bvnStatus === 'failed' || tier3Status === 'failed'
                      ? 'Needs attention'
                      : 'In progress'}
                  </span>
                </div>

                <div className="mt-4 grid gap-3">
                  <InfoRow
                    label="BVN"
                    value={statusLabel(bvnStatus || 'unknown')}
                    hint={joinParts(personalNotes) || 'No BVN issue reported.'}
                    valueClassName={bvnStatus === 'verified' ? 'text-emerald-200' : bvnStatus === 'failed' ? 'text-rose-200' : 'text-amber-200'}
                  />
                  <InfoRow
                    label="Tier 3"
                    value={statusLabel(tier3Status || 'unknown')}
                    hint={
                      clampList(tier3Snapshot?.requirements?.next_steps || tier3Snapshot?.requirements?.missing, 2).join(' · ') ||
                      'Biometric verification status will appear here when available.'
                    }
                    valueClassName={tier3Status === 'verified' ? 'text-emerald-200' : tier3Status === 'failed' ? 'text-rose-200' : 'text-amber-200'}
                  />
                </div>
              </div>

              <div className={`rounded-2xl border ${borderClass} p-4`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className={`text-[10px] uppercase tracking-[0.22em] ${mutedText}`}>Business verification</div>
                    <div className={`mt-1 text-base font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Business KYB</div>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${statusTone(businessStatus || 'unknown')}`}>
                    {businessStatus ? statusLabel(businessStatus) : 'Not available'}
                  </span>
                </div>

                {activeBusiness ? (
                  <div className="mt-4 grid gap-3">
                    <InfoRow
                      label="Business profile"
                      value={activeBusiness?.businessName || activeBusiness?.name || 'Business profile'}
                      hint={activeBusiness?.status ? `Local status: ${formatLabel(activeBusiness.status)}` : 'Business profile loaded from your account.'}
                      valueClassName={isDark ? 'text-white' : 'text-slate-900'}
                    />
                    <InfoRow
                      label="Provider status"
                      value={businessSnapshot?.provider?.anchor_kyb_status || businessSnapshot?.provider?.status || 'Not available'}
                      hint={
                        businessProviderNote ||
                        (businessSnapshot?.readiness?.submitted ? 'Submitted for verification review.' : 'Status will update when provider feedback arrives.')
                      }
                      valueClassName={
                        normalizeStatus(businessSnapshot?.provider?.anchor_kyb_status || businessSnapshot?.provider?.status) === 'approved'
                          ? 'text-emerald-200'
                          : normalizeStatus(businessSnapshot?.provider?.anchor_kyb_status || businessSnapshot?.provider?.status) === 'failed'
                          ? 'text-rose-200'
                          : 'text-amber-200'
                      }
                    />
                    <InfoRow
                      label="Missing items"
                      value={
                        missingDocuments.length || missingSignatoryRequirements.length
                          ? joinParts([
                              missingDocuments.length ? `${missingDocuments.length} document${missingDocuments.length === 1 ? '' : 's'}` : '',
                              missingSignatoryRequirements.length
                                ? `${missingSignatoryRequirements.length} signatory requirement${missingSignatoryRequirements.length === 1 ? '' : 's'}`
                                : '',
                            ])
                          : 'No missing items reported'
                      }
                      hint={
                        clampList(
                          [
                            ...missingDocuments.map((item) => formatLabel(item)),
                            ...missingSignatoryRequirements.map((item) => formatLabel(item)),
                          ],
                          3
                        ).join(' · ') || 'BitBridge has not reported any open KYB requirements.'
                      }
                      valueClassName={
                        missingDocuments.length || missingSignatoryRequirements.length ? 'text-amber-200' : 'text-emerald-200'
                      }
                    />
                  </div>
                ) : hasBusinessProfile ? (
                  <EmptyState
                    title="Switch to business mode to view KYB."
                    description="A business profile exists, but this screen is not currently attached to the active business workspace."
                    action={
                      <button
                        type="button"
                        onClick={() => navigate('/dashboard/business')}
                        className="inline-flex items-center gap-2 rounded-2xl border border-alt/30 bg-alt/10 px-3 py-2 text-xs font-semibold text-alt hover:bg-alt/15"
                      >
                        Open business workspace
                      </button>
                    }
                  />
                ) : (
                  <EmptyState
                    title="No business profile available."
                    description="Business verification will appear here once a business workspace is active."
                  />
                )}
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}

export default AssistanceCenter
