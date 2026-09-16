import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import BusinessOnboardingStepper from './BusinessOnboardingStepper'

const BusinessSetupShell = ({
  eyebrow = 'Business setup',
  title,
  subtitle,
  statusBadge,
  saveStatus = '',
  backAction = null,
  exitHref = '/dashboard/business',
  exitLabel = 'Leave setup',
  progress = null,
  children,
}) => (
  <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-6">
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {backAction}
          <Link
            to={exitHref}
            className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            {exitLabel}
          </Link>
        </div>
        {saveStatus ? <div className="text-xs text-slate-500">{saveStatus}</div> : null}
      </div>

      <section className="rounded-[28px] border border-[#FF7A18]/35 bg-[linear-gradient(135deg,rgba(255,138,42,0.12),rgba(255,176,90,0.05)_42%,rgba(15,23,42,0.96)_100%)] p-5 shadow-[0_24px_60px_rgba(255,122,24,0.12)] md:p-7">
        <div className="flex flex-col gap-3">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#FFB05A]">{eyebrow}</p>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white md:text-3xl">{title}</h1>
              {subtitle ? <p className="mt-3 max-w-2xl text-sm text-slate-300">{subtitle}</p> : null}
            </div>
            {statusBadge ? (
              <div className="inline-flex rounded-full border border-[#FFB05A]/35 bg-[rgba(255,176,90,0.12)] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#FFD2A0]">
                {statusBadge}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {progress ? <BusinessOnboardingStepper {...progress} /> : null}

      {children}
    </div>
  </div>
)

BusinessSetupShell.propTypes = {
  backAction: PropTypes.node,
  children: PropTypes.node.isRequired,
  exitHref: PropTypes.string,
  exitLabel: PropTypes.string,
  eyebrow: PropTypes.string,
  progress: PropTypes.shape({
    completedSteps: PropTypes.number,
    currentIndex: PropTypes.number,
    currentStep: PropTypes.string,
    steps: PropTypes.array,
    totalSteps: PropTypes.number,
  }),
  saveStatus: PropTypes.string,
  statusBadge: PropTypes.string,
  subtitle: PropTypes.string,
  title: PropTypes.string.isRequired,
}

export default BusinessSetupShell
