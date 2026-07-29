import { useNavigate } from 'react-router-dom'
import ExperienceCenterShell from '../../components/experience-center/ExperienceCenterShell'
import {
  buildGuidedStepPath,
  createGuidedStepState,
  getExperienceCenterState,
  getResumePath,
  saveExperienceCenterState,
} from '../../utils/experienceCenter'
import { GREENFIELD_CIRCLE_FIXTURE } from '../../utils/experienceCenterDemoData'

const Landing = () => {
  const navigate = useNavigate()
  const persistedState = getExperienceCenterState()
  const resumePath = getResumePath(persistedState)
  const introPath = buildGuidedStepPath('circle', 'intro')

  const beginExperience = () => {
    saveExperienceCenterState(
      createGuidedStepState({
        experienceId: 'circle',
        stepId: 'intro',
        perspectiveId: 'chidi',
        simulationState: persistedState.simulationState,
      })
    )
    navigate(introPath)
  }

  return (
    <ExperienceCenterShell
      currentExperienceLabel="BitBridge Global"
      pageTitle="BitBridge Global"
      storyPanel={{
        eyebrow: 'BitBridge Global',
        title: "What you'll experience",
        body: 'A resident pays an overdue levy. The treasurer sees the change. Another manager reviews a vendor payment before it moves.',
        insight: GREENFIELD_CIRCLE_FIXTURE.chapterDisclosure,
        insightLabel: 'About this demo',
        proofPoint: '3-5 minutes',
        proofPointLabel: 'Estimated time',
        progressLabel: 'Start here',
      }}
      guidedActions={[
        { label: 'Begin', onClick: beginExperience, state: 'enabled' },
        resumePath
          ? { label: 'Resume', onClick: () => navigate(resumePath), state: 'enabled' }
          : { hidden: true, label: 'Resume' },
      ]}
    >
      <div className="max-w-4xl min-w-0 space-y-8">
        <div className="flex flex-wrap gap-3">
          <span className="rounded-full border border-[#FFB05A]/40 bg-[#FFB05A]/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#FFE0BA]">
            Investor demo
          </span>
          <span className="rounded-full border border-slate-700 bg-slate-900/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">
            Community finance story
          </span>
        </div>

        <div className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-[3.7rem] lg:leading-[1.02]">
            Experience one month of shared money, from contribution to payout.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Follow Greenfield Residents Association, a fictional community of{' '}
            {GREENFIELD_CIRCLE_FIXTURE.memberCount} households created for this guided experience.
            One levy comes due. One member pays. One vendor still needs to be paid before the
            month can close cleanly.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
            <p className="text-base font-semibold text-white">People know what they owe</p>
            <p className="mt-3 text-sm leading-6 text-slate-400">One clear levy. One clear next step.</p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
            <p className="text-base font-semibold text-white">Shared money stays visible</p>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              The group can see what came in and what still needs attention.
            </p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
            <p className="text-base font-semibold text-white">Spending stays reviewed</p>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              One person prepares the payment. Another still reviews it.
            </p>
          </div>
        </div>
      </div>
    </ExperienceCenterShell>
  )
}

export default Landing
