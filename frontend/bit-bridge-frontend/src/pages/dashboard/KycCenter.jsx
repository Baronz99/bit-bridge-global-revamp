// src/pages/dashboard/KycCenter.jsx
import React from 'react'
import { useSelector } from 'react-redux'
import PhoneVerifyModal from '../../components/PhoneVerifyModal'

import {
  IdcardOutlined,
  BankOutlined,
  SafetyCertificateOutlined,
  CreditCardOutlined,
  CheckCircleOutlined,
  LockOutlined,
} from '@ant-design/icons'
import { NavLink, useNavigate } from 'react-router-dom'

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
    label: 'Tier 0 – Basic',
    description: 'Email confirmed. Best for light bill payments and trying things out.',
  },
  tier_1: {
    label: 'Tier 1 – Personal',
    description: 'ID + BVN/NIN verified. Unlocks transfers and virtual accounts.',
  },
  tier_2: {
    label: 'Tier 2 – Business / Pro',
    description: 'For salary/vendor payouts and higher limits with extra checks.',
  },
}

// ---------- tier helpers ----------
const tierOrder = ['tier_0', 'tier_1', 'tier_2']

const normalizeTierKey = (raw) => {
  const k = (raw ?? 'nil').toString()
  if (k === 'nil' || k === '') return 'tier_0' // treat “not started” as Tier 0 for UI consistency
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
    body: 'Personal ID + BVN / NIN. Unlock local transfers & virtual accounts.',
    hint: 'Unlock transfers',
  },
  tier_2: {
    title: 'Tier 2',
    body: 'Business / pro. For salary & vendor payouts and higher flows.',
    hint: 'Higher limits',
  },
}

const TierCard = ({ state, title, body, hint, onPrimary, primaryLabel }) => {
  const isCurrent = state === 'current'
  const isCompleted = state === 'completed'
  const isLocked = state === 'locked'

  const containerClass = [
    'rounded-xl border p-3 transition',
    isCurrent
      ? 'border-alt bg-slate-950/90 shadow-[0_0_0_1px_rgba(250,204,21,0.25)]'
      : 'border-slate-700/80 bg-slate-950/80',
    isLocked ? 'opacity-80' : '',
  ].join(' ')

  const badgeClass = [
    'inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[10px] uppercase tracking-[0.16em] border',
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
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="font-semibold mb-1 text-slate-100">{title}</p>
          <p className="text-slate-400 text-[11px]">{hint}</p>
        </div>

        <span className={badgeClass}>
          {badgeIcon}
          {badgeText}
        </span>
      </div>

      <p className="text-slate-400 text-[11px] leading-relaxed">{body}</p>

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

const KycCenter = () => {
  const { user } = useSelector((state) => state.auth) || {}
  const navigate = useNavigate()

  const primaryUseCase = user?.primary_use_case || 'airtime_utilities'

  const normalizedTierKey = normalizeTierKey(user?.kyc_level)
  const rawKycLevelKey = (user?.kyc_level || 'nil').toString()
  const kycInfo = kycLevelConfig[rawKycLevelKey] || kycLevelConfig.nil

  const useCaseInfo = useCaseConfig[primaryUseCase] || useCaseConfig.airtime_utilities

  // ✅ Phone verification modal
  const [showPhoneModal, setShowPhoneModal] = React.useState(false)

  // Supports either top-level fields (recommended) or nested profile
  const phoneVerified =
    user?.phone_verified === true ||
    !!user?.phone_verified_at ||
    !!user?.user_profile?.phone_verified_at

  const hasTier1OrMore = ['tier_1', 'tier_2'].includes(normalizedTierKey)

  // “next action” routing helpers
  const goProfile = () => navigate('/dashboard/profile-account')
  const goVirtualAccounts = () => navigate('/dashboard/virtual-account')
  const goWallet = () => navigate('/dashboard/wallet') // if you don’t have this route, change to /dashboard/home

  // Decide what button to show inside the CURRENT tier card
  const currentTierPrimary =
    normalizedTierKey === 'tier_0'
      ? { label: 'Open profile', action: goProfile }
      : normalizedTierKey === 'tier_1'
        ? { label: 'Go to virtual accounts', action: goVirtualAccounts }
        : { label: 'Review profile', action: goProfile }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-slate-950 text-slate-100">
      {/* Top header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-1">
            Verification
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold mb-1">
            Verify your BitBridge account
          </h1>
          <p className="text-sm text-slate-400 max-w-xl">
            Complete a couple of quick checks to unlock transfers, virtual accounts and
            higher limits.
          </p>
        </div>

        <div className="inline-flex items-center gap-3 rounded-2xl bg-slate-900/90 border border-slate-700 px-4 py-3 text-xs md:text-sm">
          <SafetyCertificateOutlined className="text-alt text-lg" />
          <div>
            <p className="font-semibold text-slate-100">Current KYC level</p>
            <p className="text-slate-300">{kycInfo.label}</p>
            <p className="text-[11px] text-slate-500">
              Tier 1+ unlocks virtual accounts via Anchor / Moniepoint.
            </p>
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

            {/* Tier ladder (stateful) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] mt-3">
              {tierOrder.map((tKey) => {
                const state = getTierState(normalizedTierKey, tKey)
                const copy = tierCardCopy[tKey]

                // Only show a CTA inside the CURRENT tier card, to keep UI clean
                const onPrimary =
                  state === 'current' ? currentTierPrimary.action : undefined
                const primaryLabel =
                  state === 'current' ? currentTierPrimary.label : undefined

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

        {/* RIGHT: Next steps card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 md:p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
              <CreditCardOutlined className="text-alt" />
              Next steps to unlock everything
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              You only need <span className="font-semibold text-slate-200">two</span> quick
              steps to reach Tier 1.
            </p>

            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <div className="mt-0.5 h-6 w-6 rounded-full bg-alt text-black flex items-center justify-center text-[11px] font-bold">
                  1
                </div>
                <div>
                  <p className="font-semibold text-slate-100">
                    Confirm your basic details
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Make sure your name and phone number in your profile match your bank
                    records.
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
                  <p className="font-semibold text-slate-100">Add your ID details</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Choose an ID type (BVN / NIN / passport etc.) in your profile. As file
                    upload goes live, you’ll be able to upload the document and selfie.
                  </p>
                </div>
              </li>

              <li className="flex gap-3">
                <div className="mt-0.5 h-6 w-6 rounded-full bg-slate-800 text-slate-100 flex items-center justify-center text-[11px] font-bold">
                  3
                </div>
                <div>
                  <p className="font-semibold text-slate-100">
                    Generate a virtual account
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Once you are Tier 1, you can create a virtual bank account number so
                    incoming transfers go straight into your BitBridge wallet.
                  </p>

                  {hasTier1OrMore ? (
                    <button
                      type="button"
                      onClick={goVirtualAccounts}
                      className="mt-2 inline-flex items-center px-3 py-1.5 rounded-lg border border-alt text-alt text-xs font-semibold hover:bg-alt/10 transition"
                    >
                      Go to virtual accounts
                    </button>
                  ) : (
                    <p className="mt-2 text-[11px] text-amber-300">
                      Complete steps 1 &amp; 2 to reach Tier 1, then come back to generate
                      an Anchor / Moniepoint account.
                    </p>
                  )}
                </div>
              </li>
            </ol>
          </div>

          <div className="mt-6 flex flex-wrap gap-3 justify-between">
            <NavLink
              to="/dashboard/home"
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-slate-700 text-xs md:text-sm text-slate-200 hover:bg-slate-800/70 transition"
            >
              Back to dashboard
            </NavLink>

            {/* context-aware “skip” */}
            <button
              type="button"
              onClick={hasTier1OrMore ? goVirtualAccounts : goWallet}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-alt text-black text-xs md:text-sm font-semibold hover:brightness-110 transition"
              title={
                hasTier1OrMore
                  ? 'Go to virtual accounts'
                  : 'Use wallet for now (virtual accounts unlock at Tier 1)'
              }
            >
              {hasTier1OrMore ? 'Go to virtual accounts' : 'Skip for now – use wallet'}
            </button>
          </div>
        </div>
      </div>

      {/* ✅ Phone verification modal mount (keeps existing flows intact) */}
      <PhoneVerifyModal
        open={showPhoneModal}
        onClose={() => setShowPhoneModal(false)}
        defaultPhone={user?.user_profile?.phone_number}
      />
    </div>
  )
}

export default KycCenter
