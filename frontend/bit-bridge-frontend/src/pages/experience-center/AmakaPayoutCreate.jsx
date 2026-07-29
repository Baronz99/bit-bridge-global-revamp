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
import { deriveGreenfieldCircleView, submitVendorPayoutRequest } from '../../utils/experienceCenterCircleDemo'

const AmakaPayoutCreate = ({ simulationState }) => {
  const navigate = useNavigate()
  const { renderedSimulationState, setRenderedSimulationState } = useRenderedSimulationState(simulationState)
  const circle = useMemo(
    () => deriveGreenfieldCircleView(renderedSimulationState),
    [renderedSimulationState]
  )
  const nextPath = getNextStepPath('circle', 'prepare-payout')
  const previousPath = getPreviousStepPath('circle', 'prepare-payout')
  const requestExists = circle.payoutSubmitted

  const persistForTunde = (nextSimulationState) => {
    const savedState = persistGuidedStepState({
      experienceId: 'circle',
      stepId: 'approve-payout',
      perspectiveId: 'tunde',
      simulationState: nextSimulationState,
    })
    setRenderedSimulationState(savedState.simulationState)
    return savedState
  }

  const navigateToTunde = () => {
    navigate(nextPath)
  }

  const submitForReview = () => {
    if (requestExists) return

    const nextSimulationState = submitVendorPayoutRequest(renderedSimulationState)
    persistForTunde(nextSimulationState)
  }

  const continueToTunde = () => {
    persistForTunde(renderedSimulationState)
    navigateToTunde()
  }

  return (
    <ExperienceCenterShell
      currentExperienceId="circle"
      currentExperienceLabel="BitBridge Circle"
      currentPerspectiveId="amaka"
      currentStepId="prepare-payout"
      pageTitle="Prepare Payout"
      storyPanel={{
        eyebrow: 'Vendor payment request',
        perspectiveName: 'Amaka',
        perspectiveRole: 'Treasurer',
        title: 'Amaka prepares the July security vendor payment.',
        body: requestExists
          ? 'Amaka has prepared the vendor payment. It is now awaiting review before money can move.'
          : 'She confirms the beneficiary, amount, and total projected outgoing before sending the request for review.',
        progressLabel: `${getGuidedProgressLabel('circle', 'prepare-payout')} - Circle story`,
      }}
      guidedActions={[
        { label: 'Back', onClick: () => navigate(previousPath), state: 'enabled' },
        requestExists
          ? { label: 'Continue to Tunde’s Review', onClick: continueToTunde, state: 'enabled' }
          : { label: 'Submit for Review', onClick: submitForReview, state: 'enabled' },
      ]}
    >
      <div className="max-w-5xl min-w-0 space-y-6">
        <div>
          <span className="rounded-full border border-[#FFB05A]/40 bg-[#FFB05A]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#FFE1B8]">
            Prepare Payout
          </span>
          <h1 className="mt-8 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            The estate security vendor is due, and Amaka prepares the payment.
          </h1>
        </div>

        {requestExists ? (
          <section className="rounded-[28px] border border-emerald-400/30 bg-emerald-400/10 p-5 text-emerald-100">
            <p className="text-xs font-semibold uppercase tracking-[0.24em]">Ready for review</p>
            <p className="mt-3 text-lg font-semibold text-white">Amaka has prepared the vendor payment.</p>
            <p className="mt-2 text-sm leading-7 text-emerald-100">
              Another manager still needs to review it before money moves.
            </p>
          </section>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.95fr)]">
          <section className="space-y-4 rounded-[28px] border border-slate-800 bg-slate-900/68 p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/65 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Beneficiary</p>
                <p className="mt-2 text-base font-semibold text-white">{circle.payoutRequest.beneficiaryName}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/65 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Bank account</p>
                <p className="mt-2 text-base font-semibold text-white">
                  {circle.payoutRequest.beneficiaryBank} - {circle.payoutRequest.beneficiaryAccountMasked}
                </p>
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
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Transfer fee</p>
                <p className="mt-2 text-base font-semibold text-white">{circle.payoutRequest.feeLabel}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/65 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Total projected outgoing</p>
                <p className="mt-2 text-base font-semibold text-white">{circle.payoutRequest.totalProjectedOutgoingLabel}</p>
              </div>
            </div>
          </section>

          <div className="space-y-4">
            <section className="rounded-[28px] border border-slate-800 bg-slate-900/68 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Circle context</p>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Current Circle balance: {circle.payoutRequest.currentBalanceLabel}
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                Projected balance after completion: {circle.payoutRequest.projectedBalanceAfterCompletionLabel}
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                Designated road-repair funds remain visible at {circle.treasury.designatedBalanceLabel}.
              </p>
            </section>
            <section className="rounded-[28px] border border-[#FFB05A]/25 bg-[#FFB05A]/8 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-[#FFD2A0]">Before this can move</p>
              <p className="mt-3 text-sm leading-7 text-[#FFE1B8]">
                Amaka can prepare the payment, but it remains awaiting review until another manager approves it.
              </p>
            </section>
          </div>
        </div>
      </div>
    </ExperienceCenterShell>
  )
}

AmakaPayoutCreate.propTypes = {
  simulationState: PropTypes.shape({}),
}

export default AmakaPayoutCreate
