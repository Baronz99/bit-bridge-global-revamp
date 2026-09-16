import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { getAdminAnchorInboundBankTransfers } from '../../api/adminAnchorInbound'
import nairaFormat from '../../utils/nairaFormat'
import dateFormater from '../../utils/dateFormat'

const STATUS_OPTIONS = [
  { value: '', label: 'All pooled inbound' },
  { value: 'unmatched', label: 'Unmatched only' },
  { value: 'review', label: 'Review only' },
  { value: 'credited', label: 'Credited' },
]

const toneForStatus = (status) => {
  switch (String(status || '').toLowerCase()) {
    case 'credited':
      return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
    case 'review':
      return 'border-amber-400/30 bg-amber-400/10 text-amber-200'
    case 'unmatched':
      return 'border-rose-400/30 bg-rose-400/10 text-rose-200'
    default:
      return 'border-slate-700 bg-slate-800 text-slate-200'
  }
}

const formatMoney = (amountCents, currency) => {
  const amount = Number(amountCents || 0) / 100
  if ((currency || 'NGN').toUpperCase() === 'NGN') return nairaFormat(amount, 'ngn')

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: (currency || 'NGN').toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount)
}

const AnchorInboundReview = () => {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('unmatched')

  useEffect(() => {
    let active = true

    const loadQueue = async () => {
      try {
        setLoading(true)
        setError('')
        const response = await getAdminAnchorInboundBankTransfers({
          status: statusFilter || undefined,
          limit: 100,
        })
        if (!active) return
        setRows(Array.isArray(response?.data?.data) ? response.data.data : [])
      } catch (loadError) {
        if (!active) return
        setError(
          loadError?.response?.data?.message ||
            'Unable to load Anchor pooled inbound transfers.'
        )
        setRows([])
      } finally {
        if (active) setLoading(false)
      }
    }

    loadQueue()

    return () => {
      active = false
    }
  }, [statusFilter])

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const status = String(row?.status || '').toLowerCase()
        if (status === 'unmatched') acc.unmatched += 1
        if (status === 'review') acc.review += 1
        if (status === 'credited') acc.credited += 1
        return acc
      },
      { unmatched: 0, review: 0, credited: 0 }
    )
  }, [rows])

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Anchor</p>
            <h1 className="text-2xl font-semibold md:text-3xl">Pooled inbound review</h1>
            <p className="mt-1 text-sm text-slate-400">
              Review pooled inbound transfers that were not auto-credited or were held for manual review.
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
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Unmatched</p>
            <p className="mt-3 text-3xl font-semibold text-slate-100">{summary.unmatched}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Review</p>
            <p className="mt-3 text-3xl font-semibold text-slate-100">{summary.review}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Credited</p>
            <p className="mt-3 text-3xl font-semibold text-slate-100">{summary.credited}</p>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Anchor pooled transfer queue</h2>
              <p className="mt-1 text-xs text-slate-400">
                Source data comes from `InboundBankTransfer` records created by the pooled matcher.
              </p>
            </div>
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
                  <th className="px-3 py-2">Transfer</th>
                  <th className="px-3 py-2">Match context</th>
                  <th className="px-3 py-2">Routing</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-slate-400">
                      Loading Anchor inbound queue...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                      No pooled Anchor transfers found for this filter.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-800/80 align-top">
                      <td className="px-3 py-3">
                        <p className="font-medium text-slate-100">
                          {formatMoney(row.amount_cents, row.currency)}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Provider ref: {row.provider_reference || 'N/A'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Payment ref: {row.payment_reference || 'N/A'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Sender: {row.sender_account_name || row.sender_name || 'Unknown'}{row.sender_account_number ? ` · ${row.sender_account_number}` : ''}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Received: {row.received_at ? dateFormater(row.received_at) : 'Unknown'}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-300">
                        <p className="font-medium text-slate-100">
                          {row.match_failure_reason || 'No failure reason'}
                        </p>
                        <p className="mt-2 text-slate-400">
                          Candidates: {Array.isArray(row.extracted_reference_candidates) && row.extracted_reference_candidates.length > 0
                            ? row.extracted_reference_candidates.join(', ')
                            : 'None'}
                        </p>
                        <p className="mt-2 text-slate-500">
                          Funding intent: {row.funding_intent_id || 'Unresolved'}
                        </p>
                        <p className="mt-1 text-slate-500">
                          Matched user: {row.matched_user_id || 'Unresolved'}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-300">
                        <p>Destination acct: {row.destination_account_number || 'N/A'}</p>
                        <p className="mt-1 text-slate-500">
                          Destination id: {row.destination_account_id || 'N/A'}
                        </p>
                        <p className="mt-1 text-slate-500">
                          Settlement id: {row.settlement_account_id || 'N/A'}
                        </p>
                        <p className="mt-1 text-slate-500">
                          Credited tx: {row.credited_transaction_id || 'None'}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${toneForStatus(row.status)}`}
                        >
                          {row.status || 'unknown'}
                        </span>
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

export default AnchorInboundReview
