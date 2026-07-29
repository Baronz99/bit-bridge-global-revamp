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

const ChidiObligations = ({ simulationState }) => {
  const navigate = useNavigate()
  const circle = useMemo(() => deriveGreenfieldCircleView(simulationState), [simulationState])
  const member = circle.memberIdentity
  const nextPath = getNextStepPath('circle', 'chidi-obligation')
  const previousPath = getPreviousStepPath('circle', 'chidi-obligation')

  return (
    <ExperienceCenterShell
      currentExperienceId="circle"
      currentExperienceLabel="BitBridge Circle"
      currentPerspectiveId="chidi"
      currentStepId="chidi-obligation"
      pageTitle="Member Obligation"
      storyPanel={{
        eyebrow: 'Emma this month',
        perspectiveName: member.name,
        perspectiveRole: member.role,
        title: `For ${member.shortName}, July comes down to one unpaid levy.`,
        body: 'She can see what it is for, when it is due, and how she will pay it.',
        progressLabel: `${getGuidedProgressLabel('circle', 'chidi-obligation')} - Circle story`,
      }}
      guidedActions={[
        { label: 'Back', onClick: () => navigate(previousPath), state: 'enabled' },
        { label: 'Review Payment', onClick: () => navigate(nextPath), state: 'enabled' },
      ]}
    >
      <div className="max-w-5xl min-w-0 space-y-6">
        <div>
          <span className="rounded-full border border-[#FFB05A]/40 bg-[#FFB05A]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#FFE1B8]">
            {member.name} - {member.contextLabel}
          </span>
          <h1 className="mt-8 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            {member.shortName} can review her outstanding July levy before paying.
          </h1>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.9fr)]">
          <section className="space-y-4 rounded-[28px] border border-slate-800 bg-slate-900/68 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Current obligation</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">{circle.obligation.label}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">{circle.obligation.purpose}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/65 px-4 py-4">
                <span className="block text-[11px] uppercase tracking-[0.24em] text-slate-500">Amount</span>
                <span className="mt-2 block text-lg font-semibold text-white">{circle.obligation.amountLabel}</span>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/65 px-4 py-4">
                <span className="block text-[11px] uppercase tracking-[0.24em] text-slate-500">Due status</span>
                <span className="mt-2 block text-lg font-semibold text-white">{circle.obligation.status}</span>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/65 px-4 py-4">
                <span className="block text-[11px] uppercase tracking-[0.24em] text-slate-500">Due timing</span>
                <span className="mt-2 block text-lg font-semibold text-white">{circle.obligation.dueContext}</span>
              </div>
            </div>
          </section>

          <div className="space-y-4">
            <section className="rounded-[28px] border border-slate-800 bg-slate-900/68 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Member</p>
              <p className="mt-3 text-lg font-semibold text-white">{member.name}</p>
              <p className="mt-2 text-sm leading-7 text-slate-300">{member.contextLabel}</p>
            </section>
            <section className="rounded-[28px] border border-slate-800 bg-slate-900/68 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Pay from</p>
              <p className="mt-3 text-lg font-semibold text-white">BitBridge NGN Wallet</p>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Available before payment: {circle.wallet.balanceCurrentLabel}
              </p>
            </section>
            <section className="rounded-[28px] border border-[#FFB05A]/25 bg-[#FFB05A]/8 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#FFD2A0]">Ready to pay</p>
              <p className="mt-3 text-sm leading-7 text-[#FFE1B8]">
                Emma can see the levy, confirm the amount, and pay it from her BitBridge NGN Wallet.
              </p>
            </section>
          </div>
        </div>
      </div>
    </ExperienceCenterShell>
  )
}

ChidiObligations.propTypes = {
  simulationState: PropTypes.shape({}),
}

export default ChidiObligations
