import { useMemo } from 'react'
import PropTypes from 'prop-types'
import { useNavigate } from 'react-router-dom'
import ExperienceCenterShell from '../../components/experience-center/ExperienceCenterShell'
import {
  getGuidedProgressLabel,
  getNextStepPath,
  getPreviousStepPath,
} from '../../utils/experienceCenter'
import { deriveGreenfieldCircleView } from '../../utils/experienceCenterCircleDemo'

const formatNaira = (amount) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount)

const ChidiPaymentSuccess = ({ completedEventIds = [] }) => {
  const navigate = useNavigate()
  const circle = useMemo(
    () => deriveGreenfieldCircleView({ completedEventIds }),
    [completedEventIds]
  )
  const nextPath = getNextStepPath('circle', 'chidi-payment-success')
  const previousPath = getPreviousStepPath('circle', 'chidi-payment-success')

  return (
    <ExperienceCenterShell
      currentExperienceId="circle"
      currentExperienceLabel="Circle"
      currentPerspectiveId="chidi"
      currentStepId="chidi-payment-success"
      pageTitle="Chidi Payment Success"
      storyPanel={{
        eyebrow: 'Member payment result',
        perspectiveName: 'Chidi',
        perspectiveRole: 'Member',
        title: 'Make the impact visible immediately after the confirmation.',
        body: 'The success state should show what changed without pretending that the investor just completed a live banking transaction. The value is in the transparent before-and-after effect on the Circle.',
        insight:
          'The next step returns to the Circle summary so the investor can see the shared impact in context rather than staring at an isolated receipt.',
        proofPoint:
          'This is a fictional demo result. No external provider, wallet, or bank account was called when the payment state changed.',
        progressLabel: `${getGuidedProgressLabel('circle', 'chidi-payment-success')} • Guided Circle story`,
      }}
      guidedActions={[
        { label: 'Back', onClick: () => navigate(previousPath), state: 'enabled' },
        { label: 'Next', onClick: () => navigate(nextPath), state: 'enabled' },
        {
          label: 'Skip',
          state: 'unavailable',
          reason: 'The updated Circle summary is the required follow-through after this payment result.',
        },
        {
          label: 'Resume',
          state: 'disabled',
          reason: 'You are already viewing the recorded Chidi result.',
        },
      ]}
    >
      <div className="max-w-4xl min-w-0 space-y-6">
        <div>
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100">
            Fictional payment completed
          </span>
          <h1 className="mt-8 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Chidi&apos;s July security dues are now marked paid.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            The demo payment moved one member obligation to paid and updated the Circle summary.
            No real money moved. What matters is that the member and the group can now see the
            same result.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-[28px] border border-slate-800 bg-slate-900/68 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Member impact
            </p>
            <p className="mt-3 text-lg font-semibold text-white">Status updated to Paid</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Chidi can now see that the July security dues obligation no longer remains
              outstanding.
            </p>
          </div>

          <div className="rounded-[28px] border border-slate-800 bg-slate-900/68 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Collection impact
            </p>
            <p className="mt-3 text-lg font-semibold text-white">
              +{formatNaira(circle.memberPayment.amount)} collected
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              The July security collection now reflects Chidi&apos;s contribution.
            </p>
          </div>

          <div className="rounded-[28px] border border-slate-800 bg-slate-900/68 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Treasury impact
            </p>
            <p className="mt-3 text-lg font-semibold text-white">
              Available balance {formatNaira(circle.treasury.availableBalance)}
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              The restricted road-repair balance stays unchanged while the available treasury grows.
            </p>
          </div>
        </div>

        <div className="rounded-[28px] border border-[#FFB05A]/25 bg-[#FFB05A]/8 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#FFD2A0]">
            Next in the story
          </p>
          <p className="mt-3 text-sm leading-7 text-[#FFE1B8]">
            Return to the Circle summary to see the updated totals, recent activity, and why one
            member payment should stay visible to the whole group.
          </p>
        </div>
      </div>
    </ExperienceCenterShell>
  )
}

ChidiPaymentSuccess.propTypes = {
  completedEventIds: PropTypes.arrayOf(PropTypes.string),
}

export default ChidiPaymentSuccess
