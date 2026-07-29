import PropTypes from 'prop-types'
import { FiArrowLeft, FiArrowRight } from 'react-icons/fi'

const getActionIcon = (label) => {
  const normalized = label.toLowerCase()
  return normalized.includes('back') ? FiArrowLeft : FiArrowRight
}

const GuidedControls = ({ actions = [] }) => {
  const visibleActions = actions.filter((action) => !action.hidden)

  return (
    <nav
      aria-label="Guided navigation"
      className="rounded-[28px] border border-slate-800 bg-[linear-gradient(180deg,rgba(2,6,23,0.74),rgba(15,23,42,0.8))] p-4 shadow-[0_20px_48px_rgba(15,23,42,0.2)]"
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {visibleActions.map((action, index) => {
          const isDisabled = action.state === 'disabled'
          const isUnavailable = action.state === 'unavailable'
          const descriptionId = action.reason
            ? `${action.label.toLowerCase().replace(/\s+/g, '-')}-reason`
            : undefined
          const Icon = getActionIcon(action.label)
          const isPrimary = visibleActions.length === 1 ? true : index === 1
          const tone = isUnavailable
            ? 'border border-amber-400/40 bg-amber-400/10 text-amber-100'
            : isDisabled
              ? 'cursor-not-allowed border border-slate-700 bg-slate-900/60 text-slate-500'
              : isPrimary
                ? 'border border-[#FFB05A] bg-[#FFB05A] text-slate-950 shadow-[0_14px_34px_rgba(249,115,22,0.22)] hover:bg-[#ffc27d] hover:border-[#ffc27d]'
                : 'border border-slate-700 bg-slate-900/80 text-slate-100 hover:border-slate-500 hover:bg-slate-900'

          return (
            <div key={action.label} className="min-w-0">
              <button
                type="button"
                disabled={isDisabled}
                aria-disabled={isDisabled || isUnavailable}
                aria-describedby={descriptionId}
                onClick={isUnavailable || isDisabled ? undefined : action.onClick}
                className={`w-full rounded-2xl px-4 py-4 text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB05A] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${tone}`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="block text-base font-medium text-inherit">{action.label}</span>
                  <Icon className="h-5 w-5 shrink-0 opacity-80" aria-hidden="true" />
                </span>
              </button>
              {action.reason ? (
                <p id={descriptionId} className="mt-2 px-1 text-xs leading-5 text-slate-400">
                  {action.reason}
                </p>
              ) : null}
            </div>
          )
        })}
      </div>
    </nav>
  )
}

GuidedControls.propTypes = {
  actions: PropTypes.arrayOf(
    PropTypes.shape({
      hidden: PropTypes.bool,
      label: PropTypes.string,
      onClick: PropTypes.func,
      reason: PropTypes.string,
      state: PropTypes.oneOf(['enabled', 'disabled', 'unavailable']),
    })
  ),
}

export default GuidedControls
