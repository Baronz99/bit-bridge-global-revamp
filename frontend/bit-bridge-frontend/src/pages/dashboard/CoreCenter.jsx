import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { getTransactionPinStatus } from '../../api/transactionPin'

const cardClass =
  'rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.22)]'
const actionClass =
  'rounded-2xl border border-slate-700 bg-slate-950/35 px-4 py-3 text-left text-sm font-medium text-slate-100 hover:border-slate-500 hover:bg-slate-950/60 transition'

const formatStage = (value, fallback = 'Not started') => {
  const text = String(value || '').trim()
  if (!text) return fallback
  return text.replace(/_/g, ' ')
}

const statusTone = (status) => {
  if (status === 'good') return 'border-emerald-900/60 bg-emerald-950/20 text-emerald-300'
  if (status === 'warning') return 'border-amber-900/60 bg-amber-950/20 text-amber-300'
  return 'border-rose-900/60 bg-rose-950/20 text-rose-300'
}

const CoreCenter = () => {
  const navigate = useNavigate()
  const user = useSelector((state) => state.auth?.user)
  const profile = user?.user_profile || {}
  const [pinStatus, setPinStatus] = useState(null)

  useEffect(() => {
    let active = true

    const loadPinStatus = async () => {
      try {
        const response = await getTransactionPinStatus()
        if (!active) return
        setPinStatus(response?.data?.data || response?.data || null)
      } catch {
        if (!active) return
        setPinStatus(null)
      }
    }

    loadPinStatus()

    return () => {
      active = false
    }
  }, [])

  const phoneVerified =
    user?.phone_verified === true || !!user?.phone_verified_at || !!profile?.phone_verified_at
  const tierKey = String(user?.kyc_level || 'tier_0').toLowerCase()
  const tierLabel = formatStage(tierKey, 'tier_0').toUpperCase()
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
  const identityLabel = fullName || user?.email || 'BitBridge account'
  const onboardingStage = formatStage(user?.onboarding_stage)
  const primaryUseCase = formatStage(user?.primary_use_case, 'Not selected')
  const hasAddressProof = Boolean(profile?.proof_of_address_type && profile?.proof_of_address_url)
  const hasIdDocument = Boolean(profile?.id_document_url)
  const pinSet = Boolean(pinStatus?.pin_set)
  const pinLocked = Boolean(pinStatus?.locked || user?.transaction_pin_locked)

  const completionStats = useMemo(
    () => [
      {
        label: 'Phone',
        value: phoneVerified ? 'Verified' : 'Pending',
        tone: phoneVerified ? 'good' : 'warning',
        note: phoneVerified ? 'Required for stronger account controls.' : 'Verify phone to unlock PIN controls.',
      },
      {
        label: 'Identity',
        value: tierLabel,
        tone: tierKey === 'tier_0' ? 'warning' : 'good',
        note: `Current verification level: ${tierLabel}.`,
      },
      {
        label: 'PIN',
        value: pinLocked ? 'Locked' : pinSet ? 'Configured' : 'Not set',
        tone: pinLocked ? 'risk' : pinSet ? 'good' : 'warning',
        note: pinLocked
          ? 'PIN is temporarily locked.'
          : pinSet
          ? 'Transaction approvals are protected.'
          : 'Set a transaction PIN for transfers and FX approvals.',
      },
      {
        label: 'Address proof',
        value: hasAddressProof ? 'On file' : 'Missing',
        tone: hasAddressProof ? 'good' : 'warning',
        note: hasAddressProof ? 'Tier 4 evidence is available.' : 'Needed for full address verification.',
      },
    ],
    [hasAddressProof, phoneVerified, pinLocked, pinSet, tierKey, tierLabel]
  )

  const nextActions = useMemo(() => {
    const actions = []

    if (!phoneVerified) {
      actions.push({
        title: 'Verify phone number',
        detail: 'Required for transaction PIN setup and stronger recovery controls.',
        to: '/dashboard/profile-account?section=profile',
      })
    }

    if (tierKey === 'tier_0' || tierKey === 'tier_1') {
      actions.push({
        title: 'Advance KYC to Tier 2',
        detail: 'Unlock virtual accounts, Tunnel rail access, and higher trust limits.',
        to: '/dashboard/kyc',
      })
    }

    if (!pinSet || pinLocked) {
      actions.push({
        title: pinLocked ? 'Review PIN security' : 'Set transaction PIN',
        detail: pinLocked
          ? 'Open security settings to reset or review PIN lock state.'
          : 'Protect transfers, conversions, and card actions with a PIN.',
        to: '/dashboard/profile-account?section=security',
      })
    }

    if (!hasIdDocument || !hasAddressProof) {
      actions.push({
        title: 'Upload account documents',
        detail: 'Keep identity evidence and proof of address current.',
        to: '/dashboard/profile-account?section=kyc',
      })
    }

    if (!actions.length) {
      actions.push({
        title: 'Review fees and limits',
        detail: 'Check pricing, limits, and account settings before your next operation.',
        to: '/dashboard/profile-account?section=fees',
      })
    }

    return actions.slice(0, 4)
  }, [hasAddressProof, hasIdDocument, phoneVerified, pinLocked, pinSet, tierKey])

  const actions = [
    { label: 'Profile', to: '/dashboard/profile-account?section=profile' },
    { label: 'KYC', to: '/dashboard/kyc' },
    { label: 'Security', to: '/dashboard/profile-account?section=security' },
    { label: 'Fees & Limits', to: '/dashboard/profile-account?section=fees' },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        <section className="rounded-[28px] border border-slate-800 bg-[linear-gradient(135deg,rgba(2,6,23,0.96),rgba(15,23,42,0.92))] p-5 md:p-7 shadow-[0_24px_60px_rgba(2,6,23,0.28)]">
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Core</p>
          <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-white">Account center</h1>
              <p className="mt-2 text-sm text-slate-300 max-w-xl">
                Manage identity, verification, security posture, and account settings from one place.
              </p>
            </div>
            <div className="grid min-w-[18rem] grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-700 bg-slate-950/45 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500 mb-2">Verification level</div>
                <div className="text-lg font-semibold text-white">{tierLabel}</div>
                <div className="mt-1 text-xs text-slate-400">{phoneVerified ? 'Phone verified' : 'Phone pending'}</div>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-950/45 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500 mb-2">Onboarding stage</div>
                <div className="text-lg font-semibold text-white capitalize">{onboardingStage}</div>
                <div className="mt-1 text-xs text-slate-400 capitalize">Use case: {primaryUseCase}</div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <section className={cardClass}>
            <div className="mb-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Account summary</p>
              <h2 className="mt-1 text-lg md:text-xl font-semibold text-white">Trust and profile state</h2>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Account holder</div>
              <div className="mt-2 text-lg font-semibold text-white">{identityLabel}</div>
              <div className="mt-1 text-sm text-slate-400">{user?.email || 'Email not available'}</div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm text-slate-300">
                <div>
                  <div className="text-slate-500">Phone</div>
                  <div className="mt-1 text-slate-100">{profile?.phone_number || 'Not provided'}</div>
                </div>
                <div>
                  <div className="text-slate-500">Identity type</div>
                  <div className="mt-1 text-slate-100">{formatStage(user?.id_type, 'Not selected')}</div>
                </div>
                <div>
                  <div className="text-slate-500">Country</div>
                  <div className="mt-1 text-slate-100">{profile?.country || 'Not provided'}</div>
                </div>
                <div>
                  <div className="text-slate-500">Address evidence</div>
                  <div className="mt-1 text-slate-100">{hasAddressProof ? 'Proof on file' : 'No proof uploaded'}</div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {completionStats.map((item) => (
                <div
                  key={item.label}
                  className={`rounded-2xl border px-4 py-3 ${statusTone(item.tone)}`}
                >
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
                  <div className="mt-2 text-sm font-semibold text-slate-100">{item.value}</div>
                  <div className="mt-1 text-xs text-slate-400">{item.note}</div>
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-col gap-6">
            <section className={cardClass}>
              <div className="mb-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Next actions</p>
                <h2 className="mt-1 text-lg md:text-xl font-semibold text-white">What needs attention</h2>
              </div>
              <div className="space-y-3">
                {nextActions.map((action) => (
                  <button
                    key={action.title}
                    type="button"
                    onClick={() => navigate(action.to)}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4 text-left hover:border-slate-600 hover:bg-slate-950/65 transition"
                  >
                    <div className="text-sm font-semibold text-white">{action.title}</div>
                    <div className="mt-1 text-xs text-slate-400">{action.detail}</div>
                  </button>
                ))}
              </div>
            </section>

            <section className={cardClass}>
              <div className="mb-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Primary actions</p>
                <h2 className="text-lg md:text-xl font-semibold text-white mt-1">Account controls</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {actions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => navigate(action.to)}
                    className={actionClass}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CoreCenter
