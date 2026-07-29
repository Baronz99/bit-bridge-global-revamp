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

const CircleOverview = ({ simulationState }) => {
  const navigate = useNavigate()
  const circle = useMemo(() => deriveGreenfieldCircleView(simulationState), [simulationState])
  const member = circle.memberIdentity
  const nextPath = getNextStepPath('circle', 'overview')
  const previousPath = getPreviousStepPath('circle', 'overview')

  return (
    <ExperienceCenterShell
      currentExperienceId="circle"
      currentExperienceLabel="BitBridge Circle"
      currentStepId="overview"
      pageTitle="Circle Overview"
      storyPanel={{
        eyebrow: "Next: Emma's July levy",
        title: `${member.name} still needs to clear her July Security Levy.`,
        body: 'See the outstanding levy before July collections can close.',
        progressLabel: `${getGuidedProgressLabel('circle', 'overview')} - Circle story`,
      }}
      guidedActions={[
        { label: 'Back', onClick: () => navigate(previousPath), state: 'enabled' },
        { label: "See Emma's Obligation", onClick: () => navigate(nextPath), state: 'enabled' },
      ]}
    >
      <div className="max-w-4xl min-w-0 space-y-7">
        <div>
          <span className="rounded-full border border-[#FFB05A]/40 bg-[#FFB05A]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#FFE1B8]">
            Greenfield Circle
          </span>
          <h1 className="mt-8 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Greenfield begins July with an active Circle balance and outstanding dues.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            The Circle already has funds, but July collections are still open because one levy
            remains unpaid.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-[28px] border border-slate-800 bg-slate-900/68 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Circle balance</p>
            <p className="mt-3 text-3xl font-semibold text-white">{circle.treasury.totalBalanceLabel}</p>
          </section>
          <section className="rounded-[28px] border border-slate-800 bg-slate-900/68 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">July dues outstanding</p>
            <p className="mt-3 text-3xl font-semibold text-white">{circle.collectionSummary.outstandingLabel}</p>
          </section>
        </div>

        <div className="space-y-4">
          <p className="max-w-3xl text-sm leading-7 text-slate-300">
            Some of Greenfield&apos;s existing funds are already designated for another community project.
          </p>
          <div className="rounded-[28px] border border-[#FFB05A]/25 bg-[#FFB05A]/8 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#FFD2A0]">Next</p>
            <p className="mt-3 text-lg font-semibold text-white">Emma still has one outstanding July Security Levy.</p>
            <p className="mt-2 text-sm text-[#FFE1B8]">
              {member.name} {'\u2022'} {member.contextLabel}
            </p>
          </div>
        </div>
      </div>
    </ExperienceCenterShell>
  )
}

CircleOverview.propTypes = {
  simulationState: PropTypes.shape({}),
}

export default CircleOverview
