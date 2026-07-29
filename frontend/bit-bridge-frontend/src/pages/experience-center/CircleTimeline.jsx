import { useMemo } from 'react'
import PropTypes from 'prop-types'
import { useNavigate } from 'react-router-dom'
import ExperienceCenterShell from '../../components/experience-center/ExperienceCenterShell'
import useRenderedSimulationState from '../../hooks/useRenderedSimulationState'
import {
  getGuidedProgressLabel,
  getNextStepPath,
  getPreviousStepPath,
  persistGuidedStepState,
} from '../../utils/experienceCenter'
import { deriveGreenfieldCircleView, setActivityTab } from '../../utils/experienceCenterCircleDemo'

const formatNaira = (amount, fractionDigits = 0) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount)

const tabs = ['activity', 'audit', 'statement']

const CircleTimeline = ({ simulationState }) => {
  const navigate = useNavigate()
  const { renderedSimulationState, setRenderedSimulationState } = useRenderedSimulationState(simulationState)
  const circle = useMemo(
    () => deriveGreenfieldCircleView(renderedSimulationState),
    [renderedSimulationState]
  )
  const member = circle.memberIdentity
  const nextPath = getNextStepPath('circle', 'activity-audit')
  const previousPath = getPreviousStepPath('circle', 'activity-audit')
  const activeTab = circle.chapterState.activeActivityTab || 'activity'

  const selectTab = (tab) => {
    const savedState = persistGuidedStepState({
      experienceId: 'circle',
      stepId: 'activity-audit',
      perspectiveId: 'amaka',
      simulationState: setActivityTab(renderedSimulationState, tab),
    })
    setRenderedSimulationState(savedState.simulationState)
  }

  return (
    <ExperienceCenterShell
      currentExperienceId="circle"
      currentExperienceLabel="BitBridge Circle"
      currentPerspectiveId="amaka"
      currentStepId="activity-audit"
      pageTitle="Activity, Audit and Statement"
      storyPanel={{
        eyebrow: 'Month-end record',
        perspectiveName: 'Amaka',
        perspectiveRole: 'Treasurer',
        title: 'By month-end, every important July movement is recorded.',
        body: 'Activity shows what happened. Audit shows who acted. Statement shows the completed money movement.',
        progressLabel: `${getGuidedProgressLabel('circle', 'activity-audit')} - Circle story`,
      }}
      guidedActions={[
        { label: 'Back', onClick: () => navigate(previousPath), state: 'enabled' },
        { label: 'Explore BitBridge', onClick: () => navigate(nextPath), state: 'enabled' },
      ]}
    >
      <div className="max-w-5xl min-w-0 space-y-6">
        <div>
          <span className="rounded-full border border-[#FFB05A]/40 bg-[#FFB05A]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#FFE1B8]">
            Activity, Audit and Statement
          </span>
          <h1 className="mt-8 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            July now ends with a clear activity, audit, and statement record.
          </h1>
        </div>

        <div className="flex flex-wrap gap-3">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => selectTab(tab)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold capitalize transition ${
                activeTab === tab
                  ? 'border-[#FFB05A]/40 bg-[#FFB05A]/12 text-[#FFE1B8]'
                  : 'border-slate-800 bg-slate-900/68 text-slate-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'activity' && (
          <div className="space-y-4">
            {[
              `${member.name} paid July Security Levy: +₦25,000`,
              `${member.name}'s levy was marked paid`,
              'Amaka submitted the security vendor payment request',
              'Tunde approved the request',
              'The vendor payout entered processing',
              'The security vendor payout completed: -₦600,000',
              'The transfer fee was recorded: -₦100',
            ].map((line) => (
              <div
                key={line}
                className="rounded-[24px] border border-slate-800 bg-slate-900/68 px-5 py-4 text-sm text-slate-200"
              >
                {line}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="space-y-4">
            {circle.auditTrail.map((entry) => (
              <div key={entry.id} className="rounded-[24px] border border-slate-800 bg-slate-900/68 p-5">
                <p className="text-sm font-semibold text-white">{entry.action}</p>
                <p className="mt-2 text-sm text-slate-300">
                  {entry.actor} - {entry.actorRole}
                </p>
                {entry.id === 'audit-chidi-payment' ? (
                  <p className="mt-2 text-sm text-slate-400">{member.residenceLabel}</p>
                ) : null}
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                  {entry.reference} - {entry.occurredAt}
                </p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'statement' && (
          <div className="space-y-4">
            {circle.statementEntries.map((entry) => (
              <div key={entry.id} className="rounded-[24px] border border-slate-800 bg-slate-900/68 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">{entry.label}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">{entry.direction}</p>
                  </div>
                  <p className="text-lg font-semibold text-white">
                    {formatNaira(entry.amount, entry.id === 'statement-transfer-fee' ? 2 : 0)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ExperienceCenterShell>
  )
}

CircleTimeline.propTypes = {
  simulationState: PropTypes.shape({}),
}

export default CircleTimeline
