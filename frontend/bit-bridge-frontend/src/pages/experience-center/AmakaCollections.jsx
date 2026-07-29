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

const AmakaCollections = ({ simulationState }) => {
  const navigate = useNavigate()
  const circle = useMemo(() => deriveGreenfieldCircleView(simulationState), [simulationState])
  const collection = circle.collections[0]
  const member = circle.memberIdentity
  const nextPath = getNextStepPath('circle', 'amaka-collections')
  const previousPath = getPreviousStepPath('circle', 'amaka-collections')

  const continueToTreasury = () => {
    saveExperienceCenterState(
      createGuidedStepState({
        experienceId: 'circle',
        stepId: 'amaka-treasury',
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
      currentStepId="amaka-collections"
      pageTitle="Collections"
      storyPanel={{
        eyebrow: 'Collections after payment',
        perspectiveName: 'Amaka',
        perspectiveRole: 'Treasurer',
        title: 'When Amaka checks in, the payment is already there.',
        body: 'Collected dues are higher, outstanding dues are lower, and the July collection is more complete.',
        progressLabel: `${getGuidedProgressLabel('circle', 'amaka-collections')} - Circle story`,
      }}
      guidedActions={[
        { label: 'Back', onClick: () => navigate(previousPath), state: 'enabled' },
        { label: 'Review Treasury', onClick: continueToTreasury, state: 'enabled' },
      ]}
    >
      <div className="max-w-5xl min-w-0 space-y-6">
        <div>
          <span className="rounded-full border border-[#FFB05A]/40 bg-[#FFB05A]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#FFE1B8]">
            Amaka - Treasurer
          </span>
          <h1 className="mt-8 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            {member.shortName}&apos;s payment is now visible in July collections.
          </h1>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
          <section className="space-y-4 rounded-[28px] border border-slate-800 bg-slate-900/68 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">July dues</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">{collection.name}</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/65 px-4 py-4">
                <span className="block text-[11px] uppercase tracking-[0.24em] text-slate-500">Expected</span>
                <span className="mt-2 block text-lg font-semibold text-white">{circle.collectionSummary.expectedLabel}</span>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/65 px-4 py-4">
                <span className="block text-[11px] uppercase tracking-[0.24em] text-slate-500">Collected</span>
                <span className="mt-2 block text-lg font-semibold text-white">{circle.collectionSummary.collectedLabel}</span>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/65 px-4 py-4">
                <span className="block text-[11px] uppercase tracking-[0.24em] text-slate-500">Outstanding</span>
                <span className="mt-2 block text-lg font-semibold text-white">{circle.collectionSummary.outstandingLabel}</span>
              </div>
            </div>
          </section>

          <div className="space-y-4">
            <section className="rounded-[28px] border border-emerald-400/30 bg-emerald-400/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100">Recorded just now</p>
              <p className="mt-3 text-lg font-semibold text-white">{member.name} paid July Security Levy</p>
              <p className="mt-2 text-sm text-emerald-100">{member.residenceLabel}</p>
              <p className="mt-2 text-sm text-emerald-100">+₦25,000</p>
            </section>
            <section className="rounded-[28px] border border-slate-800 bg-slate-900/68 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Participation</p>
              <p className="mt-3 text-lg font-semibold text-white">{circle.collectionSummary.paidMembers} households recorded</p>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                {circle.collectionSummary.unpaidMembers} households still need to pay.
              </p>
            </section>
          </div>
        </div>
      </div>
    </ExperienceCenterShell>
  )
}

AmakaCollections.propTypes = {
  simulationState: PropTypes.shape({}),
}

export default AmakaCollections
