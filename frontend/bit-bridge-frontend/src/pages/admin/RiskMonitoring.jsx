import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { getAdminRiskControls } from '../../api/adminRiskControls'
import nairaFormat from '../../utils/nairaFormat'
import dateFormater from '../../utils/dateFormat'

const STATUS_OPTIONS = [
  { value: '', label: 'All monitored accounts' },
  { value: 'restricted', label: 'Restricted only' },
  { value: 'monitored', label: 'Monitoring enabled' },
  { value: 'auto_lock', label: 'Auto-lock enabled' },
]

const formatCap = (value) => {
  if (value == null || value === '') return 'Not set'
  return nairaFormat(Number(value) / 100, 'ngn')
}

const RiskMonitoring = () => {
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let active = true

    const loadRiskQueue = async () => {
      try {
        setLoading(true)
        setError('')
        const res = await getAdminRiskControls({
          status: statusFilter || undefined,
          query: query.trim() || undefined,
        })
        if (!active) return
        setRows(Array.isArray(res?.data?.data) ? res.data.data : [])
        setSummary(res?.data?.summary || null)
      } catch (loadError) {
        if (!active) return
        setError(
          loadError?.response?.data?.message || 'Unable to load the risk monitoring queue.'
        )
        setRows([])
        setSummary(null)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadRiskQueue()

    return () => {
      active = false
    }
  }, [query, statusFilter])

  const summaryCards = useMemo(
    () => [
      { label: 'Monitored', value: summary?.monitored ?? 0 },
      { label: 'Auto-lock', value: summary?.auto_lock_enabled ?? 0 },
      { label: 'Restricted', value: summary?.restricted ?? 0 },
    ],
    [summary]
  )

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Compliance</p>
            <h1 className="text-2xl font-semibold md:text-3xl">Risk monitoring</h1>
            <p className="mt-1 text-sm text-slate-400">
              Review monitored accounts, restriction state, provider freeze posture, and recent risk activity.
            </p>
          </div>
          <NavLink
            to="/admin/dashboard"
            className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-800"
          >
            Back to dashboard
          </NavLink>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{card.label}</p>
              <p className="mt-3 text-3xl font-semibold text-slate-100">{card.value}</p>
            </div>
          ))}
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Monitored account queue</h2>
              <p className="mt-1 text-xs text-slate-400">
                This queue is backend-backed and includes only accounts with explicit risk controls.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search restriction reason..."
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
              />
            </div>
          </div>

          {error ? (
            <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-slate-400">
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">State</th>
                  <th className="px-3 py-2">Limits</th>
                  <th className="px-3 py-2">Provider freeze</th>
                  <th className="px-3 py-2">Latest risk event</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                      Loading monitored accounts...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                      No monitored accounts found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.user_id} className="border-b border-slate-800/80 align-top">
                      <td className="px-3 py-3">
                        <p className="font-medium text-slate-100">{row.full_name || row.email}</p>
                        <p className="text-xs text-slate-400">{row.email}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {row.phone_number || 'No phone'} · {row.kyc_level || 'no KYC'}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          {row.monitoring_enabled ? (
                            <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-sky-200">
                              Monitored
                            </span>
                          ) : null}
                          {row.auto_lock_enabled ? (
                            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-amber-200">
                              Auto-lock
                            </span>
                          ) : null}
                          {row.restricted ? (
                            <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-rose-200">
                              Restricted
                            </span>
                          ) : (
                            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-emerald-200">
                              Open
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-xs text-slate-400">
                          {row.restriction_reason || 'No restriction reason set'}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-300">
                        <p>Single: {formatCap(row.single_txn_limit_cents)}</p>
                        <p>Daily: {formatCap(row.daily_limit_cents)}</p>
                        <p>Weekly: {formatCap(row.weekly_limit_cents)}</p>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-300">
                        <p className="capitalize">{row.provider_freeze_status || 'Not requested'}</p>
                        <p className="mt-1 text-slate-500">
                          {row.provider_freeze_requested_at
                            ? dateFormater(row.provider_freeze_requested_at)
                            : 'No freeze request yet'}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-300">
                        {row.latest_risk_event ? (
                          <>
                            <p className="font-medium text-slate-100">
                              {row.latest_risk_event.trigger_type}
                            </p>
                            <p className="mt-1 capitalize text-slate-400">
                              {row.latest_risk_event.action_taken}
                            </p>
                            <p className="mt-1 text-slate-500">
                              {dateFormater(row.latest_risk_event.created_at)}
                            </p>
                          </>
                        ) : (
                          <p className="text-slate-500">No risk events recorded</p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <NavLink
                          to={`/admin/users/${row.user_id}`}
                          className="inline-flex items-center rounded-lg bg-sky-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-sky-500"
                        >
                          Review
                        </NavLink>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

export default RiskMonitoring
