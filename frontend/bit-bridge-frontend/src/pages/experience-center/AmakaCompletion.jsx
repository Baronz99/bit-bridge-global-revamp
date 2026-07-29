import { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { useNavigate } from 'react-router-dom'
import ExperienceCenterShell from '../../components/experience-center/ExperienceCenterShell'
import useRenderedSimulationState from '../../hooks/useRenderedSimulationState'
import {
  getExperienceCenterState,
  getGuidedProgressLabel,
  getNextStepPath,
  persistGuidedStepState,
  getPreviousStepPath,
} from '../../utils/experienceCenter'
import { completeVendorPayout, deriveGreenfieldCircleView } from '../../utils/experienceCenterCircleDemo'

const AmakaCompletion = ({ simulationState }) => {
  const navigate = useNavigate()
  const { renderedSimulationState, setRenderedSimulationState } = useRenderedSimulationState(simulationState)
  const [phase, setPhase] = useState('approved')
  const circle = useMemo(
    () => deriveGreenfieldCircleView(renderedSimulationState),
    [renderedSimulationState]
  )
  const nextPath = getNextStepPath('circle', 'treasury-update')
  const previousPath = getPreviousStepPath('circle', 'treasury-update')
  const isCompleted = circle.payoutCompleted

  useEffect(() => {
    if (isCompleted) {
      setPhase('completed')
      return undefined
    }

    const timers = [
      window.setTimeout(() => setPhase('submitting'), 300),
      window.setTimeout(() => setPhase('processing'), 1000),
      window.setTimeout(() => {
        const nextSimulationState = completeVendorPayout(getExperienceCenterState().simulationState)
        const savedState = persistGuidedStepState({
          experienceId: 'circle',
          stepId: 'treasury-update',
          perspectiveId: 'amaka',
          simulationState: nextSimulationState,
        })
        setRenderedSimulationState(savedState.simulationState)
        setPhase('completed')
      }, 1900),
    ]

    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [isCompleted])

  const completedCircle = isCompleted
    ? circle
    : deriveGreenfieldCircleView(completeVendorPayout(renderedSimulationState))

  return (
    <ExperienceCenterShell
      currentExperienceId="circle"
      currentExperienceLabel="BitBridge Circle"
      currentPerspectiveId="amaka"
      currentStepId="treasury-update"
      pageTitle="Payout Processing and Completion"
      storyPanel={{
        eyebrow: 'From approval to completion',
        perspectiveName: 'Amaka',
        perspectiveRole: 'Treasurer',
        title: 'The payout moves from approval to completed movement.',
        body: isCompleted
          ? 'The vendor has been paid. The balance is lower by principal and fee, and the road-repair money is untouched.'
          : 'Tunde has approved the request. The payout is now moving through processing.',
        progressLabel: `${getGuidedProgressLabel('circle', 'treasury-update')} - Circle story`,
      }}
      guidedActions={[
        {
          label: 'Back',
          onClick: () => navigate(previousPath),
          state: isCompleted ? 'enabled' : 'disabled',
          reason: 'Wait for the simulated payout rail to finish.',
        },
        isCompleted
          ? { label: 'See Activity, Audit and Statement', onClick: () => navigate(nextPath), state: 'enabled' }
          : { label: 'Processing...', state: 'unavailable', reason: 'The payout is still processing.' },
      ]}
    >
      <div className="max-w-5xl min-w-0 space-y-6">
        <div>
          <span className="rounded-full border border-[#FFB05A]/40 bg-[#FFB05A]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#FFE1B8]">
            Treasury Update
          </span>
          <h1 className="mt-8 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Approval is complete. The payout now moves into processing and then completes.
          </h1>
        </div>

        <section className="grid gap-4 lg:grid-cols-4">
          {['approved', 'submitting', 'processing', 'completed'].map((step) => {
            const active =
              phase === step || (step === 'approved' && ['submitting', 'processing', 'completed'].includes(phase))
            const done = ['completed'].includes(phase) && step !== 'completed'
            return (
              <div
                key={step}
                className={`rounded-[28px] border px-5 py-5 ${
                  active || done
                    ? step === 'completed'
                      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
                      : 'border-[#FFB05A]/40 bg-[#FFB05A]/10 text-[#FFE1B8]'
                    : 'border-slate-800 bg-slate-900/68 text-slate-300'
                }`}
              >
                <p className="text-xs uppercase tracking-[0.24em]">
                  {step === 'approved'
                    ? 'Approved'
                    : step === 'submitting'
                      ? 'Submitting payment'
                      : step === 'processing'
                        ? 'Processing'
                        : 'Completed'}
                </p>
              </div>
            )
          })}
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-[28px] border border-slate-800 bg-slate-900/68 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Circle balance</p>
            <p className="mt-3 text-2xl font-semibold text-white">{completedCircle.treasury.totalBalanceLabel}</p>
          </div>
          <div className="rounded-[28px] border border-slate-800 bg-slate-900/68 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Available operating funds</p>
            <p className="mt-3 text-2xl font-semibold text-white">{completedCircle.treasury.availableBalanceLabel}</p>
          </div>
          <div className="rounded-[28px] border border-slate-800 bg-slate-900/68 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Designated road-repair funds</p>
            <p className="mt-3 text-2xl font-semibold text-white">{completedCircle.treasury.designatedBalanceLabel}</p>
          </div>
        </section>
      </div>
    </ExperienceCenterShell>
  )
}

AmakaCompletion.propTypes = {
  simulationState: PropTypes.shape({}),
}

export default AmakaCompletion
