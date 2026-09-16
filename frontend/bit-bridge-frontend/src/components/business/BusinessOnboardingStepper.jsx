import PropTypes from 'prop-types'

const toneClasses = {
  complete: 'bg-emerald-400',
  current: 'bg-[#FFB05A]',
  upcoming: 'bg-slate-700',
}

const BusinessOnboardingStepper = ({ steps = [], currentIndex = 0, totalSteps = 0, completedSteps = 0 }) => {
  const activeStep = steps[currentIndex - 1] || steps.find((step) => step.isCurrent) || steps[0]

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Setup progress</div>
            <div className="mt-1 text-base font-semibold text-white">
              Step {currentIndex || 1} of {totalSteps || steps.length || 1}
              {activeStep?.label ? <span className="text-slate-400"> {' / '} {activeStep.label}</span> : null}
            </div>
          </div>
          <div className="text-sm text-slate-400">{completedSteps} completed</div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-[#FFB05A] transition-all"
            style={{
              width: `${Math.max(12, Math.min(100, ((currentIndex || 1) / Math.max(totalSteps || steps.length || 1, 1)) * 100))}%`,
            }}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {steps.map((step, index) => {
            const tone = toneClasses[step.state] || toneClasses.upcoming
            const chipLabel = step.shortLabel || step.label

            return (
              <div
                key={step.key}
                className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs text-slate-300"
              >
                <span className={`h-2.5 w-2.5 rounded-full ${tone}`} />
                <span className="font-medium text-white">{index + 1}. {chipLabel}</span>
                {step.isCurrent ? <span className="text-[#FFB05A]">Current</span> : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

BusinessOnboardingStepper.propTypes = {
  completedSteps: PropTypes.number,
  currentIndex: PropTypes.number,
  totalSteps: PropTypes.number,
  steps: PropTypes.arrayOf(
    PropTypes.shape({
      description: PropTypes.string,
      isComplete: PropTypes.bool,
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      route: PropTypes.string.isRequired,
      state: PropTypes.oneOf(['complete', 'current', 'upcoming']),
    })
  ),
}

export default BusinessOnboardingStepper
