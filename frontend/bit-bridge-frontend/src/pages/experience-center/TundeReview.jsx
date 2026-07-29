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

const TundeReview = ({ completedEventIds = [] }) => {
  const navigate = useNavigate()
  const circle = useMemo(
    () => deriveGreenfieldCircleView({ completedEventIds }),
    [completedEventIds]
  )
  const payout = circle.pendingPayoutRequest || circle.payoutDraft
  const nextPath = getNextStepPath('circle', 'tunde-review')
  const previousPath = getPreviousStepPath('circle', 'tunde-review')

  return (
    <ExperienceCenterShell
      currentExperienceId="circle"
      currentExperienceLabel="Circle"
      currentPerspectiveId="tunde"
      currentStepId="tunde-review"
      pageTitle="Tunde Review"
      storyPanel={{
        eyebrow: 'Governance review',
        perspectiveName: 'Tunde',
        perspectiveRole: 'Approver',
        title: 'Tunde sees the request before he is asked to approve it.',
        body: 'This step proves that governance is not cosmetic. Tunde can review the purpose, amount, source bucket, and treasury context before releasing the payout into processing.',
        insight:
          'The strongest investor message here is separation of duties. The person who prepared the request is not the person authorizing it.',
        proofPoint:
          'The request still has not reduced the current treasury balance. Approval is a controlled governance action, not a silent payout.',
        progressLabel: `${getGuidedProgressLabel('circle', 'tunde-review')} • Guided Circle story`,
      }}
      guidedActions={[
        { label: 'Back', onClick: () => navigate(previousPath), state: 'enabled' },
        { label: 'Next', onClick: () => navigate(nextPath), state: 'enabled' },
        {
          label: 'Skip',
          state: 'unavailable',
          reason: 'The approval decision is the governance proof point investors need next.',
        },
        {
          label: 'Resume',
          state: 'disabled',
          reason: 'You are already on the Tunde review step.',
        },
      ]}
    >
      <div className="max-w-5xl min-w-0 space-y-6">
        <div>
          <span className="rounded-full border border-[#FFB05A]/40 bg-[#FFB05A]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#FFE1B8]">
            Review before approval
          </span>
          <h1 className="mt-8 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Tunde reviews the request with treasury context in view.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            Tunde is not stepping into Amaka&apos;s role. He is reviewing a request that has already
            been prepared, with enough context to understand what is being approved and what
            remains protected.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
          <section className="space-y-4 rounded-[28px] border border-slate-800 bg-slate-900/68 p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/65 px-4 py-4">
                <span className="block text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Purpose
                </span>
                <span className="mt-2 block text-base font-semibold text-white">
                  {payout.purpose}
                </span>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/65 px-4 py-4">
                <span className="block text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Beneficiary
                </span>
                <span className="mt-2 block text-base font-semibold text-white">
                  {payout.beneficiaryName}
                </span>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/65 px-4 py-4">
                <span className="block text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Amount
                </span>
                <span className="mt-2 block text-base font-semibold text-white">
                  {formatNaira(payout.amount)}
                </span>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/65 px-4 py-4">
                <span className="block text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Requested by
                </span>
                <span className="mt-2 block text-base font-semibold text-white">
                  {payout.requestedBy}
                </span>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-950/65 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Governance lens
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                The request uses {payout.sourceBucketLabel.toLowerCase()} and leaves the
                road-repair treasury protected at {formatNaira(circle.treasury.restrictedBalance)}.
                Tunde is approving a controlled operating expense, not releasing the whole treasury.
              </p>
            </div>
          </section>

          <div className="space-y-4">
            <section className="rounded-[28px] border border-slate-800 bg-slate-900/68 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Current available treasury
              </p>
              <p className="mt-3 text-lg font-semibold text-white">
                {formatNaira(circle.treasury.availableBalance)}
              </p>
            </section>

            <section className="rounded-[28px] border border-slate-800 bg-slate-900/68 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                If approved next
              </p>
              <p className="mt-3 text-lg font-semibold text-white">
                {formatNaira(circle.treasury.projectedAvailableBalance)} available after completion
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Approval releases the request into processing. The final balance update is shown
                when the story returns to Amaka.
              </p>
            </section>
          </div>
        </div>
      </div>
    </ExperienceCenterShell>
  )
}

TundeReview.propTypes = {
  completedEventIds: PropTypes.arrayOf(PropTypes.string),
}

export default TundeReview
