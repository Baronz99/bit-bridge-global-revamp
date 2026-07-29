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

const CircleAudit = ({ completedEventIds = [] }) => {
  const navigate = useNavigate()
  const circle = useMemo(
    () => deriveGreenfieldCircleView({ completedEventIds }),
    [completedEventIds]
  )
  const nextPath = getNextStepPath('circle', 'audit')
  const previousPath = getPreviousStepPath('circle', 'audit')

  return (
    <ExperienceCenterShell
      currentExperienceId="circle"
      currentExperienceLabel="Circle"
      currentPerspectiveId="tunde"
      currentStepId="audit"
      pageTitle="Audit Trail"
      storyPanel={{
        eyebrow: 'Audit trail',
        perspectiveName: 'Tunde',
        perspectiveRole: 'Approver',
        title: 'The audit trail proves that the financial and governance story stayed intact.',
        body: 'Timeline tells the story. Audit proves the controls. This is where BitBridge looks materially stronger than informal group coordination.',
        insight:
          'For an investor, this is the trust layer: member payment, payout submission, approval, and completion are all explainable without hidden operator logic.',
        proofPoint:
          'The audit entries mirror the same completed fixture events that changed treasury and obligation state. There is no separate fabricated proof layer.',
        progressLabel: `${getGuidedProgressLabel('circle', 'audit')} • Guided Circle story`,
      }}
      guidedActions={[
        { label: 'Back', onClick: () => navigate(previousPath), state: 'enabled' },
        { label: 'Next', onClick: () => navigate(nextPath), state: 'enabled' },
        {
          label: 'Skip',
          state: 'unavailable',
          reason: 'The guided completion screen is the next and final guided proof point.',
        },
        {
          label: 'Resume',
          state: 'disabled',
          reason: 'You are already on the audit trail step.',
        },
      ]}
    >
      <div className="max-w-5xl min-w-0 space-y-6">
        <div>
          <span className="rounded-full border border-[#FFB05A]/40 bg-[#FFB05A]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#FFE1B8]">
            Audit trail
          </span>
          <h1 className="mt-8 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            A financial story the group can defend.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            These entries show the control trail behind the narrative. They answer the practical
            question every serious group eventually asks: who did what, when, and under what rule?
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {circle.auditTrail.map((item) => (
            <div
              key={item.id}
              className="rounded-[28px] border border-slate-800 bg-slate-900/68 p-5"
            >
              <p className="text-lg font-semibold text-white">{item.title}</p>
              <p className="mt-3 text-sm leading-7 text-slate-300">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </ExperienceCenterShell>
  )
}

CircleAudit.propTypes = {
  completedEventIds: PropTypes.arrayOf(PropTypes.string),
}

export default CircleAudit
