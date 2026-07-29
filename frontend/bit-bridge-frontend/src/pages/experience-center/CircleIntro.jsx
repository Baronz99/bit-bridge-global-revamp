import { useNavigate } from 'react-router-dom'
import ExperienceCenterShell from '../../components/experience-center/ExperienceCenterShell'
import {
  getGuidedProgressLabel,
  getNextStepPath,
  getPreviousStepPath,
} from '../../utils/experienceCenter'
import { GREENFIELD_CIRCLE_FIXTURE } from '../../utils/experienceCenterDemoData'

const CircleIntro = () => {
  const navigate = useNavigate()
  const nextPath = getNextStepPath('circle', 'intro')
  const previousPath = getPreviousStepPath('circle', 'intro')

  return (
    <ExperienceCenterShell
      currentExperienceId="circle"
      currentExperienceLabel="BitBridge Circle"
      currentStepId="intro"
      pageTitle="Greenfield Introduction"
      storyPanel={{
        eyebrow: 'Greenfield this month',
        title: 'One July levy remains outstanding, and one vendor payment still awaits review.',
        body: 'Emma Carter still needs to pay. Amaka still needs approval before the vendor payment can move.',
        progressLabel: `${getGuidedProgressLabel('circle', 'intro')} - Circle story`,
      }}
      guidedActions={[
        { label: 'Back', onClick: () => navigate(previousPath), state: 'enabled' },
        { label: 'See Greenfield Today', onClick: () => navigate(nextPath), state: 'enabled' },
      ]}
    >
      <div className="max-w-4xl min-w-0 space-y-6">
        <div>
          <span className="rounded-full border border-[#FFB05A]/40 bg-[#FFB05A]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#FFE1B8]">
            Greenfield scenario
          </span>
          <h1 className="mt-8 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Meet {GREENFIELD_CIRCLE_FIXTURE.name}.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            Greenfield is a residents association with {GREENFIELD_CIRCLE_FIXTURE.memberCount}{' '}
            households. In this July collection cycle, one resident still needs to pay and one
            vendor payment still needs review before money leaves the group.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-[28px] border border-slate-800 bg-slate-900/68 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">First</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Emma still has one outstanding July levy.
            </p>
          </div>
          <div className="rounded-[28px] border border-slate-800 bg-slate-900/68 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Then</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Amaka sees what has been collected and what operating funds are available.
            </p>
          </div>
          <div className="rounded-[28px] border border-slate-800 bg-slate-900/68 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Finally</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Tunde reviews the vendor payment request before it can move.
            </p>
          </div>
        </div>
      </div>
    </ExperienceCenterShell>
  )
}

export default CircleIntro
