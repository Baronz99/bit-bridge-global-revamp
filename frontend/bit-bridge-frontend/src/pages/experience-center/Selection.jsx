import { useNavigate } from 'react-router-dom'
import ExperienceCard from '../../components/experience-center/ExperienceCard'
import ExperienceCenterShell from '../../components/experience-center/ExperienceCenterShell'
import {
  EXPERIENCE_CENTER_ROOT_PATH,
  EXPERIENCE_DEFINITIONS,
  buildExperiencePath,
  createExperienceSelectionState,
  getExperienceCenterState,
  getResumePath,
  saveExperienceCenterState,
} from '../../utils/experienceCenter'

const Selection = () => {
  const navigate = useNavigate()
  const persistedState = getExperienceCenterState()
  const resumePath = getResumePath(persistedState)

  const handleSelect = (experienceId) => {
    saveExperienceCenterState(
      createExperienceSelectionState(experienceId, buildExperiencePath(experienceId))
    )
  }

  return (
    <ExperienceCenterShell
      currentExperienceLabel="Choose your story"
      pageTitle="Choose an Experience"
      storyPanel={{
        eyebrow: 'Choose your story',
        title: 'Start where BitBridge is easiest to feel.',
        body: 'Circle is the fastest way to understand BitBridge because one month inside Greenfield turns shared money into something concrete.',
        insight:
          'The other stories remain available after Circle, so the broader platform can be explored without losing the main narrative first.',
        progressLabel: 'Choose where to begin',
      }}
      guidedActions={[
        { label: 'Back', onClick: () => navigate(EXPERIENCE_CENTER_ROOT_PATH), state: 'enabled' },
        resumePath ? { label: 'Resume', onClick: () => navigate(resumePath), state: 'enabled' } : { hidden: true, label: 'Resume' },
      ]}
    >
      <div className="min-w-0">
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Start with Circle to see the clearest before-and-after.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
          One payment changes collections. One request tests control. One completed month shows what BitBridge really does for a group.
        </p>

        <div className="mt-8 grid gap-5 xl:grid-cols-2">
          {EXPERIENCE_DEFINITIONS.map((experience) => (
            <ExperienceCard
              key={experience.id}
              experience={experience}
              to={buildExperiencePath(experience.id)}
              onSelect={() => handleSelect(experience.id)}
            />
          ))}
        </div>
      </div>
    </ExperienceCenterShell>
  )
}

export default Selection
