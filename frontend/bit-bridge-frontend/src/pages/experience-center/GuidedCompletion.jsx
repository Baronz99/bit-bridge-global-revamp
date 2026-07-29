import { useNavigate } from 'react-router-dom'
import ExperienceCenterShell from '../../components/experience-center/ExperienceCenterShell'
import {
  createGuidedStepState,
  getExperienceCenterState,
  getGuidedProgressLabel,
  getNextStepPath,
  getPreviousStepPath,
  saveExperienceCenterState,
} from '../../utils/experienceCenter'

const GuidedCompletion = () => {
  const navigate = useNavigate()
  const nextPath = getNextStepPath('circle', 'guided-complete')
  const previousPath = getPreviousStepPath('circle', 'guided-complete')

  const enterFreeExplore = () => {
    const existingState = getExperienceCenterState()
    saveExperienceCenterState(
      createGuidedStepState({
        experienceId: 'circle',
        stepId: 'free-explore',
        perspectiveId: 'amaka',
        completedEventIds: existingState.completedEventIds,
      })
    )
    navigate(nextPath)
  }

  return (
    <ExperienceCenterShell
      currentExperienceId="circle"
      currentExperienceLabel="Circle"
      currentPerspectiveId="amaka"
      currentStepId="guided-complete"
      pageTitle="Guided Completion"
      storyPanel={{
        eyebrow: 'Guided completion',
        perspectiveName: 'Amaka',
        perspectiveRole: 'Treasurer',
        title: 'The investor has now seen the full Circle operating loop.',
        body: 'The guided sequence has done its job: member obligation, payment, collections, treasury, governance, approval, completion, timeline, and audit all landed in one coherent story.',
        insight:
          'The next step removes the rails without dropping the investor into the full production application. Free Explore stays curated and demo-safe.',
        proofPoint:
          'The Greenfield story remained fixture-driven and isolated from production throughout the full guided journey.',
        progressLabel: `${getGuidedProgressLabel('circle', 'guided-complete')} | Guided Circle story`,
      }}
      guidedActions={[
        { label: 'Back', onClick: () => navigate(previousPath), state: 'enabled' },
        { label: 'Enter Free Explore', onClick: enterFreeExplore, state: 'enabled' },
        {
          label: 'Skip',
          state: 'unavailable',
          reason: 'Free Explore is the intended handoff after the guided story finishes.',
        },
        {
          label: 'Resume',
          state: 'disabled',
          reason: 'You are already on the guided completion step.',
        },
      ]}
    >
      <div className="max-w-4xl min-w-0 space-y-8">
        <div>
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100">
            Guided story complete
          </span>
          <h1 className="mt-8 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-[3.35rem] lg:leading-[1.04]">
            Circle now feels like a financial operating system, not a feature.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            You have seen how BitBridge can help a real-world group collect money, protect
            restricted funds, separate operating roles, approve decisions, and preserve the
            organization&apos;s history in one place.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[30px] border border-slate-800 bg-slate-900/68 p-6">
            <p className="text-lg font-semibold text-white">Members stay informed</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Emma saw what she owed, why it mattered, and what changed after payment.
            </p>
          </div>
          <div className="rounded-[30px] border border-slate-800 bg-slate-900/68 p-6">
            <p className="text-lg font-semibold text-white">Operators stay in control</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Amaka saw collections, treasury context, and the result of governance decisions.
            </p>
          </div>
          <div className="rounded-[30px] border border-slate-800 bg-slate-900/68 p-6">
            <p className="text-lg font-semibold text-white">Approvals stay accountable</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Tunde reviewed and approved a payout without collapsing preparation and approval into
              one person.
            </p>
          </div>
        </div>
      </div>
    </ExperienceCenterShell>
  )
}

export default GuidedCompletion
