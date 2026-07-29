import { Component } from 'react'
import PropTypes from 'prop-types'
import { clearExperienceCenterState, EXPERIENCE_CENTER_ROOT_PATH } from '../../utils/experienceCenter'

class ExperienceCenterErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Experience Center demo failed to render safely.', error, errorInfo)
  }

  restartExperience = () => {
    clearExperienceCenterState()
    window.location.assign(EXPERIENCE_CENTER_ROOT_PATH)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#020617_0%,#081120_42%,#0f172a_100%)] px-4 py-10 text-white lg:px-6">
        <div className="mx-auto max-w-3xl rounded-[34px] border border-slate-800/90 bg-[linear-gradient(180deg,rgba(2,6,23,0.82),rgba(15,23,42,0.8))] p-8 shadow-[0_28px_80px_rgba(15,23,42,0.26)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#FFE1B8]">Experience Center</p>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            The demo needs a fresh start.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            This public Experience Center is fixture-driven and does not connect to live customer data or financial services. Restart the guided demo to continue safely.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <button
              type="button"
              onClick={this.restartExperience}
              className="rounded-2xl bg-[#FFB05A] px-6 py-4 text-base font-semibold text-slate-950 transition hover:bg-[#ffc27d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB05A] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              Restart Experience
            </button>
          </div>
        </div>
      </div>
    )
  }
}

ExperienceCenterErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
}

export default ExperienceCenterErrorBoundary
