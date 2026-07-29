import PropTypes from 'prop-types'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import bitBridgeLogo from '../../assets/logos/bitbridge-logo-clear.png'
import GuidedControls from './GuidedControls'
import StoryPanel from './StoryPanel'
import {
  EXPERIENCE_CENTER_ROOT_PATH,
  clearExperienceCenterState,
  getExperienceCenterState,
  getExperienceDefinition,
  getExperienceStepDefinition,
  getGuidedSteps,
  normalizeGuidedAction,
  saveExperienceCenterState,
} from '../../utils/experienceCenter'

const ExperienceCenterShell = ({
  children,
  currentExperienceId = '',
  currentExperienceLabel = 'Introduction',
  currentPerspectiveId = '',
  currentStepId = '',
  guidedActions = [],
  pageTitle,
  storyPanel,
}) => {
  const location = useLocation()
  const navigate = useNavigate()
  const mainContentRef = useRef(null)
  const shouldReduceMotion = useReducedMotion()
  const [overviewNotice, setOverviewNotice] = useState('')

  const currentExperience = useMemo(
    () => getExperienceDefinition(currentExperienceId),
    [currentExperienceId]
  )
  const currentStep = useMemo(
    () => getExperienceStepDefinition(currentExperienceId, currentStepId),
    [currentExperienceId, currentStepId]
  )
  const progressCount = currentExperienceId ? getGuidedSteps(currentExperienceId).length : 0
  const progressPercent =
    currentStep && progressCount > 0
      ? Math.max(
          8,
          Math.min(100, Math.round((currentStep.progressPosition / progressCount) * 100))
        )
      : 0

  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} | BitBridge Global` : 'BitBridge Global'
  }, [pageTitle])

  useEffect(() => {
    const currentState = getExperienceCenterState()
    saveExperienceCenterState({
      ...currentState,
      selectedExperienceId: currentExperience?.id || currentState.selectedExperienceId,
      selectedPerspectiveId: currentPerspectiveId || currentState.selectedPerspectiveId,
      currentStepId: currentStepId || currentState.currentStepId,
      lastPath: location.pathname,
    })
  }, [currentExperience?.id, currentPerspectiveId, currentStepId, location.pathname])

  useEffect(() => {
    mainContentRef.current?.focus({ preventScroll: true })
  }, [location.pathname])

  const restartDemo = () => {
    clearExperienceCenterState()
    navigate(EXPERIENCE_CENTER_ROOT_PATH)
  }

  const normalizedActions = guidedActions.map(normalizeGuidedAction)
  const pageTransition = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
      }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.22),transparent_34%),radial-gradient(circle_at_right,rgba(249,115,22,0.14),transparent_24%),linear-gradient(180deg,#020617_0%,#081120_42%,#0f172a_100%)] text-white">
      <header className="relative border-b border-slate-800/80 bg-slate-950/86 backdrop-blur-xl">
        <div className="mx-auto max-w-app-layout px-4 py-4 lg:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-4 xl:flex-1">
              <Link
                to={EXPERIENCE_CENTER_ROOT_PATH}
                className="flex min-w-0 items-center gap-3 rounded-3xl border border-white/5 bg-slate-900/55 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB05A] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                aria-label="Open BitBridge Global demo landing"
              >
                <img src={bitBridgeLogo} alt="BitBridge Global logo" className="h-11 w-auto object-contain" />
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-white">BitBridge Global</p>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Experience Center
                  </p>
                </div>
              </Link>

              <div className="min-w-0 flex-1 rounded-3xl border border-slate-800/90 bg-slate-900/70 px-4 py-4 shadow-[0_18px_44px_rgba(2,6,23,0.24)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Current chapter</p>
                    <p className="mt-1 truncate text-base font-semibold text-slate-50">
                      {currentExperienceLabel}
                    </p>
                  </div>
                  {currentStep ? (
                    <span className="rounded-full border border-[#FFB05A]/30 bg-[#FFB05A]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#FFE1B8]">
                      {currentStep.label}
                    </span>
                  ) : null}
                </div>
                {currentStep ? (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                      <span>{currentExperience?.label || 'BitBridge'}</span>
                      <span>
                        {currentStep.progressPosition}/{progressCount}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-950/90">
                      <motion.div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#FFB05A_0%,#F97316_100%)]"
                        initial={shouldReduceMotion ? false : { width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[24rem]">
              <button
                type="button"
                onClick={() =>
                  setOverviewNotice(
                    'Product overview video will be added for Demo Day recording and partner walkthroughs.'
                  )
                }
                aria-describedby="experience-center-watch-overview-note"
                className="rounded-2xl border border-slate-700/80 bg-slate-900/70 px-4 py-3 text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB05A] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Watch Overview
              </button>
              <button
                type="button"
                onClick={restartDemo}
                className="rounded-2xl border border-slate-700/80 bg-slate-900/70 px-4 py-3 text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB05A] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Restart Demo
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="rounded-2xl bg-[#FFB05A] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#ffc27d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB05A] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Return to Home
              </button>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-app-layout px-4 pb-4 lg:px-6">
          <p id="experience-center-watch-overview-note" aria-live="polite" className="text-sm text-slate-400">
            {overviewNotice || 'BitBridge leads the story here. The video companion arrives after the guided flow is finalized.'}
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-app-layout gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1.72fr)_minmax(300px,0.84fr)] lg:px-6 lg:py-10">
        <div className="min-w-0 space-y-5">
          <motion.section
            key={location.pathname}
            ref={mainContentRef}
            tabIndex={-1}
            className="relative w-full min-w-0 overflow-hidden rounded-[34px] border border-slate-800/90 bg-[linear-gradient(180deg,rgba(2,6,23,0.82),rgba(15,23,42,0.8))] p-6 shadow-[0_28px_80px_rgba(15,23,42,0.26)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB05A] sm:p-8"
            {...pageTransition}
          >
            {children}
          </motion.section>
          {normalizedActions.some((action) => !action.hidden) ? <GuidedControls actions={normalizedActions} /> : null}
        </div>

        <motion.div
          key={`${location.pathname}-story`}
          className="min-w-0 lg:sticky lg:top-6 lg:self-start"
          {...pageTransition}
          transition={{ ...(pageTransition.transition || {}), delay: shouldReduceMotion ? 0 : 0.04 }}
        >
          <StoryPanel {...storyPanel} />
        </motion.div>
      </main>
    </div>
  )
}

ExperienceCenterShell.propTypes = {
  children: PropTypes.node.isRequired,
  currentExperienceId: PropTypes.string,
  currentExperienceLabel: PropTypes.string,
  currentPerspectiveId: PropTypes.string,
  currentStepId: PropTypes.string,
  guidedActions: PropTypes.arrayOf(PropTypes.object),
  pageTitle: PropTypes.string,
  storyPanel: PropTypes.shape({
    body: PropTypes.string.isRequired,
    eyebrow: PropTypes.string,
    insight: PropTypes.string,
    perspectiveName: PropTypes.string,
    perspectiveRole: PropTypes.string,
    progressLabel: PropTypes.string,
    proofPoint: PropTypes.string,
    title: PropTypes.string.isRequired,
  }).isRequired,
}

export default ExperienceCenterShell
