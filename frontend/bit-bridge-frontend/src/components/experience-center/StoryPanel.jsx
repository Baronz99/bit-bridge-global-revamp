import PropTypes from 'prop-types'
import { motion, useReducedMotion } from 'framer-motion'

const StoryPanel = ({
  title,
  body,
  eyebrow,
  insight,
  insightLabel,
  proofPoint,
  proofPointLabel,
  progressLabel,
  perspectiveName,
  perspectiveRole,
}) => {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.aside
      aria-label="Story context"
      className="relative overflow-hidden rounded-[30px] border border-slate-800 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.84))] p-5 shadow-[0_20px_54px_rgba(15,23,42,0.24)]"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#FFD2A0]">{eyebrow}</p>
      ) : null}

      {perspectiveName && perspectiveRole ? (
        <div className="mt-4 rounded-2xl border border-slate-800/90 bg-slate-950/65 px-4 py-3">
          <span className="block text-[11px] uppercase tracking-[0.24em] text-slate-500">Viewing as</span>
          <span className="mt-2 block text-base font-semibold text-white">
            {perspectiveName} - {perspectiveRole}
          </span>
        </div>
      ) : null}

      <h2 className="mt-4 text-[1.55rem] font-semibold leading-tight text-white">{title}</h2>
      <p className="mt-4 text-sm leading-7 text-slate-300">{body}</p>

      {insight ? (
        <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-4 text-sm text-slate-300">
          <span className="block text-[11px] uppercase tracking-[0.24em] text-slate-500">
            {insightLabel || 'Why it matters'}
          </span>
          <span className="mt-2 block leading-6">{insight}</span>
        </div>
      ) : null}

      {proofPoint ? (
        <div className="mt-4 rounded-2xl border border-[#FFB05A]/30 bg-[#FFB05A]/8 px-4 py-4 text-sm text-[#FFE5C3]">
          <span className="block text-[11px] uppercase tracking-[0.24em] text-[#FFD2A0]">
            {proofPointLabel || 'Remember this'}
          </span>
          <span className="mt-2 block leading-6">{proofPoint}</span>
        </div>
      ) : null}

      {progressLabel ? (
        <p className="mt-5 border-t border-slate-800/80 pt-4 text-[11px] uppercase tracking-[0.24em] text-slate-500">
          {progressLabel}
        </p>
      ) : null}
    </motion.aside>
  )
}

StoryPanel.propTypes = {
  body: PropTypes.string.isRequired,
  eyebrow: PropTypes.string,
  insight: PropTypes.string,
  insightLabel: PropTypes.string,
  perspectiveName: PropTypes.string,
  perspectiveRole: PropTypes.string,
  progressLabel: PropTypes.string,
  proofPoint: PropTypes.string,
  proofPointLabel: PropTypes.string,
  title: PropTypes.string.isRequired,
}

export default StoryPanel
