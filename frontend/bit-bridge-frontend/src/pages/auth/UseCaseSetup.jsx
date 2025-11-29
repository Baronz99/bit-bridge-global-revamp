// src/pages/auth/UseCaseSetup.jsx
import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { saveOnboardingUseCase } from '../../api/onboarding'
import { userProfile } from '../../redux/actions/auth'

// --- Available primary use cases ---
const useCases = [
  {
    id: 'salary',
    label: 'Salary & payouts',
    description: 'Receive salary, stipends, or recurring payouts into BitBridge.',
  },
  {
    id: 'vendor_payments',
    label: 'Vendor / business payments',
    description: 'Pay suppliers, freelancers, and small business expenses.',
  },
  {
    id: 'taxes',
    label: 'Taxes & statutory bills',
    description: 'Handle tax, levies, and government-related payments.',
  },
  {
    id: 'virtual_cards',
    label: 'Virtual cards & online spend',
    description: 'Use virtual cards for subscriptions and online purchases.',
  },
  {
    id: 'airtime_utilities',
    label: 'Airtime, data & utilities',
    description: 'Primarily using BitBridge for phone top-ups and bills.',
  },
]

// --- Simple KYC requirement matrix per use case ---
const KYC_REQUIREMENTS = {
  salary: {
    level: 'tier_2',
    title: 'Standard KYC for salary accounts',
    points: [
      'BVN linked to your phone number',
      'Government-issued ID (NIN, Int’l passport, driver’s licence, or voter’s card)',
      'Basic personal details (name, DOB, address)',
    ],
  },
  vendor_payments: {
    level: 'tier_2',
    title: 'Standard KYC for business / vendor payments',
    points: [
      'BVN or NIN',
      'Government-issued ID for the business owner',
      'Business or workplace details',
    ],
  },
  taxes: {
    level: 'tier_2',
    title: 'Standard KYC for taxes & statutory payments',
    points: [
      'BVN or NIN',
      'Government-issued ID',
      'Address and basic profile details',
    ],
  },
  virtual_cards: {
    level: 'tier_2',
    title: 'Standard KYC for virtual cards',
    points: [
      'BVN or NIN',
      'Government-issued ID',
      'Sometimes a selfie for extra verification',
    ],
  },
  airtime_utilities: {
    level: 'tier_1',
    title: 'Light KYC for bills & top-ups',
    points: [
      'Basic profile (name & phone number)',
      'Upgrade later to unlock higher limits and banking features',
    ],
  },
}

const UseCaseSetup = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)

  const [selectedUseCase, setSelectedUseCase] = useState('')

  // new basic-profile fields on this step
  const [firstNameInput, setFirstNameInput] = useState(
    user?.user_profile?.first_name || ''
  )
  const [lastNameInput, setLastNameInput] = useState(
    user?.user_profile?.last_name || ''
  )
  const [dobInput, setDobInput] = useState(
    user?.user_profile?.date_of_birth || ''
  )

  const [saving, setSaving] = useState(false)

  const firstNameForGreeting =
    user?.user_profile?.first_name ||
    user?.email?.split('@')[0] ||
    'there'

  const selectedKycConfig = useMemo(
    () => (selectedUseCase ? KYC_REQUIREMENTS[selectedUseCase] : null),
    [selectedUseCase]
  )

  const handleContinue = async () => {
    if (!selectedUseCase || saving) return

    if (!firstNameInput || !lastNameInput || !dobInput) {
      alert('Please tell us your full name and date of birth to continue.')
      return
    }

    try {
      setSaving(true)

      await saveOnboardingUseCase({
        primary_use_case: selectedUseCase,
        onboarding_stage: 'use_case_selected',
        user_profile_attributes: {
          first_name: firstNameInput,
          last_name: lastNameInput,
          date_of_birth: dobInput,
        },
      })

      // refresh Redux user so the rest of the app sees latest profile
      dispatch(userProfile())

      const needsKycNow = [
        'salary',
        'vendor_payments',
        'taxes',
        'virtual_cards',
      ].includes(selectedUseCase)

      if (needsKycNow) {
        navigate('/dashboard/kyc')
      } else {
        navigate('/dashboard/home')
      }
    } catch (err) {
      console.error('Failed to save onboarding use case:', err)

      const backendMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.response?.data?.errors?.join(', ') ||
        'Could not save your selection. Please try again.'

      alert(backendMsg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex justify-center">
      <div className="w-full max-w-3xl px-4 py-10">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-2">
          Step 2 of 3
        </p>

        {/* NEW: basic profile block */}
        <h1 className="text-2xl md:text-3xl font-semibold mb-2">
          Tell us a bit about you
        </h1>
        <p className="text-sm text-slate-400 mb-5 max-w-xl">
          We’ll use this to personalise your account and KYC limits. You can
          always review your details later in Settings.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-slate-400 uppercase tracking-[0.16em]">
              First name
            </label>
            <input
              type="text"
              value={firstNameInput}
              onChange={(e) => setFirstNameInput(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-alt"
              placeholder="e.g. John"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-slate-400 uppercase tracking-[0.16em]">
              Last name
            </label>
            <input
              type="text"
              value={lastNameInput}
              onChange={(e) => setLastNameInput(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-alt"
              placeholder="e.g. Doe"
            />
          </div>

          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="text-[11px] text-slate-400 uppercase tracking-[0.16em]">
              Date of birth
            </label>
            <input
              type="date"
              value={dobInput}
              onChange={(e) => setDobInput(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-alt"
            />
          </div>
        </div>

        {/* ORIGINAL heading + use-case cards */}
        <h2 className="text-xl md:text-2xl font-semibold mb-1">
          How will you use BitBridge, {firstNameForGreeting}?
        </h2>
        <p className="text-sm text-slate-400 mb-6 max-w-xl">
          Choose your primary use case so we can personalise your limits, KYC flow,
          and recommendations. You can still use other features later.
        </p>

        {/* Use-case cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {useCases.map((uc) => {
            const active = selectedUseCase === uc.id
            return (
              <button
                type="button"
                key={uc.id}
                onClick={() => setSelectedUseCase(uc.id)}
                className={`text-left rounded-2xl border px-4 py-3 transition-all ${
                  active
                    ? 'border-alt bg-alt/10 shadow-lg shadow-alt/20'
                    : 'border-slate-700 bg-slate-900 hover:border-alt/70'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{uc.label}</span>
                  {active && (
                    <span className="text-[10px] px-2 py-[2px] rounded-full bg-alt text-black font-semibold">
                      Selected
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">{uc.description}</p>
              </button>
            )
          })}
        </div>

        {/* KYC summary for the selected use case */}
        <div className="mb-8">
          {selectedKycConfig ? (
            <div className="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-1">
                KYC requirements
              </p>
              <h3 className="text-sm font-semibold mb-1">
                {selectedKycConfig.title}
              </h3>
              <p className="text-[11px] text-slate-400 mb-1">
                Target KYC level:{' '}
                <span className="font-semibold text-alt">
                  {selectedKycConfig.level}
                </span>
              </p>
              <ul className="mt-1 space-y-1 text-[12px] text-slate-300">
                {selectedKycConfig.points.map((point) => (
                  <li key={point} className="flex gap-2">
                    <span className="mt-[2px] h-[6px] w-[6px] rounded-full bg-alt/80" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-4 py-3 text-[12px] text-slate-400">
              Pick one main use case and we’ll show what you need to get started.
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={() => navigate('/dashboard/home')}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            Skip for now
          </button>

          <button
            type="button"
            disabled={!selectedUseCase || saving}
            onClick={handleContinue}
            className={`px-5 py-2 rounded-full text-sm font-medium ${
              !selectedUseCase || saving
                ? 'bg-slate-700 text-slate-300 cursor-not-allowed'
                : 'bg-alt text-black hover:bg-alt/90'
            }`}
          >
            {saving ? 'Saving…' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default UseCaseSetup
