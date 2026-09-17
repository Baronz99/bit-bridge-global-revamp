import { useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'

const formatLabel = (value, fallback = 'Member') =>
  String(value || fallback)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())

const OwnerModeSwitcher = ({
  value,
  businesses,
  circles = [],
  onChange,
  onActivateBusiness,
  onBrowseCircles,
  loading = false,
  circlesLoading = false,
  compact = false,
}) => {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!compact || !open) return undefined

    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [compact, open])

  const activeBusiness =
    value?.mode === 'business'
      ? businesses.find((business) => Number(business.id) === Number(value?.businessEntityId))
      : null
  const activeCircle =
    value?.mode === 'circle'
      ? circles.find((circle) => String(circle.id) === String(value?.circleId))
      : null

  const hasResolvedBusinessMode = value?.mode === 'business' && Boolean(activeBusiness)

  const modeTone =
    hasResolvedBusinessMode
      ? 'border-[#FFB05A]/50 bg-[rgba(255,176,90,0.12)] text-[#FFD2A0]'
      : value?.mode === 'circle'
        ? 'border-sky-500/50 bg-sky-500/10 text-sky-100'
        : value?.mode === 'business'
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
        : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'

  const activeName =
    hasResolvedBusinessMode
      ? activeBusiness?.name || 'Business account'
      : value?.mode === 'circle'
        ? activeCircle?.name || 'Circle account'
        : value?.mode === 'business'
          ? 'Select business account'
        : 'Personal account'

  const activeMeta = useMemo(() => {
    if (hasResolvedBusinessMode) {
      return `Business${activeBusiness?.current_user_role ? ` - ${formatLabel(activeBusiness.current_user_role)}` : ''}`
    }
    if (value?.mode === 'business') return 'Business selection required'
    if (value?.mode === 'circle') return 'Circle account'
    return 'Personal'
  }, [activeBusiness?.current_user_role, hasResolvedBusinessMode, value?.mode])

  const compactMeta = useMemo(() => {
    if (hasResolvedBusinessMode) {
      return activeBusiness?.current_user_role ? formatLabel(activeBusiness.current_user_role) : null
    }
    if (value?.mode === 'business') return 'Select workspace'
    if (value?.mode === 'circle') return 'Circle'
    return null
  }, [activeBusiness?.current_user_role, hasResolvedBusinessMode, value?.mode])

  const handleSelect = (payload) => {
    onChange(payload)
    setOpen(false)
  }

  const renderAccountRow = ({ key, name, meta, active, tone, onClick }) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition ${
        active
          ? tone === 'business'
            ? 'border-[#FFB05A]/50 bg-[rgba(255,176,90,0.12)] text-[#FFD2A0]'
            : tone === 'circle'
              ? 'border-sky-500/45 bg-sky-500/10 text-sky-100'
              : 'border-emerald-500/45 bg-emerald-500/10 text-emerald-200'
          : 'border-slate-800 bg-slate-950/55 text-slate-200 hover:border-slate-600 hover:bg-slate-950/75'
      }`}
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{name}</div>
        <div className="mt-1 truncate text-[11px] uppercase tracking-[0.14em] text-slate-400">{meta}</div>
      </div>
      <span className="ml-3 shrink-0 text-[10px] uppercase tracking-[0.16em]">
        {active ? 'Current' : 'Open'}
      </span>
    </button>
  )

  const panel = (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-700/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] px-4 py-4 shadow-[0_16px_40px_rgba(2,6,23,0.28)] md:min-w-[18rem]">
      <div>
        <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Account context</div>
        <div className="mt-2 text-sm text-slate-400">
          {loading || circlesLoading
            ? 'Refreshing available accounts...'
            : 'Switch between personal, business, and circle financial contexts.'}
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/55 px-3 py-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Personal</div>
          <div className="mt-2">
            {renderAccountRow({
              key: 'account-personal',
              name: 'Personal account',
              meta: 'Personal',
              active: value?.mode === 'personal',
              tone: 'personal',
              onClick: () => handleSelect({ mode: 'personal' }),
            })}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Business accounts</div>
          <div className="mt-2 space-y-2">
            {businesses.length ? (
              businesses.map((business) =>
                renderAccountRow({
                  key: `account-business-${business.id}`,
                  name: business.name || 'Business account',
                  meta: `Business${business.current_user_role ? ` - ${formatLabel(business.current_user_role)}` : ''}`,
                  active: value?.mode === 'business' && Number(value?.businessEntityId) === Number(business.id),
                  tone: 'business',
                  onClick: () => handleSelect({ mode: 'business', businessEntityId: business.id }),
                })
              )
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-3 py-3 text-sm text-slate-500">
                {loading ? 'Refreshing business accounts...' : 'No business accounts yet.'}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Circles</div>
          <div className="mt-2 space-y-2">
            {circles.length ? (
              circles.map((circle) =>
                renderAccountRow({
                  key: `account-circle-${circle.id}`,
                  name: circle.name || 'Circle account',
                  meta: 'Circle',
                  active: value?.mode === 'circle' && String(value?.circleId) === String(circle.id),
                  tone: 'circle',
                  onClick: () => handleSelect({ mode: 'circle', circleId: circle.id }),
                })
              )
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-3 py-3 text-sm text-slate-500">
                {circlesLoading ? 'Refreshing circles...' : 'No circles yet.'}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Actions</div>
          <div className="mt-2 space-y-2">
            <button
              type="button"
              onClick={() => {
                onActivateBusiness?.()
                setOpen(false)
              }}
              className="w-full rounded-2xl border border-[#FFB05A]/40 bg-[rgba(255,176,90,0.12)] px-4 py-3 text-left text-sm font-medium text-[#FFD2A0] transition hover:border-[#FFB05A]/70 hover:bg-[rgba(255,176,90,0.18)]"
            >
              {businesses.length ? 'Create business account' : 'Activate business banking'}
            </button>
            {onBrowseCircles ? (
              <button
                type="button"
                onClick={() => {
                  onBrowseCircles()
                  setOpen(false)
                }}
                className="w-full rounded-2xl border border-sky-500/35 bg-sky-500/10 px-4 py-3 text-left text-sm font-medium text-sky-100 transition hover:border-sky-400/60 hover:bg-sky-500/16"
              >
                Manage circles
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )

  if (compact) {
    return (
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="flex w-[15rem] min-w-[15rem] max-w-[15rem] items-center justify-between rounded-2xl border border-slate-700/70 bg-[linear-gradient(135deg,rgba(15,23,42,0.88),rgba(2,6,23,0.9))] px-3 py-2.5 text-left shadow-[0_12px_28px_rgba(2,6,23,0.18)]"
        >
          <div className="min-w-0">
            <div className="text-[9px] uppercase tracking-[0.16em] text-slate-500">Account</div>
            <div className="mt-1 truncate text-[13px] font-semibold text-white">{activeName}</div>
            {compactMeta ? (
              <div className="mt-0.5 truncate text-[10px] uppercase tracking-[0.12em] text-slate-400">
                {compactMeta}
              </div>
            ) : null}
          </div>
          <span className={`ml-2 shrink-0 rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-[0.14em] ${modeTone}`}>
            Current
          </span>
        </button>
        {open ? <div className="absolute right-0 z-30 mt-2">{panel}</div> : null}
      </div>
    )
  }

  return panel
}

OwnerModeSwitcher.propTypes = {
  value: PropTypes.shape({
    mode: PropTypes.oneOf(['personal', 'business', 'circle']),
    businessEntityId: PropTypes.oneOfType([PropTypes.number, PropTypes.string, PropTypes.oneOf([null])]),
    circleId: PropTypes.oneOfType([PropTypes.number, PropTypes.string, PropTypes.oneOf([null])]),
  }),
  businesses: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      name: PropTypes.string,
      current_user_role: PropTypes.string,
    })
  ),
  circles: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      name: PropTypes.string,
    })
  ),
  onChange: PropTypes.func.isRequired,
  onActivateBusiness: PropTypes.func,
  onBrowseCircles: PropTypes.func,
  loading: PropTypes.bool,
  circlesLoading: PropTypes.bool,
  compact: PropTypes.bool,
}

export default OwnerModeSwitcher
