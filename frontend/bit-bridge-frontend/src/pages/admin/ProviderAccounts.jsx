import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { getAdminProviderAccounts } from '../../api/adminProviderAccounts'
import dateFormater from '../../utils/dateFormat'
import nairaFormat from '../../utils/nairaFormat'

const emptyValue = 'N/A'

const compact = (value) => {
  if (value === null || value === undefined || value === '') return emptyValue
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

const formatDateTime = (value) => {
  if (!value) return emptyValue
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return compact(value)
  return `${dateFormater(value)} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

const formatMoney = (balance) => {
  if (!balance?.available) return 'Unavailable'
  const cents = balance?.balance_cents ?? balance?.available_cents ?? balance?.book_cents
  if (cents === null || cents === undefined || cents === '') return 'Unavailable'
  return nairaFormat(Number(cents) / 100, balance?.currency || 'NGN')
}

const balanceTone = (balance) => {
  if (balance?.available) return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
  return 'border-amber-400/30 bg-amber-400/10 text-amber-100'
}

const roleLabel = (role) =>
  String(role || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || emptyValue

const badgeTone = (tone) => {
  switch (tone) {
    case 'success':
      return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
    case 'warning':
      return 'border-amber-400/30 bg-amber-400/10 text-amber-100'
    case 'danger':
      return 'border-rose-400/30 bg-rose-400/10 text-rose-100'
    default:
      return 'border-slate-700 bg-slate-800 text-slate-200'
  }
}

const ProviderAccounts = () => {
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadProviderAccounts = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const response = await getAdminProviderAccounts()
      setPayload(response?.data?.data || null)
    } catch (loadError) {
      setPayload(null)
      setError(
        loadError?.response?.data?.message ||
          loadError?.message ||
          'Unable to load provider accounts.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProviderAccounts()
  }, [loadProviderAccounts])

  const records = Array.isArray(payload?.records) ? payload.records : []
  const warnings = Array.isArray(payload?.warnings) ? payload.warnings : []
  const summary = payload?.summary || {}
  const roles = useMemo(() => Object.entries(summary?.roles || {}), [summary?.roles])

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Admin operations</p>
            <h1 className="text-2xl font-semibold md:text-3xl">Provider account registry</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">
              Read-only view of provider accounts, internal roles, provider balance snapshots, and
              platform ledger balances.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={loadProviderAccounts}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            <NavLink
              to="/admin/dashboard"
              className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-800"
            >
              Back to dashboard
            </NavLink>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p>{error}</p>
              <button
                type="button"
                onClick={loadProviderAccounts}
                className="rounded-lg bg-rose-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-rose-400"
              >
                Retry
              </button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Known accounts</p>
            <p className="mt-3 text-3xl font-semibold">{loading ? '...' : compact(summary?.total_accounts || 0)}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Provider balances</p>
            <p className="mt-3 text-3xl font-semibold">
              {loading ? '...' : compact(summary?.provider_balance_available || 0)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Platform balances</p>
            <p className="mt-3 text-3xl font-semibold">
              {loading ? '...' : compact(summary?.platform_balance_available || 0)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Warnings</p>
            <p className="mt-3 text-3xl font-semibold">{loading ? '...' : compact(warnings.length)}</p>
          </div>
        </div>

        {warnings.length > 0 ? (
          <section className="space-y-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5">
            <div>
              <h2 className="text-lg font-semibold text-amber-100">Registry warnings</h2>
              <p className="mt-1 text-xs text-amber-100/80">
                These need review before using the affected account for new inflow or payout flows.
              </p>
            </div>
            {warnings.map((warning) => (
              <div key={`${warning.code}-${warning.provider_account_id || warning.account_number}`} className="rounded-xl border border-amber-400/20 bg-slate-950/60 p-3 text-sm">
                <p className="font-medium text-amber-100">{warning.message}</p>
                <p className="mt-1 text-xs text-amber-100/70">
                  {compact(warning.records?.map((record) => record.internal_label).join(' | '))}
                </p>
              </div>
            ))}
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Accounts</h2>
              <p className="mt-1 text-xs text-slate-400">
                Provider balance is the banking partner snapshot. Platform balance is our ledger or
                wallet balance when a platform wallet is linked.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-400">
              Generated: {formatDateTime(payload?.generated_at)}
            </div>
          </div>

          {roles.length > 0 ? (
            <div className="mb-5 flex flex-wrap gap-2">
              {roles.map(([role, count]) => (
                <span key={role} className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300">
                  {roleLabel(role)}: {count}
                </span>
              ))}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-slate-400">
                  <th className="px-3 py-2">Internal role</th>
                  <th className="px-3 py-2">Account</th>
                  <th className="px-3 py-2">Provider identifiers</th>
                  <th className="px-3 py-2">Provider balance</th>
                  <th className="px-3 py-2">Platform balance</th>
                  <th className="px-3 py-2">Linked object</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                      Loading provider accounts...
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                      No provider accounts found.
                    </td>
                  </tr>
                ) : (
                  records.map((record) => (
                    <tr key={record.registry_key} className="border-b border-slate-800/80 align-top">
                      <td className="px-3 py-3">
                        <p className="font-semibold text-slate-100">{compact(record.internal_label)}</p>
                        <p className="mt-1 text-xs text-slate-400">{roleLabel(record.role)}</p>
                        {Array.isArray(record.badges) && record.badges.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {record.badges.map((badge) => (
                              <span
                                key={badge.code || badge.label}
                                className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${badgeTone(badge.tone)}`}
                              >
                                {compact(badge.label)}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-300">
                        <p className="font-medium text-slate-100">{compact(record.account_number)}</p>
                        <p className="mt-1">{compact(record.account_name)}</p>
                        <p className="mt-1 text-slate-500">{compact(record.bank_name)}</p>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-300">
                        <p>Provider: {compact(record.provider)}</p>
                        <p className="mt-1">Customer: {compact(record.provider_customer_id)}</p>
                        <p className="mt-1">Account: {compact(record.provider_account_id)}</p>
                        <p className="mt-1">Acct No ID: {compact(record.provider_virtual_account_id)}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-xl border px-3 py-2 text-sm font-semibold ${balanceTone(record.provider_balance)}`}>
                          {formatMoney(record.provider_balance)}
                        </span>
                        <p className="mt-2 text-xs text-slate-500">
                          {compact(record.provider_balance?.source)} | {formatDateTime(record.provider_balance?.synced_at)}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-xl border px-3 py-2 text-sm font-semibold ${balanceTone(record.platform_balance)}`}>
                          {formatMoney(record.platform_balance)}
                        </span>
                        <p className="mt-2 text-xs text-slate-500">
                          {compact(record.platform_balance?.source)} | {formatDateTime(record.platform_balance?.synced_at)}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-300">
                        <p>{compact(record.linked_object?.type)}</p>
                        <p className="mt-1 text-slate-500">{compact(record.linked_object?.id)}</p>
                        {record.linked_object?.circle_name ? (
                          <p className="mt-1 text-slate-400">{record.linked_object.circle_name}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-300">
                        <p>Status: {compact(record.status)}</p>
                        <p className="mt-1">Active: {compact(record.active)}</p>
                        <p className="mt-1 text-slate-500">Updated: {formatDateTime(record.last_updated_at)}</p>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-400">
                        {Array.isArray(record.configured_for) && record.configured_for.length > 0 ? (
                          <div className="mb-2 rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-2 text-emerald-100">
                            <p className="font-semibold">Configured for</p>
                            <p className="mt-1">{record.configured_for.map(roleLabel).join(', ')}</p>
                            <p className="mt-1 text-emerald-100/70">
                              Source: {compact(record.configuration_source)}
                            </p>
                          </div>
                        ) : null}
                        {Array.isArray(record.notes) && record.notes.length > 0 ? (
                          record.notes.map((note) => <p key={note} className="mb-1">{note}</p>)
                        ) : (
                          <p>{emptyValue}</p>
                        )}
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

export default ProviderAccounts
