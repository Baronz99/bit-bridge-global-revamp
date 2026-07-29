import PropTypes from 'prop-types'

const ChangePerspective = ({ currentPerspective, perspectives, onChange }) => (
  <section
    aria-label="Change perspective"
    className="rounded-[28px] border border-slate-800 bg-slate-900/68 p-5"
  >
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          Change Perspective
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          See the same Circle through different responsibilities.
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          Members, treasurers, and approvers all need different clarity, but they should still see one shared financial story.
        </p>
      </div>

      <div className="rounded-2xl border border-[#FFB05A]/25 bg-[#FFB05A]/8 px-4 py-3 text-sm text-[#FFE1B8] lg:max-w-xs">
        <span className="block text-[11px] uppercase tracking-[0.24em] text-[#FFD2A0]">
          Current view
        </span>
        <span className="mt-2 block font-semibold">
          Viewing as {currentPerspective.label} - {currentPerspective.role}
        </span>
      </div>
    </div>

    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      {perspectives.map((perspective) => {
        const isSelected = perspective.id === currentPerspective.id

        return (
          <button
            key={perspective.id}
            type="button"
            onClick={() => onChange(perspective.id)}
            aria-pressed={isSelected}
            className={`rounded-3xl border px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB05A] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
              isSelected
                ? 'border-[#FFB05A]/50 bg-[linear-gradient(180deg,rgba(255,176,90,0.1),rgba(15,23,42,0.94))] text-white'
                : 'border-slate-800 bg-slate-950/65 text-slate-200 hover:border-slate-600 hover:bg-slate-950'
            }`}
          >
            <span className="block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              {perspective.role}
            </span>
            <span className="mt-2 block text-lg font-semibold">{perspective.label}</span>
            <span className="mt-2 block text-sm leading-6 text-slate-300">
              {perspective.summary}
            </span>
          </button>
        )
      })}
    </div>
  </section>
)

ChangePerspective.propTypes = {
  currentPerspective: PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    role: PropTypes.string.isRequired,
    summary: PropTypes.string.isRequired,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  perspectives: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      role: PropTypes.string.isRequired,
      summary: PropTypes.string.isRequired,
    })
  ).isRequired,
}

export default ChangePerspective
