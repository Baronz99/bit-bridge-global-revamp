import { useMemo } from 'react'
import PropTypes from 'prop-types'
import { useNavigate } from 'react-router-dom'
import ExperienceCenterShell from '../../components/experience-center/ExperienceCenterShell'
import {
  createGuidedStepState,
  getExperienceCenterState,
  getGuidedProgressLabel,
  getNextStepPath,
  getPreviousStepPath,
  saveExperienceCenterState,
} from '../../utils/experienceCenter'
import {
  applyDemoEvent,
  deriveGreenfieldCircleView,
  hasCompletedDemoEvent,
} from '../../utils/experienceCenterCircleDemo'
import { AMAKA_JULY_SECURITY_VENDOR_PAYOUT_REQUEST_EVENT_ID } from '../../utils/experienceCenterDemoData.js'

const formatNaira = (amount) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount)

const AmakaPayoutReview = ({ completedEventIds = [] }) => {
  const navigate = useNavigate()
  const circle = useMemo(
    () => deriveGreenfieldCircleView({ completedEventIds }),
    [completedEventIds]
  )
  const draft = circle.payoutDraft
  const nextPath = getNextStepPath('circle', 'amaka-payout-review')
  const previousPath = getPreviousStepPath('circle', 'amaka-payout-review')
  const isAlreadySubmitted = hasCompletedDemoEvent(
    circle.completedEventIds,
    AMAKA_JULY_SECURITY_VENDOR_PAYOUT_REQUEST_EVENT_ID
  )

  const submitForApproval = () => {
    const existingState = getExperienceCenterState()
    const nextCompletedEventIds = applyDemoEvent(
      existingState.completedEventIds,
      AMAKA_JULY_SECURITY_VENDOR_PAYOUT_REQUEST_EVENT_ID
    )

    saveExperienceCenterState(
      createGuidedStepState({
        experienceId: 'circle',
        stepId: 'amaka-awaiting-approval',
        perspectiveId: 'amaka',
        completedEventIds: nextCompletedEventIds.completedEventIds,
      })
    )
    navigate(nextPath)
  }

  return (
    <ExperienceCenterShell
      currentExperienceId="circle"
      currentExperienceLabel="Circle"
      currentPerspectiveId="amaka"
      currentStepId="amaka-payout-review"
      pageTitle="Payout Review"
      storyPanel={{
        eyebrow: 'Payout review',
        perspectiveName: 'Amaka',
        perspectiveRole: 'Treasurer',
        title: 'This review confirms what would change if governance approves the request later.',
        body: 'The payout still has not moved any money. Amaka is reviewing the beneficiary, source bucket, and projected available balance before handing the request to an approver.',
        insight:
          'The fictional request is idempotent. Repeated submission or refresh cannot duplicate the pending request event.',
        proofPoint:
          'Current available treasury stays unchanged at this stage. Only the projected available balance reflects the future effect of approval.',
        progressLabel: `${getGuidedProgressLabel('circle', 'amaka-payout-review')} • Guided Circle story`,
      }}
      guidedActions={[
        { label: 'Back', onClick: () => navigate(previousPath), state: 'enabled' },
        isAlreadySubmitted
          ? { label: 'Next', onClick: () => navigate(nextPath), state: 'enabled' }
          : { label: 'Next', onClick: submitForApproval, state: 'enabled' },
        {
          label: 'Skip',
          state: 'unavailable',
          reason: 'The governance handoff is the core proof point of this Amaka chapter.',
        },
        {
          label: 'Resume',
          state: 'disabled',
          reason: 'You are already on the payout review step.',
        },
      ]}
    >
      <div className="max-w-5xl min-w-0 space-y-6">
        <div>
          <span className="rounded-full border border-[#FFB05A]/40 bg-[#FFB05A]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#FFE1B8]">
            Review payout request
          </span>
          <h1 className="mt-8 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            What will change if this request is later approved?
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            This is the final treasurer check before governance takes over. Amaka can confirm the
            amount, purpose, and source bucket, but she still cannot complete the payout herself.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
          <section className="space-y-4 rounded-[28px] border border-slate-800 bg-slate-900/68 p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/65 px-4 py-4">
                <span className="block text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Amount
                </span>
                <span className="mt-2 block text-base font-semibold text-white">
                  {formatNaira(draft.amount)}
                </span>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/65 px-4 py-4">
                <span className="block text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Beneficiary
                </span>
                <span className="mt-2 block text-base font-semibold text-white">
                  {draft.beneficiaryName}
                </span>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/65 px-4 py-4">
                <span className="block text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Source bucket
                </span>
                <span className="mt-2 block text-base font-semibold text-white">
                  {draft.sourceBucketLabel}
                </span>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/65 px-4 py-4">
                <span className="block text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Requested by
                </span>
                <span className="mt-2 block text-base font-semibold text-white">
                  {draft.requestedBy}
                </span>
              </div>
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
                Projected available after approval
              </p>
              <p className="mt-3 text-lg font-semibold text-white">
                {formatNaira(circle.treasury.availableBalance - draft.amount)}
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Restricted treasury remains {formatNaira(circle.treasury.restrictedBalance)} and
                does not fund this request.
              </p>
            </section>

            <section className="rounded-[28px] border border-[#FFB05A]/25 bg-[#FFB05A]/8 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#FFD2A0]">
                Governance reminder
              </p>
              <p className="mt-3 text-sm leading-7 text-[#FFE1B8]">
                No money has moved yet. Submitting this request only hands it to the next governance
                role for review.
              </p>
            </section>
          </div>
        </div>
      </div>
    </ExperienceCenterShell>
  )
}

AmakaPayoutReview.propTypes = {
  completedEventIds: PropTypes.arrayOf(PropTypes.string),
}

export default AmakaPayoutReview
