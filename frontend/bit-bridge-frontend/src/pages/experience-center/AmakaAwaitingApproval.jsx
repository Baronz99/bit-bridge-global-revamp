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

const AmakaAwaitingApproval = ({ completedEventIds = [] }) => {
  const navigate = useNavigate()
  const circle = useMemo(
    () => deriveGreenfieldCircleView({ completedEventIds }),
    [completedEventIds]
  )
  const payout = circle.pendingPayoutRequest || circle.payoutDraft
  const previousPath = getPreviousStepPath('circle', 'amaka-awaiting-approval')
  const nextPath = getNextStepPath('circle', 'amaka-awaiting-approval')

  return (
    <ExperienceCenterShell
      currentExperienceId="circle"
      currentExperienceLabel="Circle"
      currentPerspectiveId="amaka"
      currentStepId="amaka-awaiting-approval"
      pageTitle="Awaiting Approval"
      storyPanel={{
        eyebrow: 'Governance handoff',
        perspectiveName: 'Amaka',
        perspectiveRole: 'Treasurer',
        title: 'Amaka has prepared the payout. Tunde reviews it next.',
        body: 'This step closes the operating chapter cleanly. The request exists, the current treasury is unchanged, and governance now moves to a separate approver.',
        insight:
          'The investor should understand that this is where Circle becomes more than a group wallet. Preparing a request is not the same as releasing shared money.',
        proofPoint:
          'Current available treasury stays at ₦4,150,000. Projected available after completion is ₦3,550,000. Restricted road-repair funds remain protected at ₦1,850,000.',
        progressLabel: `${getGuidedProgressLabel('circle', 'amaka-awaiting-approval')} • Guided Circle story`,
      }}
      guidedActions={[
        { label: 'Back', onClick: () => navigate(previousPath), state: 'enabled' },
        { label: 'Next', onClick: () => navigate(nextPath), state: 'enabled' },
        {
          label: 'Skip',
          state: 'unavailable',
          reason: 'The Tunde governance chapter is the next proof point in the Circle story.',
        },
        {
          label: 'Resume',
          state: 'disabled',
          reason: 'You are already on the governance handoff step.',
        },
      ]}
    >
      <div className="max-w-5xl min-w-0 space-y-6">
        <div>
          <span className="rounded-full border border-[#FFB05A]/40 bg-[#FFB05A]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#FFE1B8]">
            Awaiting approval
          </span>
          <h1 className="mt-8 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            The payout request is now waiting for Tunde’s review.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            Amaka has done her part. The request exists, but the product still prevents a
            unilateral payout. The guided story now shifts from treasury operations to governance.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
          <section className="space-y-4 rounded-[28px] border border-slate-800 bg-slate-900/68 p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/65 px-4 py-4">
                <span className="block text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Status
                </span>
                <span className="mt-2 block text-base font-semibold text-white">
                  Pending approval
                </span>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/65 px-4 py-4">
                <span className="block text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Request ID
                </span>
                <span className="mt-2 block text-base font-semibold text-white">
                  {payout.requestId}
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
                  Next reviewer
                </span>
                <span className="mt-2 block text-base font-semibold text-white">
                  {payout.approverLabel}
                </span>
              </div>
            </div>
          </section>

          <div className="space-y-4">
            <section className="rounded-[28px] border border-slate-800 bg-slate-900/68 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Current balances
              </p>
              <ul className="mt-3 space-y-3 text-sm leading-7 text-slate-300">
                <li>Total treasury: {formatNaira(circle.treasury.totalBalance)}</li>
                <li>Available treasury: {formatNaira(circle.treasury.availableBalance)}</li>
                <li>Restricted treasury: {formatNaira(circle.treasury.restrictedBalance)}</li>
              </ul>
            </section>

            <section className="rounded-[28px] border border-[#FFB05A]/25 bg-[#FFB05A]/8 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#FFD2A0]">
                What changes after approval
              </p>
              <p className="mt-3 text-sm leading-7 text-[#FFE1B8]">
                Projected available treasury after the completed payout is{' '}
                {formatNaira(circle.treasury.projectedAvailableBalance)}. The next chapter shows
                Tunde making the governance decision before the completion returns to Amaka.
              </p>
            </section>
          </div>
        </div>
      </div>
    </ExperienceCenterShell>
  )
}

AmakaAwaitingApproval.propTypes = {
  completedEventIds: PropTypes.arrayOf(PropTypes.string),
}

export default AmakaAwaitingApproval
