import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'

const steps = [
  {
    key: 'profile',
    label: 'Profile',
    description: 'Company details and signatories',
    route: '/dashboard/business/onboarding',
  },
  {
    key: 'documents',
    label: 'Documents',
    description: 'Required uploads and checks',
    route: '/dashboard/business/kyb',
  },
  {
    key: 'review',
    label: 'Review',
    description: 'Provider review and sync',
    route: '/dashboard/business/kyb',
  },
  {
    key: 'live',
    label: 'Live',
    description: 'Wallet and receiving account active',
    route: '/dashboard/business',
  },
]

const BusinessSetupProgress = ({
  profileReady = false,
  documentsReady = false,
  submitted = false,
  approvedForProvisioning = false,
  isLive = false,
  currentStep = null,
}) => {
  const completion = {
    profile: profileReady,
    documents: documentsReady,
    review: submitted || approvedForProvisioning || isLive,
    live: isLive,
  }

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
        {steps.map((step, index) => {
          const completed = completion[step.key]
          const active = currentStep === step.key
          const tone = completed
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
            : active
            ? 'border-[#FFB05A]/40 bg-[rgba(255,176,90,0.12)] text-[#FFD2A0]'
            : 'border-slate-800 bg-slate-950/45 text-slate-400'

          return (
            <Link
              key={step.key}
              to={step.route}
              className={`flex items-start gap-3 rounded-2xl border px-4 py-3 transition hover:border-slate-600 ${tone}`}
            >
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current/30 text-xs font-semibold">
                {completed ? '✓' : index + 1}
              </div>
              <div>
                <div className="text-sm font-semibold">{step.label}</div>
                <div className="mt-1 text-xs opacity-80">{step.description}</div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

BusinessSetupProgress.propTypes = {
  approvedForProvisioning: PropTypes.bool,
  currentStep: PropTypes.oneOf(['profile', 'documents', 'review', 'live', null]),
  documentsReady: PropTypes.bool,
  isLive: PropTypes.bool,
  profileReady: PropTypes.bool,
  submitted: PropTypes.bool,
}

export default BusinessSetupProgress
