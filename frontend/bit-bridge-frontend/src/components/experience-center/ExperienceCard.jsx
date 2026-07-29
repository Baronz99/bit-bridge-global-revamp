import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'

const ExperienceCard = ({ experience, to, onSelect }) => {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      className="h-full"
    >
      <Link
        to={to}
        onClick={onSelect}
        className={`group relative flex h-full w-full min-w-0 flex-col overflow-hidden rounded-[30px] border p-6 transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB05A] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
          experience.recommended
            ? 'border-[#FFB05A]/55 bg-[linear-gradient(180deg,rgba(255,176,90,0.14),rgba(15,23,42,0.96))] shadow-[0_20px_45px_rgba(255,176,90,0.14)]'
            : 'border-slate-800 bg-slate-950/82 hover:border-slate-600 hover:bg-slate-950'
        }`}
        aria-label={`Open ${experience.label} experience`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
              {experience.kicker}
            </p>
            <h2 className="mt-3 text-[1.9rem] font-semibold leading-tight text-white">
              {experience.label}
            </h2>
          </div>
          {experience.recommended ? (
            <span className="rounded-full border border-[#FFB05A]/55 bg-[#FFB05A]/14 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#FFE1B8]">
              Start here
            </span>
          ) : null}
        </div>

        <p className="mt-6 max-w-[26rem] text-xl leading-8 text-slate-50">{experience.valueHeadline}</p>
        <p className="mt-4 text-sm leading-7 text-slate-300">{experience.description}</p>

        <div className="mt-auto pt-8">
          <span className="inline-flex items-center rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 transition group-hover:border-slate-500 group-hover:text-white">
            {experience.recommended ? 'Start with Circle' : 'Preview experience'}
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

ExperienceCard.propTypes = {
  experience: PropTypes.shape({
    description: PropTypes.string.isRequired,
    kicker: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    recommended: PropTypes.bool,
    valueHeadline: PropTypes.string.isRequired,
  }).isRequired,
  onSelect: PropTypes.func,
  to: PropTypes.string.isRequired,
}

export default ExperienceCard
