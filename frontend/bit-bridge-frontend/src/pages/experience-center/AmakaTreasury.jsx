import { useMemo } from 'react'
import PropTypes from 'prop-types'
import { useNavigate } from 'react-router-dom'
import ExperienceCenterShell from '../../components/experience-center/ExperienceCenterShell'
import {
  createGuidedStepState,
  getGuidedProgressLabel,
  getNextStepPath,
  getPreviousStepPath,
  saveExperienceCenterState,
} from '../../utils/experienceCenter'
import { deriveGreenfieldCircleView } from '../../utils/experienceCenterCircleDemo'

const AmakaTreasury = ({ simulationState }) => {
  const navigate = useNavigate()
  const circle = useMemo(() => deriveGreenfieldCircleView(simulationState), [simulationState])
  const nextPath = getNextStepPath('circle', 'amaka-treasury')
  const previousPath = getPreviousStepPath('circle', 'amaka-treasury')

  const continueToPayout = () => {
    saveExperienceCenterState(
      createGuidedStepState({
        experienceId: 'circle',
        stepId: 'prepare-payout',
        perspectiveId: 'amaka',
        simulationState,
      })
    )
    navigate(nextPath)
  }

  return (
    <ExperienceCenterShell
      currentExperienceId="circle"
      currentExperienceLabel="BitBridge Circle"
      currentPerspectiveId="amaka"
      currentStepId="amaka-treasury"
      pageTitle="Treasury"
      storyPanel={{
        eyebrow: 'Treasury and Circle account',
        perspectiveName: 'Amaka',
        perspectiveRole: 'Treasurer',
        title: 'Amaka can now see the funds available for the July vendor payment.',
        body: 'Collected dues are updated, road-repair funds remain designated, and available operating funds can support the next payment.',
        progressLabel: `${getGuidedProgressLabel('circle', 'amaka-treasury')} - Circle story`,
      }}
      guidedActions={[
        { label: 'Back', onClick: () => navigate(previousPath), state: 'enabled' },
        { label: 'Prepare Vendor Payment', onClick: continueToPayout, state: 'enabled' },
      ]}
    >
      <div className="max-w-5xl min-w-0 space-y-6">
        <div>
          <span className="rounded-full border border-[#FFB05A]/40 bg-[#FFB05A]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#FFE1B8]">
            Treasury
          </span>
          <h1 className="mt-8 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Greenfield now has enough available operating funds to prepare the July security payment.
          </h1>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-[28px] border border-slate-800 bg-slate-900/68 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Circle balance</p>
            <p className="mt-3 text-2xl font-semibold text-white">{circle.treasury.totalBalanceLabel}</p>
          </div>
          <div className="rounded-[28px] border border-slate-800 bg-slate-900/68 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Available operating funds</p>
            <p className="mt-3 text-2xl font-semibold text-white">{circle.treasury.availableBalanceLabel}</p>
          </div>
          <div className="rounded-[28px] border border-slate-800 bg-slate-900/68 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Designated road-repair funds</p>
            <p className="mt-3 text-2xl font-semibold text-white">{circle.treasury.designatedBalanceLabel}</p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
          <section className="rounded-[28px] border border-slate-800 bg-slate-900/68 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Greenfield Circle Account</p>
            <div className="mt-4 rounded-3xl border border-slate-800 bg-slate-950/65 p-5">
              <p className="text-lg font-semibold text-white">{circle.circleAccount.label}</p>
              <p className="mt-3 text-sm text-slate-300">Status: {circle.circleAccount.status}</p>
              <p className="mt-2 text-sm text-slate-300">Bank: {circle.circleAccount.bankName}</p>
              <p className="mt-2 text-sm text-slate-300">Account number: {circle.circleAccount.accountNumberMasked}</p>
              <p className="mt-2 text-sm text-slate-300">Purpose: {circle.circleAccount.purpose}</p>
            </div>
          </section>
          <section className="rounded-[28px] border border-slate-800 bg-slate-900/68 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{circle.externalInflow.title}</p>
            <p className="mt-4 text-2xl font-semibold text-white">{circle.externalInflow.subtitle}</p>
            <p className="mt-3 text-3xl font-semibold text-white">₦500,000</p>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              A road repair contribution was already recorded through the Circle account earlier this month.
            </p>
          </section>
        </div>
      </div>
    </ExperienceCenterShell>
  )
}

AmakaTreasury.propTypes = {
  simulationState: PropTypes.shape({}),
}

export default AmakaTreasury
