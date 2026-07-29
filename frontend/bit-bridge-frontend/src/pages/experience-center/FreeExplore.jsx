import { useMemo } from 'react'
import PropTypes from 'prop-types'
import { useNavigate } from 'react-router-dom'
import ExperienceCenterShell from '../../components/experience-center/ExperienceCenterShell'
import {
  EXPERIENCE_CENTER_SELECTION_PATH,
  buildGuidedStepPath,
  getGuidedProgressLabel,
  getPreviousStepPath,
} from '../../utils/experienceCenter'
import { deriveGreenfieldCircleView } from '../../utils/experienceCenterCircleDemo'

const exploreCards = [
  {
    id: 'overview',
    title: 'Circle Overview',
    body: 'Return to the opening balance, collections picture, and the shape of Greenfield at the start of the month.',
    targetStepId: 'overview',
  },
  {
    id: 'member-payment',
    title: 'Member Payment',
    body: 'Replay the moment one household payment changed the group record.',
    targetStepId: 'member-payment',
  },
  {
    id: 'treasury',
    title: 'Treasury',
    body: 'Revisit the Circle account, available funds, and the money Greenfield set aside.',
    targetStepId: 'amaka-treasury',
  },
  {
    id: 'activity-audit',
    title: 'Activity, Audit and Statement',
    body: 'Return to the final record of how the month ended.',
    targetStepId: 'activity-audit',
  },
]

const FreeExplore = ({ simulationState }) => {
  const navigate = useNavigate()
  const circle = useMemo(() => deriveGreenfieldCircleView(simulationState), [simulationState])
  const previousPath = getPreviousStepPath('circle', 'free-explore')

  return (
    <ExperienceCenterShell
      currentExperienceId="circle"
      currentExperienceLabel="BitBridge Circle"
      currentPerspectiveId="amaka"
      currentStepId="free-explore"
      pageTitle="Explore BitBridge"
      storyPanel={{
        eyebrow: 'Month complete',
        perspectiveName: 'Amaka',
        perspectiveRole: 'Treasurer',
        title: 'You have completed one Circle financial cycle.',
        body: 'July collections, shared treasury, controlled payout, and final records are now visible.',
        progressLabel: `${getGuidedProgressLabel('circle', 'free-explore')} - Circle story`,
      }}
      guidedActions={[
        { label: 'Back', onClick: () => navigate(previousPath), state: 'enabled' },
        { label: 'Choose Another Experience', onClick: () => navigate(EXPERIENCE_CENTER_SELECTION_PATH), state: 'enabled' },
      ]}
    >
      <div className="max-w-5xl min-w-0 space-y-8">
        <div>
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100">
            Guided story complete
          </span>
          <h1 className="mt-8 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-[3.3rem] lg:leading-[1.04]">
            Greenfield&apos;s July financial cycle is now complete.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            Emma&apos;s payment was recorded, the vendor payout completed, and the final records are now visible.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-[30px] border border-slate-800 bg-slate-900/68 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Final Circle balance</p>
            <p className="mt-3 text-2xl font-semibold text-white">{circle.treasury.totalBalanceLabel}</p>
          </div>
          <div className="rounded-[30px] border border-slate-800 bg-slate-900/68 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Available operating funds</p>
            <p className="mt-3 text-2xl font-semibold text-white">{circle.treasury.availableBalanceLabel}</p>
          </div>
          <div className="rounded-[30px] border border-slate-800 bg-slate-900/68 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Designated road-repair funds</p>
            <p className="mt-3 text-2xl font-semibold text-white">{circle.treasury.designatedBalanceLabel}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[24px] border border-slate-800 bg-slate-900/68 px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Optional next chapter</p>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
              If you want, you can now look beyond Greenfield and explore the wider BitBridge product.
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {exploreCards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => navigate(buildGuidedStepPath('circle', card.targetStepId))}
                className="group rounded-[30px] border border-slate-800 bg-slate-900/68 p-6 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-600 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB05A] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xl font-semibold text-white">{card.title}</p>
                  <span className="rounded-full border border-slate-700 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 transition group-hover:border-[#FFB05A]/40 group-hover:text-[#FFE1B8]">
                    Open
                  </span>
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-300">{card.body}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {['Transfers', 'Virtual Accounts', 'Cards', 'Utility Payments', 'Statements', 'Business Payments'].map((label) => (
            <div key={label} className="rounded-[24px] border border-slate-800 bg-slate-900/68 px-5 py-5 text-sm font-semibold text-white">
              {label}
            </div>
          ))}
        </div>
      </div>
    </ExperienceCenterShell>
  )
}

FreeExplore.propTypes = {
  simulationState: PropTypes.shape({}),
}

export default FreeExplore
