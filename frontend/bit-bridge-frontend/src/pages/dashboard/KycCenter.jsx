// src/pages/dashboard/KycCenter.jsx
import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import PhoneVerifyModal from '../../components/PhoneVerifyModal'
import SelfieCapture from '../../components/Kyc/SelfieCapture'

import {
  IdcardOutlined,
  BankOutlined,
  SafetyCertificateOutlined,
  CreditCardOutlined,
  CheckCircleOutlined,
  LockOutlined,
} from '@ant-design/icons'
import { NavLink, useNavigate } from 'react-router-dom'
import client from '../../api/client'
import { userProfile } from '../../redux/actions/auth'

// Primary use-case → copy
const useCaseConfig = {
  salary: {
    label: 'Salary & payouts',
    badge: 'Business / payroll',
    blurb: 'Receive salary, stipends or recurring payouts into BitBridge.',
  },
  vendor_payments: {
    label: 'Vendor / business payments',
    badge: 'Business payments',
    blurb: 'Pay suppliers, freelancers and small business expenses from one place.',
  },
  taxes: {
    label: 'Taxes & government fees',
    badge: 'Compliance',
    blurb: 'Pay government fees and taxes with clear references and receipts.',
  },
  virtual_cards: {
    label: 'Virtual cards (coming soon)',
    badge: 'Cards & subscriptions',
    blurb: 'Create virtual cards for online payments and subscriptions.',
  },
  airtime_utilities: {
    label: 'Airtime, data & utilities',
    badge: 'Light usage',
    blurb: 'Use BitBridge mainly for top-ups and everyday bills.',
  },

  // 🔹 New mappings for onboarding use-cases
  send_receive: {
    label: 'Send & receive money',
    badge: 'P2P transfers',
    blurb: 'Instant transfers to banks and other BitBridge users.',
  },
  student_life: {
    label: 'Student life & campus spend',
    badge: 'Student',
    blurb:
      'Use BitBridge for data, subscriptions, school-related payments and everyday campus spending.',
  },

  // Legacy / fallback
  bill_payments: {
    label: 'Bill payments & utilities',
    badge: 'Everyday payments',
    blurb: 'Pay electricity, airtime, data and cable TV in one place.',
  },
  salary_vendor: {
    label: 'Salary & vendor payouts',
    badge: 'Business / payroll',
    blurb: 'Pay staff, vendors and contractors with better tracking.',
  },
  p2p_transfers: {
    label: 'Send & receive money',
    badge: 'P2P transfers',
    blurb: 'Instant transfers to banks and other BitBridge users.',
  },
  savings_investments: {
    label: 'Savings & investments',
    badge: 'Wealth',
    blurb: 'Use BitBridge as a home for savings and yield products.',
  },
}

const kycLevelConfig = {
  nil: {
    label: 'Not started',
    description: 'You can pay bills, but transfers and virtual accounts are limited.',
  },
  '': {
    label: 'Not started',
    description: 'You can pay bills, but transfers and virtual accounts are limited.',
  },
  tier_0: {
    label: 'Tier 0 - Basic',
    description: 'Email confirmed. Best for light bill payments and trying things out.',
  },
  tier_1: {
    label: 'Tier 1 - Essentials',
    description: 'Phone verified + basic profile. Unlocks core wallet usage and onboarding.',
  },
  tier_2: {
    label: 'Tier 2 - Full access',
    description:
      'BVN verified + ID upload + address. Unlocks cards, tunnel, transfers and virtual accounts.',
  },
  tier_3: {
    label: 'Tier 3 - Biometric',
    description:
      'Face verification (liveness + BVN face match). Unlocks higher limits and stronger protection.',
  },
}

// ---------- tier helpers ----------
const tierOrder = ['tier_0', 'tier_1', 'tier_2', 'tier_3']
const TIER3_POLL_INTERVAL_MS = 2000
const TIER3_POLL_TIMEOUT_MS = 30000
const TIER3_UI_STATUS = {
  idle: 'idle',
  submitting: 'submitting',
  processing: 'processing',
  verified: 'verified',
  failed: 'failed',
}

const normalizeTierKey = (raw) => {
  const k = (raw ?? 'nil').toString().toLowerCase()
  if (k === 'nil' || k === '') return 'tier_0'
  if (!tierOrder.includes(k)) return 'tier_0'
  return k
}

const tierIndex = (tierKey) => tierOrder.indexOf(tierKey)

const getTierState = (currentTierKey, tierKey) => {
  const currentIdx = tierIndex(currentTierKey)
  const idx = tierIndex(tierKey)

  if (idx < currentIdx) return 'completed'
  if (idx === currentIdx) return 'current'
  return 'locked'
}

const tierCardCopy = {
  tier_0: {
    title: 'Tier 0',
    body: 'Email confirmed. Pay bills and try BitBridge with lower limits.',
    hint: 'Good for light usage',
  },
  tier_1: {
    title: 'Tier 1',
    body: 'Phone verified and profile complete. Preps your account for BVN checks.',
    hint: 'Complete basics',
  },
  tier_2: {
    title: 'Tier 2',
    body: 'BVN verified + ID upload + address. Unlock all services.',
    hint: 'Full access',
  },
  tier_3: {
    title: 'Tier 3',
    body: 'Biometric verification (liveness + BVN face match) for higher limits & stronger protection.',
    hint: 'Higher limits',
  },
}

const normalizeTier3Status = (raw) => {
  const status = (raw ?? '').toString().trim().toLowerCase()
  if (status === 'verified') return 'verified'
  if (status === 'failed' || status === 'rejected') return 'failed'
  if (status === 'pending' || status === 'processing') return 'processing'
  return ''
}

const TierCard = ({ state, title, body, hint, onPrimary, primaryLabel }) => {
  const isCurrent = state === 'current'
  const isCompleted = state === 'completed'
  const isLocked = state === 'locked'

  const containerClass = [
    'min-w-[240px] sm:min-w-0',
    'rounded-xl border p-3 transition',
    isCurrent
      ? 'border-alt bg-slate-950/90 shadow-[0_0_0_1px_rgba(250,204,21,0.25)]'
      : 'border-slate-700/80 bg-slate-950/80',
    isLocked ? 'opacity-80' : '',
  ].join(' ')

  const badgeClass = [
    'shrink-0 inline-flex items-center gap-1',
    'rounded-full px-2.5 py-1',
    'text-[10px] uppercase tracking-[0.16em] font-semibold',
    'border whitespace-nowrap',
    isCurrent
      ? 'bg-alt/15 border-alt/60 text-alt'
      : isCompleted
      ? 'bg-emerald-900/30 border-emerald-600/50 text-emerald-200'
      : 'bg-slate-900 border-slate-700 text-slate-300',
  ].join(' ')

  const badgeText =
    (isCurrent && 'Current') || (isCompleted && 'Completed') || (isLocked && 'Locked')

  const badgeIcon =
    (isCurrent && <SafetyCertificateOutlined />) ||
    (isCompleted && <CheckCircleOutlined />) ||
    (isLocked && <LockOutlined />)

  return (
    <div className={containerClass}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="font-semibold mb-1 text-slate-100 leading-snug whitespace-nowrap">
            {title}
          </p>
          <p className="text-slate-400 text-[11px] leading-snug line-clamp-1">{hint}</p>
        </div>

        <span className={badgeClass}>
          {badgeIcon}
          {badgeText}
        </span>
      </div>

      <p className="text-slate-400 text-[11px] leading-relaxed line-clamp-3 md:line-clamp-none">
        {body}
      </p>

      {isCurrent && typeof onPrimary === 'function' && primaryLabel ? (
        <button
          type="button"
          onClick={onPrimary}
          className="mt-3 inline-flex items-center px-3 py-1.5 rounded-lg bg-alt text-black text-xs font-semibold hover:brightness-110 transition"
        >
          {primaryLabel}
        </button>
      ) : null}
    </div>
  )
}

// Simple modal (no new dependencies; won’t break existing builds)
const InlineModal = ({ open, title, children, onClose }) => {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} role="button" tabIndex={-1} />
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Verification</div>
            <div className="text-lg font-semibold text-slate-100">{title}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 transition"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ---- helper: Tier 3 endpoint fallback (only fallback on 404) ----
async function postTier3Start(payload) {
  const candidates = [
    '/verification/tier3/start',       // correct if baseURL is .../api/v1
    '/api/v1/verification/tier3/start' // safety if baseURL is misconfigured
  ]

  let lastErr = null
  for (const url of candidates) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await client.post(url, payload)
      return res
    } catch (e) {
      lastErr = e
      const status = e?.response?.status
      if (status && status !== 404) throw e
    }
  }

  const base = client?.defaults?.baseURL
  const msg =
    `Tier 3 endpoint not found (404).\n\n` +
    `Tried: ${candidates.join(', ')}\n` +
    (base ? `Axios baseURL: ${base}\n\n` : '\n') +
    `Fix: confirm backend route exists: POST /api/v1/verification/tier3/start`
  const err = new Error(msg)
  err._isTier3NotFound = true
  err._lastErr = lastErr
  throw err
}

const KycCenter = () => {
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth) || {}
  const navigate = useNavigate()

  const primaryUseCase = user?.primary_use_case || 'airtime_utilities'
  const normalizedTierKey = normalizeTierKey(user?.kyc_level)
  const kycInfo = kycLevelConfig[normalizedTierKey] || kycLevelConfig.nil
  const useCaseInfo = useCaseConfig[primaryUseCase] || useCaseConfig.airtime_utilities

  // ✅ Phone verification modal
  const [showPhoneModal, setShowPhoneModal] = React.useState(false)

  const [bvnInput, setBvnInput] = React.useState('')
  const [bvnSubmitting, setBvnSubmitting] = React.useState(false)
  const [bvnResponse, setBvnResponse] = React.useState(null)
  const [bvnError, setBvnError] = React.useState('')
  const [bvnRetryUntil, setBvnRetryUntil] = React.useState(null)
  const [bvnNow, setBvnNow] = React.useState(Date.now())

  // Tier 3 (biometric) UI state
  const [showTier3Modal, setShowTier3Modal] = React.useState(false)
  const [tier3SelfieDataUrl, setTier3SelfieDataUrl] = React.useState(null)
  const [tier3Submitting, setTier3Submitting] = React.useState(false)
  const [tier3Error, setTier3Error] = React.useState('')
  const [tier3Success, setTier3Success] = React.useState('')
  const [tier3CameraError, setTier3CameraError] = React.useState('')
  const [tier3StatusSnapshot, setTier3StatusSnapshot] = React.useState(null)
  const [tier3UiStatus, setTier3UiStatus] = React.useState(TIER3_UI_STATUS.idle)
  const [tier3SubmittedAt, setTier3SubmittedAt] = React.useState(null)
  const [tier3PollExpired, setTier3PollExpired] = React.useState(false)
  const tier3PollRef = React.useRef(null)
  const tier3PollUntilRef = React.useRef(0)

  const phoneVerified =
    user?.phone_verified === true ||
    !!user?.phone_verified_at ||
    !!user?.user_profile?.phone_verified_at

  const userKyc = user?.user_kyc || {}
  const bvnStatus = userKyc?.bvn_status || 'unverified'
  const bvnLast4 = userKyc?.bvn_last4 || ''
  const isBvnVerified = bvnStatus === 'verified'

  const hasTier2 = normalizedTierKey === 'tier_2' || normalizedTierKey === 'tier_3'
  const hasTier3 = normalizedTierKey === 'tier_3'

  const goProfile = () => navigate('/dashboard/profile-account')
  const goVirtualAccounts = () => navigate('/dashboard/virtual-accounts')
  const goWallet = () => navigate('/dashboard/wallet')

  const currentTierPrimary =
    normalizedTierKey === 'tier_0'
      ? { label: 'Open profile', action: goProfile }
      : normalizedTierKey === 'tier_2'
      ? { label: 'Go to virtual accounts', action: goVirtualAccounts }
      : { label: null, action: null }
  const stopTier3Polling = React.useCallback(() => {
    if (tier3PollRef.current) {
      clearInterval(tier3PollRef.current)
      tier3PollRef.current = null
    }
  }, [])

  const resolveTier3UiStatus = React.useCallback((snapshot, submittedAt) => {
    const normalized = normalizeTier3Status(snapshot?.tier3_status)
    if (normalized === 'verified') return TIER3_UI_STATUS.verified
    if (normalized === 'failed') return TIER3_UI_STATUS.failed
    if (normalized === 'processing') return TIER3_UI_STATUS.processing

    if (submittedAt && Date.now() - submittedAt <= TIER3_POLL_TIMEOUT_MS) {
      return TIER3_UI_STATUS.processing
    }

    return TIER3_UI_STATUS.idle
  }, [])

  const fetchTier3Status = React.useCallback(async () => {
    try {
      const res = await client.get('/verification/tier3/status')
      const data = res?.data || null
      setTier3StatusSnapshot(data)
      const nextStatus = resolveTier3UiStatus(data, tier3SubmittedAt)
      setTier3UiStatus((prev) => (prev === TIER3_UI_STATUS.submitting ? prev : nextStatus))
      if (nextStatus === TIER3_UI_STATUS.verified || nextStatus === TIER3_UI_STATUS.failed) {
        stopTier3Polling()
      }
      return data
    } catch (_) {
      return null
    }
  }, [resolveTier3UiStatus, stopTier3Polling, tier3SubmittedAt])

  const startTier3Polling = React.useCallback(() => {
    stopTier3Polling()
    setTier3PollExpired(false)
    tier3PollUntilRef.current = Date.now() + TIER3_POLL_TIMEOUT_MS

    const pollOnce = async () => {
      if (Date.now() > tier3PollUntilRef.current) {
        stopTier3Polling()
        setTier3PollExpired(true)
        return
      }

      const data = await fetchTier3Status()
      const nextStatus = resolveTier3UiStatus(data, tier3SubmittedAt)
      if (nextStatus === TIER3_UI_STATUS.verified || nextStatus === TIER3_UI_STATUS.failed) {
        stopTier3Polling()
      }
    }

    pollOnce()
    tier3PollRef.current = setInterval(pollOnce, TIER3_POLL_INTERVAL_MS)
  }, [fetchTier3Status, resolveTier3UiStatus, stopTier3Polling, tier3SubmittedAt])

  const handleVerifyBvn = async () => {
    const currentStatus = bvnResponse?.status || bvnStatus
    if (currentStatus === 'pending') return
    const normalized = bvnInput.replace(/\D/g, '')
    if (!normalized) {
      setBvnError('Enter your BVN to continue.')
      return
    }
    if (normalized.length !== 11) {
      setBvnError('BVN must be 11 digits.')
      return
    }

    setBvnSubmitting(true)
    setBvnError('')
    setBvnResponse(null)
    setBvnRetryUntil(null)

    try {
      const res = await client.post('/kyc/bvn/verify', { bvn: normalized })
      const payload = res?.data || null
      setBvnResponse(payload)
      if (payload?.retry_after_seconds) {
        setBvnRetryUntil(Date.now() + payload.retry_after_seconds * 1000)
      }
      if (payload?.status === 'verified' || payload?.status === 'pending_review' || payload?.status === 'pending') {
        setBvnInput('')
      }
      await dispatch(userProfile())
    } catch (error) {
      const payload = error?.response?.data || null
      const message =
        payload?.message ||
        payload?.error ||
        'Unable to verify BVN right now.'
      setBvnError(message)
      setBvnResponse(payload)
      if (payload?.retry_after_seconds) {
        setBvnRetryUntil(Date.now() + payload.retry_after_seconds * 1000)
      }
    } finally {
      setBvnSubmitting(false)
    }
  }

  const effectiveBvnStatus = bvnResponse?.status || bvnStatus
  const effectiveLast4 = bvnResponse?.bvn_last4 || bvnLast4
  const effectiveBvnReason = bvnResponse?.reason || userKyc?.bvn_last_result_reason || ''
  const isBvnPending = effectiveBvnStatus === 'pending'
  const isVerifyingBvn = bvnSubmitting
  const nextCheckSeconds = bvnResponse?.next_check_seconds

  const retrySecondsRemaining = bvnRetryUntil
    ? Math.max(0, Math.ceil((bvnRetryUntil - bvnNow) / 1000))
    : 0
  const isRetryBackoff = retrySecondsRemaining > 0
  const bvnIsValid =
    bvnInput.replace(/\D/g, '').length === 11 &&
    !isRetryBackoff &&
    !isBvnVerified &&
    effectiveBvnStatus !== 'locked'

  const bvnStatusLabel =
    effectiveBvnStatus === 'verified'
      ? 'Verified'
      : effectiveBvnStatus === 'pending'
      ? 'Pending'
      : effectiveBvnStatus === 'pending_review'
      ? 'Pending review'
      : effectiveBvnStatus === 'mismatch'
      ? 'Mismatch'
      : effectiveBvnStatus === 'locked'
      ? 'Locked'
      : effectiveBvnStatus === 'failed'
      ? 'Failed'
      : 'Not submitted'

  const bvnStatusClass =
    effectiveBvnStatus === 'verified'
      ? 'text-emerald-300'
      : effectiveBvnStatus === 'pending'
      ? 'text-amber-300'
      : effectiveBvnStatus === 'pending_review'
      ? 'text-amber-300'
      : effectiveBvnStatus === 'mismatch'
      ? 'text-rose-300'
      : effectiveBvnStatus === 'locked'
      ? 'text-rose-300'
      : 'text-slate-400'

  React.useEffect(() => {
    if (!bvnRetryUntil) return
    if (retrySecondsRemaining <= 0) return
    const timer = setInterval(() => setBvnNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [bvnRetryUntil, retrySecondsRemaining])

  const pollBvnStatus = React.useCallback(async () => {
    try {
      const res = await client.get('/kyc/bvn/status')
      const payload = res?.data || null
      if (payload) {
        setBvnResponse(payload)
        if (payload?.status && payload.status !== 'pending') {
          setBvnRetryUntil(null)
        }
      }
    } catch (_) {
      // silent polling failure
    }
  }, [])

  React.useEffect(() => {
    if (effectiveBvnStatus !== 'pending') return
    const intervalMs = 12000
    pollBvnStatus()
    const timer = setInterval(() => {
      pollBvnStatus()
    }, intervalMs)
    return () => clearInterval(timer)
  }, [effectiveBvnStatus, pollBvnStatus])

  const openTier3 = async () => {
    setTier3Error('')
    setTier3Success('')
    setTier3CameraError('')
    setTier3SelfieDataUrl(null)
    setTier3StatusSnapshot(null)
    setTier3UiStatus(TIER3_UI_STATUS.idle)
    setTier3SubmittedAt(null)
    setTier3PollExpired(false)
    stopTier3Polling()
    setShowTier3Modal(true)
    await fetchTier3Status()
  }
  const handleTier3Submit = async () => {
    if (tier3Submitting) return // prevent double-tap enqueue
    setTier3Error('')
    setTier3Success('')
    setTier3UiStatus(TIER3_UI_STATUS.submitting)

    if (!hasTier2) {
      setTier3Error('Complete Tier 2 before upgrading to Tier 3.')
      setTier3UiStatus(TIER3_UI_STATUS.idle)
      return
    }

    if (!isBvnVerified) {
      setTier3Error('Tier 3 requires BVN verification first. Please verify BVN.')
      setTier3UiStatus(TIER3_UI_STATUS.idle)
      return
    }

    if (!tier3SelfieDataUrl) {
      setTier3Error('Please capture a live selfie to continue.')
      setTier3UiStatus(TIER3_UI_STATUS.idle)
      return
    }

    setTier3Submitting(true)
    setTier3SubmittedAt(Date.now())
    setTier3PollExpired(false)
    try {
      const str = String(tier3SelfieDataUrl || '')
      let dataUrl = str.trim()

      if (!dataUrl.startsWith('data:image/')) {
        const base64Only = dataUrl.includes('base64,')
          ? dataUrl.split('base64,')[1]
          : dataUrl.includes(',')
          ? dataUrl.split(',')[1]
          : dataUrl

        dataUrl = `data:image/jpeg;base64,${base64Only}`
      }

      const payload = { image: dataUrl }

      const res = await postTier3Start(payload)

      const message =
        res?.data?.message ||
        res?.data?.detail ||
        'Tier 3 submitted. We are processing your verification now.'

      setTier3Success(message)
      setTier3UiStatus(TIER3_UI_STATUS.processing)
      startTier3Polling()

      await dispatch(userProfile())
      await fetchTier3Status()
    } catch (error) {
      const status = error?.response?.status
      const msg =
        error?._isTier3NotFound
          ? error.message
          : error?.response?.data?.message ||
            error?.response?.data?.error ||
            (status === 404 ? 'Tier 3 endpoint not found on server.' : null) ||
            error?.message ||
            'Unable to complete Tier 3 verification.'
      setTier3Error(msg)
      setTier3UiStatus(TIER3_UI_STATUS.failed)

      await fetchTier3Status()
    } finally {
      setTier3Submitting(false)
    }
  }

  React.useEffect(() => {
    return () => stopTier3Polling()
  }, [stopTier3Polling])

  return (
    <div className="min-h-screen p-4 md:p-8 bg-slate-950 text-slate-100">
      {/* Top header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-1">Verification</p>
          <h1 className="text-2xl md:text-3xl font-semibold mb-1">
            Verify your BitBridge account
          </h1>
          <p className="text-sm text-slate-400 max-w-xl">
            Complete a couple of quick checks to unlock transfers, virtual accounts and higher limits.
          </p>
        </div>

        <div className="inline-flex items-center gap-3 rounded-2xl bg-slate-900/90 border border-slate-700 px-4 py-3 text-xs md:text-sm">
          <SafetyCertificateOutlined className="text-alt text-lg" />
          <div>
            <p className="font-semibold text-slate-100">Current KYC level</p>
            <p className="text-slate-300">{kycInfo.label}</p>
            <p className="text-[11px] text-slate-500">{kycInfo.description}</p>
          </div>
        </div>
      </div>

      {/* Main 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-6">
        {/* LEFT: Overview card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 md:p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-emerald-900/40 border border-emerald-600/60 text-emerald-200 mb-2">
                <BankOutlined className="mr-1" /> {useCaseInfo.badge}
              </p>
              <h2 className="text-lg md:text-xl font-semibold">
                Using BitBridge for {useCaseInfo.label}
              </h2>
              <p className="text-sm text-slate-400 mt-1">{useCaseInfo.blurb}</p>
            </div>
            <span className="hidden md:inline-flex h-10 w-10 rounded-full bg-slate-800 border border-slate-600 items-center justify-center">
              <IdcardOutlined className="text-alt" />
            </span>
          </div>

          <div className="mt-4 space-y-3 text-sm">
            <h3 className="font-semibold text-slate-100">What your level means</h3>
            <p className="text-slate-300">{kycInfo.description}</p>

            {/* Tier ladder */}
            <div className="mt-3">
              <div className="flex gap-3 overflow-x-auto pb-2 md:hidden">
                {tierOrder.map((tKey) => {
                  const state = getTierState(normalizedTierKey, tKey)
                  const copy = tierCardCopy[tKey]
                  const onPrimary = state === 'current' ? currentTierPrimary.action : undefined
                  const primaryLabel = state === 'current' ? currentTierPrimary.label : undefined

                  return (
                    <TierCard
                      key={tKey}
                      state={state}
                      title={copy.title}
                      body={copy.body}
                      hint={copy.hint}
                      onPrimary={onPrimary}
                      primaryLabel={primaryLabel}
                    />
                  )
                })}
              </div>

              <div className="hidden md:grid md:grid-cols-4 gap-3 text-[11px]">
                {tierOrder.map((tKey) => {
                  const state = getTierState(normalizedTierKey, tKey)
                  const copy = tierCardCopy[tKey]
                  const onPrimary = state === 'current' ? currentTierPrimary.action : undefined
                  const primaryLabel = state === 'current' ? currentTierPrimary.label : undefined

                  return (
                    <TierCard
                      key={tKey}
                      state={state}
                      title={copy.title}
                      body={copy.body}
                      hint={copy.hint}
                      onPrimary={onPrimary}
                      primaryLabel={primaryLabel}
                    />
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Next steps */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 md:p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
              <CreditCardOutlined className="text-alt" />
              Next steps to unlock everything
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              You only need <span className="font-semibold text-slate-200">three</span> quick
              steps to reach Tier 2.
            </p>

            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <div className="mt-0.5 h-6 w-6 rounded-full bg-alt text-black flex items-center justify-center text-[11px] font-bold">
                  1
                </div>
                <div>
                  <p className="font-semibold text-slate-100">Confirm your basic details</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Make sure your name and phone number in your profile match your bank records.
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={goProfile}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg bg-alt text-black text-xs font-semibold hover:brightness-110 transition"
                    >
                      Open profile
                    </button>

                    {phoneVerified ? (
                      <span className="inline-flex items-center gap-1 text-emerald-300 text-xs">
                        <CheckCircleOutlined />
                        Phone verified
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowPhoneModal(true)}
                        className="inline-flex items-center px-3 py-1.5 rounded-lg border border-alt text-alt text-xs font-semibold hover:bg-alt/10 transition"
                      >
                        Verify phone number
                      </button>
                    )}
                  </div>
                </div>
              </li>

              <li className="flex gap-3">
                <div className="mt-0.5 h-6 w-6 rounded-full bg-slate-800 text-slate-100 flex items-center justify-center text-[11px] font-bold">
                  2
                </div>
                <div>
                  <p className="font-semibold text-slate-100">Verify your BVN</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Confirm your BVN with our verification partner. We never store your BVN
                    in plain text.
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    Current status: <span className={bvnStatusClass}>{bvnStatusLabel}</span>
                  </p>
                </div>
              </li>

              <li className="flex gap-3">
                <div className="mt-0.5 h-6 w-6 rounded-full bg-slate-800 text-slate-100 flex items-center justify-center text-[11px] font-bold">
                  3
                </div>
                <div>
                  <p className="font-semibold text-slate-100">Upload ID and proof of address</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Add your ID document and proof of address to complete Tier 2.
                  </p>
                  <button
                    type="button"
                    onClick={goProfile}
                    className="mt-2 inline-flex items-center px-3 py-1.5 rounded-lg border border-alt text-alt text-xs font-semibold hover:bg-alt/10 transition"
                  >
                    Open KYC documents
                  </button>
                </div>
              </li>
            </ol>

            {/* Tier 3 prompt */}
            {hasTier2 && !hasTier3 ? (
              <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">
                  Optional upgrade
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-100">Upgrade to Tier 3</div>
                    <div className="text-xs text-slate-400 mt-1">
                      Complete biometric verification (live selfie + face match) to unlock higher limits.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={openTier3}
                    className="shrink-0 inline-flex items-center px-3 py-2 rounded-lg bg-alt text-black text-xs font-semibold hover:brightness-110 transition"
                  >
                    Upgrade
                  </button>
                </div>
              </div>
            ) : null}

            {hasTier3 ? (
              <div className="mt-5 rounded-xl border border-emerald-700/40 bg-emerald-900/20 p-4">
                <div className="flex items-center gap-2 text-emerald-200 font-semibold">
                  <CheckCircleOutlined /> Tier 3 verified
                </div>
                <div className="text-xs text-slate-300 mt-1">
                  Biometric verification completed. You now qualify for higher limits.
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap gap-3 justify-between">
            <NavLink
              to="/dashboard/home"
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-slate-700 text-xs md:text-sm text-slate-200 hover:bg-slate-800/70 transition"
            >
              Back to dashboard
            </NavLink>

            <button
              type="button"
              onClick={hasTier2 ? goVirtualAccounts : goWallet}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-alt text-black text-xs md:text-sm font-semibold hover:brightness-110 transition"
              title={hasTier2 ? 'Go to virtual accounts' : 'Use wallet for now (virtual accounts unlock at Tier 2)'}
            >
              {hasTier2 ? 'Go to virtual accounts' : 'Skip for now - use wallet'}
            </button>
          </div>
        </div>
      </div>

      <section
        id="bvn-verify"
        className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 md:p-6"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-lg md:text-xl font-semibold">Verify BVN</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              BVN verification powers Tier 2. Your BVN is never stored in plain text.
            </p>
          </div>
          <div className="text-xs text-slate-400">
            Status:{' '}
            <span className={['font-semibold', bvnStatusClass].join(' ')}>
              {bvnStatusLabel}
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,0.6fr)] gap-4">
          <div className="space-y-3">
            <label className="block text-xs uppercase tracking-[0.2em] text-slate-500">
              Enter BVN
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={11}
              value={bvnInput}
              onChange={(e) => setBvnInput(e.target.value.replace(/\D/g, '').slice(0, 11))}
              disabled={isBvnPending}
              readOnly={isBvnPending}
              className={[
                'w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-alt',
                isBvnPending ? 'opacity-60 cursor-not-allowed' : '',
              ].join(' ')}
              placeholder="11-digit BVN"
              autoComplete="off"
            />
            {bvnError && <p className="text-xs text-rose-300">{bvnError}</p>}
            {isBvnPending ? (
              <p className="text-xs text-amber-200">
                {nextCheckSeconds
                  ? `Retrying in ${nextCheckSeconds}s.`
                  : "Verification pending. We'll update automatically."}
              </p>
            ) : null}

            {!phoneVerified && !hasTier2 && (
              <div className="rounded-xl border border-amber-700/40 bg-amber-900/20 p-3 text-xs text-amber-200">
                <span>
                  {effectiveBvnStatus === 'verified'
                    ? 'Phone verification is required for Tier 1. Complete it to proceed toward Tier 2.'
                    : 'Verify your phone to complete Tier 1. Tier upgrades require phone verification.'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPhoneModal(true)}
                  className="ml-2 underline text-amber-100 hover:text-amber-50"
                >
                  Verify phone
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleVerifyBvn}
              disabled={
                isBvnPending ||
                isVerifyingBvn ||
                !bvnIsValid
              }
              className={[
                'inline-flex items-center px-4 py-2 rounded-xl bg-alt text-black text-xs font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed',
                isBvnPending ? '' : 'hover:brightness-110',
              ].join(' ')}
            >
              {isBvnPending
                ? 'Pending'
                : isBvnVerified
                ? 'BVN Verified'
                : isVerifyingBvn
                ? 'Verifying...'
                : isRetryBackoff
                ? `Retry in ${retrySecondsRemaining}s`
                : effectiveBvnStatus === 'pending_review'
                ? 'Re-check BVN'
                : 'Confirm BVN'}
            </button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-xs text-slate-300">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-2">
              Verification result
            </p>
            {effectiveBvnStatus === 'verified' && (
              <p className="text-emerald-300 font-semibold">
                BVN verified (****{effectiveLast4}). <span className="text-slate-100">Next:</span>{' '}
                {phoneVerified
                  ? 'complete your address and upload documents to unlock Tier 2.'
                  : 'verify your phone and complete your profile/documents to unlock Tier 2.'}
              </p>
            )}
            {effectiveBvnStatus === 'pending_review' && (
              <p className="text-amber-200">
                Submitted for review. You can re-check BVN if you updated your profile.
              </p>
            )}
            {effectiveBvnStatus === 'pending' && (
              <p className="text-amber-200">
                BVN verification is pending. We'll update automatically once the provider is available.
              </p>
            )}
            {effectiveBvnStatus === 'mismatch' && (
              <p className="text-rose-300">
                BVN details do not match your profile. Check your name and date of birth, then retry.
                <button
                  type="button"
                  onClick={goProfile}
                  className="ml-2 underline text-rose-200 hover:text-rose-100"
                >
                  Update profile
                </button>
              </p>
            )}
            {effectiveBvnStatus === 'locked' && (
              <p className="text-rose-300">
                Verification locked. Try again later or contact support.
              </p>
            )}
            {effectiveBvnStatus === 'failed' && (
              <p className="text-rose-300">
                {isRetryBackoff
                  ? `Provider unavailable. Retry in ${retrySecondsRemaining}s.`
                  : 'Provider unavailable. Please retry in a few minutes.'}
              </p>
            )}
            {effectiveBvnStatus === 'unverified' && <p>Enter your BVN to begin verification.</p>}
            {bvnResponse?.cached === true && bvnResponse?.message && (
              <p className="text-slate-300 mt-2">{bvnResponse.message}</p>
            )}
          </div>
        </div>
      </section>

      {/* Tier 3 modal */}
      <InlineModal
        open={showTier3Modal}
        title="Tier 3 - Biometric Verification"
        onClose={() => {
          if (!tier3Submitting) {
            stopTier3Polling()
            setShowTier3Modal(false)
          }
        }}
      >
        <div className="text-xs text-slate-300">
          Capture a live selfie. We will run a liveness check and match your face against your BVN.
        </div>

        {!hasTier2 ? (
          <div className="mt-4 rounded-xl border border-rose-700/40 bg-rose-900/20 p-3 text-xs text-rose-200">
            Complete Tier 2 before upgrading to Tier 3.
          </div>
        ) : null}

        {tier3StatusSnapshot?.tier3_status ? (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-300">
            <div>
              Current Tier 3 status:{' '}
              <span className="font-semibold text-slate-100">{tier3StatusSnapshot.tier3_status}</span>
            </div>
            {tier3StatusSnapshot?.tier3_error ? (
              <div className="mt-1 text-[11px] text-slate-400">
                Last error: <span className="text-rose-200">{tier3StatusSnapshot.tier3_error}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {isBvnVerified ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-300">
              BVN status: <span className="text-emerald-300 font-semibold">Verified</span> (****{effectiveLast4})
              <div className="text-[11px] text-slate-500 mt-1">
                We’ll reuse your verified BVN evidence on file.
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-rose-700/40 bg-rose-900/20 p-3 text-xs text-rose-200">
              Tier 3 requires BVN verification first. Please verify BVN under “Verify BVN” before continuing.
            </div>
          )}

          <SelfieCapture
            value={tier3SelfieDataUrl}
            onChange={(dataUrl) => setTier3SelfieDataUrl(dataUrl)}
            onError={(msg) => setTier3CameraError(msg || '')}
            title="Live selfie"
            hint="Use good lighting. Remove cap/face covering. Keep face centered and hold still."
          />

          {tier3CameraError ? (
            <div className="rounded-xl border border-rose-700/40 bg-rose-900/20 p-3 text-xs text-rose-200">
              {tier3CameraError}
            </div>
          ) : null}

          {tier3Error ? (
            <div className="rounded-xl border border-rose-700/40 bg-rose-900/20 p-3 text-xs text-rose-200 whitespace-pre-wrap">
              {tier3Error}
            </div>
          ) : null}

          {tier3Success ? (
            <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/20 p-3 text-xs text-emerald-200">
              {tier3Success}
            </div>
          ) : null}

          {tier3UiStatus === TIER3_UI_STATUS.processing ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-300">
              Verification in progress. This usually takes a few seconds.
              {tier3PollExpired ? (
                <div className="mt-1 text-[11px] text-slate-500">
                  Check back soon. Use refresh to check status.
                </div>
              ) : null}
            </div>
          ) : null}

          {tier3UiStatus === TIER3_UI_STATUS.verified ? (
            <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/20 p-3 text-xs text-emerald-200">
              Tier 3 Verified
            </div>
          ) : null}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                stopTier3Polling()
                setShowTier3Modal(false)
              }}
              disabled={tier3Submitting}
              className="inline-flex items-center px-4 py-2 rounded-xl border border-slate-700 bg-slate-900/60 text-xs text-slate-200 hover:bg-slate-800 transition disabled:opacity-60"
            >
              Cancel
            </button>

            {tier3UiStatus === TIER3_UI_STATUS.processing ? (
              <>
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center px-4 py-2 rounded-xl border border-slate-700 bg-slate-900/60 text-xs text-slate-300 cursor-not-allowed"
                >
                  Verification in progress
                </button>
                <button
                  type="button"
                  onClick={fetchTier3Status}
                  className="inline-flex items-center px-4 py-2 rounded-xl border border-slate-700 bg-slate-900/60 text-xs text-slate-200 hover:bg-slate-800 transition"
                >
                  Refresh status
                </button>
              </>
            ) : tier3UiStatus === TIER3_UI_STATUS.verified ? null : (
              <button
                type="button"
                onClick={handleTier3Submit}
                disabled={tier3Submitting || !hasTier2 || !isBvnVerified}
                className="inline-flex items-center px-4 py-2 rounded-xl bg-alt text-black text-xs font-semibold hover:brightness-110 transition disabled:opacity-60"
                title={!isBvnVerified ? 'Verify BVN first' : undefined}
              >
                {tier3Submitting
                  ? 'Verifying...'
                  : tier3UiStatus === TIER3_UI_STATUS.failed
                  ? 'Retry verification'
                  : 'Verify & upgrade'}
              </button>
            )}
          </div>

          <div className="text-[11px] text-slate-500 pt-2">
            Note: We do not store your selfie permanently. We store minimal verification evidence (reference + timestamp).
          </div>
        </div>
      </InlineModal>

      <PhoneVerifyModal
        open={showPhoneModal}
        onClose={() => setShowPhoneModal(false)}
        defaultPhone={user?.user_profile?.phone_number}
      />
    </div>
  )
}

export default KycCenter
