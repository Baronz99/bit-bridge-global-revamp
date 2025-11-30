// src/pages/auth/UseCaseSetup.jsx
import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { saveOnboardingUseCase, updateBasicProfile } from '../../api/onboarding'
import { userProfile } from '../../redux/actions/auth'

// --- Available primary use cases ---
// (Only keeping realistic BitBridge use cases)
const useCases = [
  {
    id: 'send_receive',
    label: 'Send & receive money',
    description:
      'Transfer money to bank accounts or other BitBridge users quickly and securely.',
  },
  {
    id: 'virtual_cards',
    label: 'Virtual cards & online spend',
    description: 'Use virtual cards for subscriptions, online shopping, and digital services.',
  },
  {
    id: 'airtime_utilities',
    label: 'Airtime, data & utilities',
    description: 'Top up airtime, data, electricity, and essential bills from your BitBridge wallet.',
  },
  {
    id: 'taxes',
    label: 'Taxes & statutory bills',
    description: 'Handle tax, levies, and government-related payments from one place.',
  },
  {
    id: 'student_life',
    label: 'Student life & campus spend',
    description:
      'Perfect for students managing data, subscriptions, school-related payments, and everyday campus spending.',
  },
]

// --- Simple KYC requirement matrix per use case ---
const KYC_REQUIREMENTS = {
  send_receive: {
    level: 'tier_2',
    title: 'KYC for sending & receiving money',
    points: [
      'BVN or NIN linked to your phone number',
      'Government-issued ID (NIN slip, Int’l passport, driver’s licence, or voter’s card)',
      'Basic personal details (name, date of birth, address)',
    ],
  },
  virtual_cards: {
    level: 'tier_2',
    title: 'KYC for virtual cards & online spend',
    points: [
      'BVN or NIN',
      'Government-issued ID',
      'Sometimes a selfie or extra verification for higher limits',
    ],
  },
  airtime_utilities: {
    level: 'tier_1',
    title: 'Light KYC for airtime, data & bills',
    points: [
      'Basic profile (name & phone number)',
      'Upgrade later to unlock higher limits and banking features',
    ],
  },
  taxes: {
    level: 'tier_2',
    title: 'KYC for tax & statutory payments',
    points: [
      'BVN or NIN',
      'Government-issued ID',
      'Address and basic profile details',
    ],
  },
  student_life: {
    level: 'tier_1',
    title: 'Light KYC for student life & campus spend',
    points: [
      'Basic profile (name, date of birth, phone number)',
      'School details or ID (optional for some features)',
      'Upgrade later to unlock virtual cards and higher limits',
    ],
  },
}

const UseCaseSetup = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)

  const [selectedUseCase, setSelectedUseCase] = useState('')
  const [saving, setSaving] = useState(false)

  const firstName =
    user?.user_profile?.first_name ||
    user?.email?.split('@')[0] ||
    'there'

  const [basicProfile, setBasicProfile] = useState({
    first_name: user?.user_profile?.first_name || '',
    last_name: user?.user_profile?.last_name || '',
    date_of_birth: user?.user_profile?.date_of_birth || '',
  })

  const selectedKycConfig = useMemo(
    () => (selectedUseCase ? KYC_REQUIREMENTS[selectedUseCase] : null),
    [selectedUseCase]
  )

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setBasicProfile((prev) => ({ ...prev, [name]: value }))
  }

  const handleContinue = async () => {
    if (!selectedUseCase || saving) return

    const { first_name, last_name, date_of_birth } = basicProfile

    const hasBasicProfile =
      first_name?.trim().length > 0 &&
      last_name?.trim().length > 0 &&
      date_of_birth?.trim().length > 0

    try {
      setSaving(true)

      // 1) If user filled basic profile, send it via the basic_profile endpoint
      if (hasBasicProfile) {
        await updateBasicProfile({
          id_type: user?.id_type || '',
          user_profile_attributes: {
            first_name,
            last_name,
            phone_number:
              user?.user_profile?.phone_number ||
              user?.phone_number ||
              '',
            date_of_birth,
          },
        })
      }

      // 2) Always send use-case choice to the onboarding/use_case endpoint
      await saveOnboardingUseCase({
        primary_use_case: selectedUseCase,
        onboarding_stage: 'use_case_selected',
      })

      // Refresh Redux user
      dispatch(userProfile())

      // Heavier use-cases go straight to KYC centre
      const needsKycNow = ['send_receive', 'virtual_cards', 'taxes'].includes(
        selectedUseCase
      )

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
        err?.response?.data?.errors?.join?.(', ') ||
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

        {/* Basic profile section */}
        <h1 className="text-2xl md:text-3xl font-semibold mb-1">
          Tell us a bit about you
        </h1>
        <p className="text-sm text-slate-400 mb-6 max-w-xl">
          We&apos;ll use this to personalise your account and KYC limits. You can
          always review your details later in Settings.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              FIRST NAME
            </label>
            <input
              type="text"
              name="first_name"
              value={basicProfile.first_name}
              onChange={handleInputChange}
              placeholder="e.g. John"
              className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-alt"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              LAST NAME
            </label>
            <input
              type="text"
              name="last_name"
              value={basicProfile.last_name}
              onChange={handleInputChange}
              placeholder="e.g. Doe"
              className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-alt"
            />
          </div>
        </div>

        <div className="mb-8 max-w-xs">
          <label className="block text-xs text-slate-400 mb-1">
            DATE OF BIRTH
          </label>
          <input
            type="date"
            name="date_of_birth"
            value={basicProfile.date_of_birth}
            onChange={handleInputChange}
            className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-alt"
          />
        </div>

        {/* Use-case section */}
        <h2 className="text-lg md:text-xl font-semibold mb-1">
          How will you use BitBridge, {firstName}?
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

        {/* KYC summary */}
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
