import { useMemo } from 'react'
import PropTypes from 'prop-types'
import { useNavigate } from 'react-router-dom'
import ExperienceCenterShell from '../../components/experience-center/ExperienceCenterShell'
import useRenderedSimulationState from '../../hooks/useRenderedSimulationState'
import {
  getGuidedProgressLabel,
  getNextStepPath,
  getPreviousStepPath,
  persistGuidedStepState,
} from '../../utils/experienceCenter'
import { approveVendorPayoutRequest, deriveGreenfieldCircleView } from '../../utils/experienceCenterCircleDemo'

const TundeApproval = ({ simulationState }) => {
  const navigate = useNavigate()
  const { renderedSimulationState, setRenderedSimulationState } = useRenderedSimulationState(simulationState)
  const circle = useMemo(
    () => deriveGreenfieldCircleView(renderedSimulationState),
    [renderedSimulationState]
  )
  const nextPath = getNextStepPath('circle', 'approve-payout')
  const previousPath = getPreviousStepPath('circle', 'approve-payout')
  const alreadyApproved = circle.payoutApproved

  const persistForAmaka = (nextSimulationState) => {
    const savedState = persistGuidedStepState({
      experienceId: 'circle',
      stepId: 'treasury-update',
      perspectiveId: 'amaka',
      simulationState: nextSimulationState,
    })
    setRenderedSimulationState(savedState.simulationState)
    return savedState
  }

  const navigateToAmaka = () => {
    navigate(nextPath)
  }

  const approve = () => {
    if (alreadyApproved) return

    const nextSimulationState = approveVendorPayoutRequest(renderedSimulationState)
    persistForAmaka(nextSimulationState)
  }

  const returnToAmaka = () => {
    persistForAmaka(renderedSimulationState)
    navigateToAmaka()
  }

  return (
    <ExperienceCenterShell
      currentExperienceId="circle"
      currentExperienceLabel="BitBridge Circle"
      currentPerspectiveId="tunde"
      currentStepId="approve-payout"
      pageTitle="Approve Payout"
      storyPanel={{
        eyebrow: 'Review before payout',
        perspectiveName: 'Tunde',
        perspectiveRole: 'Admin',
        title: 'Tunde reviews the payment request before money leaves the Circle.',
        body: alreadyApproved
          ? 'Tunde has approved the request. Return to Amaka and watch the payout move into processing.'
          : 'He reviews the request, its financial impact, and whether it should move into processing.',
        progressLabel: `${getGuidedProgressLabel('circle', 'approve-payout')} - Circle story`,
      }}
      guidedActions={[
        { label: 'Back', onClick: () => navigate(previousPath), state: 'enabled' },
        alreadyApproved
          ? { label: 'Return to Amaka’s Treasury Update', onClick: returnToAmaka, state: 'enabled' }
          : { label: 'Approve Request', onClick: approve, state: 'enabled' },
      ]}
    >
      <div className="max-w-5xl min-w-0 space-y-6">
        <div>
          <span className="rounded-full border border-[#FFB05A]/40 bg-[#FFB05A]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#FFE1B8]">
            Tunde - Admin
          </span>
          <h1 className="mt-8 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Tunde reviews the request before the payout can move.
          </h1>
        </div>

        {alreadyApproved ? (
          <section className="rounded-[28px] border border-emerald-400/30 bg-emerald-400/10 p-5 text-emerald-100">
            <p className="text-xs font-semibold uppercase tracking-[0.24em]">Review complete</p>
            <p className="mt-3 text-lg font-semibold text-white">Tunde has approved the request.</p>
            <p className="mt-2 text-sm leading-7 text-emerald-100">
              Return to Amaka to watch the payment move from approval into completion.
            </p>
          </section>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
          <section className="space-y-4 rounded-[28px] border border-slate-800 bg-slate-900/68 p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/65 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Requested by</p>
                <p className="mt-2 text-base font-semibold text-white">Amaka</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/65 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Status</p>
                <p className="mt-2 text-base font-semibold text-white">{alreadyApproved ? 'Approved' : 'Awaiting review'}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/65 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Beneficiary</p>
                <p className="mt-2 text-base font-semibold text-white">{circle.payoutRequest.beneficiaryName}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/65 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Purpose</p>
                <p className="mt-2 text-base font-semibold text-white">{circle.payoutRequest.purpose}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/65 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Principal</p>
                <p className="mt-2 text-base font-semibold text-white">{circle.payoutRequest.principalLabel}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/65 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Fee</p>
                <p className="mt-2 text-base font-semibold text-white">{circle.payoutRequest.feeLabel}</p>
              </div>
            </div>
          </section>

          <div className="space-y-4">
            <section className="rounded-[28px] border border-slate-800 bg-slate-900/68 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Current vs projected</p>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Current Circle balance: {circle.payoutRequest.currentBalanceLabel}
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                Projected after completion: {circle.payoutRequest.projectedBalanceAfterCompletionLabel}
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                Designated road-repair funds remain visible at {circle.treasury.designatedBalanceLabel}.
              </p>
            </section>
            <section className="rounded-[28px] border border-[#FFB05A]/25 bg-[#FFB05A]/8 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-[#FFD2A0]">This decision matters</p>
              <p className="mt-3 text-sm leading-7 text-[#FFE1B8]">
                Approval sends this request into processing. The payout still has to complete.
              </p>
            </section>
          </div>
        </div>
      </div>
    </ExperienceCenterShell>
  )
}

TundeApproval.propTypes = {
  simulationState: PropTypes.shape({}),
}

export default TundeApproval
