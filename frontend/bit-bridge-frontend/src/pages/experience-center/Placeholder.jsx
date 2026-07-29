import { Navigate, useNavigate, useParams } from 'react-router-dom'
import ExperienceCenterShell from '../../components/experience-center/ExperienceCenterShell'
import {
  EXPERIENCE_CENTER_SELECTION_PATH,
  buildExperiencePath,
  getExperienceDefinition,
  normalizeExperienceId,
  saveExperienceCenterState,
} from '../../utils/experienceCenter'

const ExperiencePlaceholder = () => {
  const navigate = useNavigate()
  const { experienceId } = useParams()
  const normalizedId = normalizeExperienceId(experienceId)
  const experience = getExperienceDefinition(normalizedId)

  if (!experience) {
    return <Navigate to={EXPERIENCE_CENTER_SELECTION_PATH} replace />
  }

  const openSelection = () => {
    saveExperienceCenterState({
      selectedExperienceId: normalizedId,
      hasSeenLanding: true,
      lastPath: buildExperiencePath(normalizedId),
    })
    navigate(EXPERIENCE_CENTER_SELECTION_PATH)
  }

  return (
    <ExperienceCenterShell
      currentExperienceId={experience.id}
      currentExperienceLabel={experience.label}
      pageTitle={experience.label}
      storyPanel={{
        eyebrow: 'Placeholder entry state',
        title: `${experience.label} is intentionally paused after selection`,
        body: 'Slice 1 only establishes the reusable shell, safe routing, selected-experience context, and investor-facing entry experience. The guided story itself lands in the next slice.',
        insight: 'This keeps the Experience Center truthful. Investors can see how experiences are selected and resumed without being shown fake balances, fake approvals, or fabricated financial outcomes.',
        proofPoint: `Selected route preserved: ${buildExperiencePath(experience.id)}`,
        progressLabel: 'Slice 1 placeholder state',
      }}
      guidedActions={[
        { label: 'Back', onClick: openSelection, state: 'enabled' },
        { label: 'Next', state: 'unavailable', reason: `${experience.label} guided steps are not part of Slice 1.` },
        { label: 'Skip', state: 'unavailable', reason: 'Skip will become useful after the guided story has real downstream steps.' },
        { label: 'Resume', state: 'disabled', reason: 'Resume is already reflected by this direct entry route.' },
      ]}
    >
      <div className="max-w-3xl min-w-0">
        <span className="rounded-full border border-[#FFB05A]/40 bg-[#FFB05A]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#FFE1B8]">
          Selected experience
        </span>
        <h1 className="mt-8 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          {experience.placeholderTitle}
        </h1>
        <p className="mt-6 text-lg leading-8 text-slate-300">{experience.placeholderBody}</p>

        <div className="mt-8 rounded-[28px] border border-slate-800 bg-slate-900/70 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            What this experience will eventually prove
          </p>
          <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
            {experience.placeholderFocus.map((item) => (
              <li key={item} className="flex gap-3">
                <span aria-hidden="true" className="mt-2 h-2.5 w-2.5 rounded-full bg-[#FFB05A]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={openSelection}
            className="rounded-2xl bg-[#FFB05A] px-6 py-4 text-base font-semibold text-slate-950 transition hover:bg-[#ffc27d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB05A] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Back to Experience Selection
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-2xl border border-slate-700 bg-slate-900/65 px-6 py-4 text-base font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB05A] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Return to BitBridge Home
          </button>
        </div>
      </div>
    </ExperienceCenterShell>
  )
}

export default ExperiencePlaceholder
