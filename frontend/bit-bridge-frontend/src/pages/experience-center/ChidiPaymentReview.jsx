import { useEffect, useMemo, useRef, useState } from 'react'
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
import { deriveGreenfieldCircleView, recordChidiPayment } from '../../utils/experienceCenterCircleDemo'
import {
  getMemberPaymentInitialPhase,
  getMemberPaymentUiState,
  MEMBER_PAYMENT_TRANSITION_REASON,
} from '../../utils/experienceCenterMemberPayment'

const formatNaira = (amount, fractionDigits = 0) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount)

const ChidiPaymentReview = ({ simulationState }) => {
  const navigate = useNavigate()
  const { renderedSimulationState, setRenderedSimulationState } = useRenderedSimulationState(simulationState)
  const [phase, setPhase] = useState(() => getMemberPaymentInitialPhase(simulationState))
  const timersRef = useRef([])

  useEffect(() => {
    setPhase(getMemberPaymentInitialPhase(simulationState))
  }, [simulationState])

  useEffect(
    () => () => {
      timersRef.current.forEach((timerId) => window.clearTimeout(timerId))
      timersRef.current = []
    },
    []
  )

  const circle = useMemo(() => deriveGreenfieldCircleView(renderedSimulationState), [renderedSimulationState])
  const member = circle.memberIdentity
  const nextPath = getNextStepPath('circle', 'member-payment')
  const previousPath = getPreviousStepPath('circle', 'member-payment')
  const { isCompleted, isTransitioning, backActionState, primaryActionLabel, primaryActionState } =
    getMemberPaymentUiState({ simulationState: renderedSimulationState, phase })

  const finishPayment = () => {
    const nextSimulationState = recordChidiPayment(getExperienceCenterState().simulationState)
    const savedState = persistGuidedStepState({
      experienceId: 'circle',
      stepId: 'member-payment',
      perspectiveId: 'chidi',
      simulationState: nextSimulationState,
    })

    timersRef.current = []
    setRenderedSimulationState(savedState.simulationState)
    setPhase('recorded')
  }

  const pay = () => {
    if (isTransitioning) return

    if (isCompleted) {
      navigate(nextPath)
      return
    }

    setPhase('recording')
    timersRef.current.forEach((timerId) => window.clearTimeout(timerId))
    timersRef.current = [
      window.setTimeout(() => setPhase('updating'), 600),
      window.setTimeout(finishPayment, 1300),
    ]
  }

  const afterCircle = isCompleted ? circle : deriveGreenfieldCircleView(recordChidiPayment(renderedSimulationState))

  return (
    <ExperienceCenterShell
      currentExperienceId="circle"
      currentExperienceLabel="BitBridge Circle"
      currentPerspectiveId="chidi"
      currentStepId="member-payment"
      pageTitle="Member Payment"
      storyPanel={{
        eyebrow: 'Payment moment',
        perspectiveName: member.name,
        perspectiveRole: member.role,
        title: `This is the moment ${member.shortName} clears her July levy.`,
        body: isCompleted
          ? "Emma's payment is recorded. Now see what changed for Amaka, Greenfield's Treasurer."
          : `${member.shortName} pays from her BitBridge NGN Wallet while the Circle record updates around her.`,
        progressLabel: `${getGuidedProgressLabel('circle', 'member-payment')} - Circle story`,
      }}
      guidedActions={[
        {
          label: 'Back',
          onClick: () => navigate(previousPath),
          state: backActionState,
          reason: isTransitioning ? MEMBER_PAYMENT_TRANSITION_REASON : '',
        },
        {
          label: primaryActionLabel,
          onClick: pay,
          state: primaryActionState,
          reason: isTransitioning ? 'Recording payment and updating Circle records.' : '',
        },
      ]}
    >
      <div className="max-w-5xl min-w-0 space-y-6">
        <div>
          <span className="rounded-full border border-[#FFB05A]/40 bg-[#FFB05A]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#FFE1B8]">
            Member Payment
          </span>
          <h1 className="mt-8 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            {member.name} pays her levy, and the July record updates immediately.
          </h1>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.9fr)]">
          <section className="space-y-4 rounded-[28px] border border-slate-800 bg-slate-900/68 p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/65 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Member</p>
                <p className="mt-2 text-base font-semibold text-white">{member.name}</p>
                <p className="mt-2 text-sm text-slate-300">{member.role}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/65 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Residence</p>
                <p className="mt-2 text-base font-semibold text-white">{member.residenceLabel}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/65 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Levy</p>
                <p className="mt-2 text-base font-semibold text-white">{circle.obligation.label}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/65 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Amount</p>
                <p className="mt-2 text-base font-semibold text-white">{circle.obligation.amountLabel}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/65 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Funding source</p>
                <p className="mt-2 text-base font-semibold text-white">{circle.memberPayment.fundingSourceLabel}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/65 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Wallet before payment</p>
                <p className="mt-2 text-base font-semibold text-white">{circle.memberPayment.beforeBalanceLabel}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-[#FFB05A]/25 bg-[#FFB05A]/8 p-4 text-sm leading-7 text-[#FFE1B8]">
              This payment is simulated for the demo. No real money moves.
            </div>
          </section>

          <section
            aria-live="polite"
            aria-busy={isTransitioning}
            className="space-y-4 rounded-[28px] border border-slate-800 bg-slate-900/68 p-6"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">What happens next</p>
            <div
              className={`rounded-2xl border px-4 py-4 transition-all duration-500 ${
                phase === 'recording'
                  ? 'border-[#FFB05A]/40 bg-[#FFB05A]/10 text-[#FFE1B8]'
                  : 'border-slate-800 bg-slate-950/65 text-slate-300'
              }`}
            >
              Recording payment
            </div>
            <div
              className={`rounded-2xl border px-4 py-4 transition-all duration-500 ${
                phase === 'updating'
                  ? 'border-[#FFB05A]/40 bg-[#FFB05A]/10 text-[#FFE1B8]'
                  : 'border-slate-800 bg-slate-950/65 text-slate-300'
              }`}
            >
              Updating Circle records
            </div>
            <div
              className={`rounded-2xl border px-4 py-4 transition-all duration-500 ${
                isCompleted || phase === 'recorded'
                  ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
                  : 'border-slate-800 bg-slate-950/65 text-slate-300'
              }`}
            >
              Payment recorded
            </div>
          </section>
        </div>

        {isCompleted ? (
          <>
            <div className="rounded-[28px] border border-emerald-400/30 bg-emerald-400/10 p-5 text-emerald-100">
              <p className="text-xs font-semibold uppercase tracking-[0.24em]">Payment complete</p>
              <p className="mt-3 text-lg font-semibold text-white">Emma's payment is recorded.</p>
              <p className="mt-2 text-sm leading-7 text-emerald-100">
                Now see what changed for Amaka, Greenfield's Treasurer.
              </p>
            </div>

            <section className="grid gap-4 lg:grid-cols-4">
              <div className="rounded-[28px] border border-slate-800 bg-slate-900/68 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Wallet after payment</p>
                <p className="mt-3 text-xl font-semibold text-white">{circle.wallet.balanceCurrentLabel}</p>
              </div>
              <div className="rounded-[28px] border border-slate-800 bg-slate-900/68 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Circle balance</p>
                <p className="mt-3 text-xl font-semibold text-white">{circle.treasury.totalBalanceLabel}</p>
              </div>
              <div className="rounded-[28px] border border-slate-800 bg-slate-900/68 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Collected dues</p>
                <p className="mt-3 text-xl font-semibold text-white">{circle.collectionSummary.collectedLabel}</p>
              </div>
              <div className="rounded-[28px] border border-slate-800 bg-slate-900/68 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Outstanding dues</p>
                <p className="mt-3 text-xl font-semibold text-white">{circle.collectionSummary.outstandingLabel}</p>
              </div>
            </section>
          </>
        ) : (
          <section className="rounded-[28px] border border-slate-800 bg-slate-900/68 p-6 text-sm leading-7 text-slate-300">
            Before this payment, Emma's July levy is still outstanding. After it is recorded, her
            wallet moves from {circle.memberPayment.beforeBalanceLabel} to{' '}
            {formatNaira(afterCircle.wallet.balanceCurrent)}, and the Circle balance rises to{' '}
            {formatNaira(afterCircle.treasury.totalBalance)}.
          </section>
        )}
      </div>
    </ExperienceCenterShell>
  )
}

ChidiPaymentReview.propTypes = {
  simulationState: PropTypes.shape({}),
}

export default ChidiPaymentReview
