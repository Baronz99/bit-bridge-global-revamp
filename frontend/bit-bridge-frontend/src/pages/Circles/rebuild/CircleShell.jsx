import { NavLink } from 'react-router-dom'

const navItemClass = ({ isActive }) =>
  [
    'rounded-full border px-4 py-2 text-sm font-medium transition',
    isActive
      ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200'
      : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:text-white',
  ].join(' ')

const CircleShell = ({ circleId, title, roleLabel, bucketLabel, children }) => {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-10 pt-4 md:px-6">
      <div className="rounded-[28px] border border-slate-900 bg-[#030816] px-5 py-5 shadow-[0_24px_80px_rgba(2,6,23,0.55)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Circle</p>
            <h1 className="mt-2 text-2xl font-semibold text-white md:text-3xl">{title}</h1>
            {bucketLabel ? <p className="mt-2 text-sm text-slate-400">{bucketLabel}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <div className="inline-flex items-center rounded-full border border-slate-800 bg-slate-950/70 px-4 py-2 text-sm text-slate-300">
              {roleLabel}
            </div>
            <a
              href={`/dashboard/shared-groups/${circleId}/legacy`}
              className="inline-flex items-center rounded-full border border-slate-800 bg-slate-950/70 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-700 hover:text-white"
            >
              More tools
            </a>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <NavLink end to={`/dashboard/shared-groups/${circleId}`} className={navItemClass}>
            Home
          </NavLink>
          <NavLink to={`/dashboard/shared-groups/${circleId}/pay`} className={navItemClass}>
            Contributions
          </NavLink>
          <NavLink to={`/dashboard/shared-groups/${circleId}/manage`} className={navItemClass}>
            Admin
          </NavLink>
          <NavLink to={`/dashboard/shared-groups/${circleId}/timeline`} className={navItemClass}>
            Activity
          </NavLink>
        </div>
      </div>
      <div className="grid gap-6">{children}</div>
    </div>
  )
}

export default CircleShell
