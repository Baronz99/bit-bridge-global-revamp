import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'

import { createAccountStatement, listAccountStatements } from '../../../api/accountStatements'

const STATUS_STYLES = {
  pending: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
  ready: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
  failed: 'border-red-400/30 bg-red-400/10 text-red-100',
}

const moneyFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const dateFormatter = new Intl.DateTimeFormat('en-NG', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

const dateTimeFormatter = new Intl.DateTimeFormat('en-NG', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const toInputDate = (date) => {
  const value = new Date(date)
  if (Number.isNaN(value.getTime())) return ''
  return value.toISOString().slice(0, 10)
}

const formatMoneyFromCents = (value) => {
  const amount = Number(value || 0) / 100
  return moneyFormatter.format(amount)
}

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : dateFormatter.format(date)
}

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : dateTimeFormatter.format(date)
}

const dayDifference = (from, to) => {
  const fromDate = new Date(from)
  const toDate = new Date(to)
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return Number.NaN
  const diff = toDate.getTime() - fromDate.getTime()
  return Math.floor(diff / 86_400_000)
}

export default function StatementsPanel() {
  const [statements, setStatements] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [range, setRange] = useState(() => {
    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

    return {
      date_from: toInputDate(monthStart),
      date_to: toInputDate(today),
    }
  })

  const loadStatements = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    setErrorMessage('')

    try {
      const data = await listAccountStatements()
      setStatements(data)
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        'Unable to load statements right now.'
      setErrorMessage(message)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadStatements()
  }, [])

  const hasPendingStatements = useMemo(
    () => statements.some((statement) => statement?.status === 'pending'),
    [statements]
  )

  useEffect(() => {
    if (!hasPendingStatements) return undefined

    const timeoutId = window.setTimeout(() => {
      loadStatements({ silent: true })
    }, 15000)

    return () => window.clearTimeout(timeoutId)
  }, [hasPendingStatements, statements])

  const handleRangeChange = (field, value) => {
    setRange((current) => ({ ...current, [field]: value }))
  }

  const validateRange = () => {
    if (!range.date_from || !range.date_to) {
      toast('Select a valid statement period.', { type: 'error' })
      return false
    }

    if (range.date_to < range.date_from) {
      toast('End date must be on or after the start date.', { type: 'error' })
      return false
    }

    if (dayDifference(range.date_from, range.date_to) > 90) {
      toast('Statement range must be within 90 days.', { type: 'error' })
      return false
    }

    return true
  }

  const handleRequestStatement = async () => {
    if (!validateRange()) return

    try {
      setSubmitting(true)
      const statement = await createAccountStatement(range)
      setStatements((current) => [statement, ...current.filter((item) => item.id !== statement.id)])
      toast('Statement request submitted. We will prepare it shortly.', { type: 'success' })
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        'Unable to request a statement right now.'
      toast(message, { type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const openDownload = (statement) => {
    if (!statement?.download_url) return
    window.open(statement.download_url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Statement of account</h2>
        <p className="text-sm text-gray-400 mt-1">
          Request a PDF statement for your personal NGN wallet instead of relying on balance snapshots in email.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-white">Request a statement</h3>
          <p className="text-sm text-slate-300/80 mt-1">
            Statements include opening balance, closing balance, credits, debits, fees, and posted transactions for the selected period.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="block text-sm font-medium text-slate-200/80">Start date</span>
            <input
              type="date"
              value={range.date_from}
              onChange={(event) => handleRangeChange('date_from', event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-600/50"
            />
          </label>

          <label className="space-y-2">
            <span className="block text-sm font-medium text-slate-200/80">End date</span>
            <input
              type="date"
              value={range.date_to}
              onChange={(event) => handleRangeChange('date_to', event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-600/50"
            />
          </label>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-300/70">
            Up to 90 days per request. Statements are prepared on demand and stay available for download when ready.
          </div>
          <button
            type="button"
            onClick={handleRequestStatement}
            disabled={submitting}
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-blue-600/90 text-white font-semibold hover:bg-blue-600 transition disabled:opacity-60"
          >
            {submitting ? 'Requesting...' : 'Request statement'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Recent statements</h3>
            <p className="text-sm text-slate-300/80 mt-1">
              Download ready statements or monitor requests that are still being prepared.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadStatements()}
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-white font-semibold hover:bg-white/10 transition"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300/80">
            Loading statements...
          </div>
        ) : errorMessage ? (
          <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">
            {errorMessage}
          </div>
        ) : statements.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300/80">
            No statements yet. Request one above when you need a full account record.
          </div>
        ) : (
          <div className="space-y-3">
            {statements.map((statement) => {
              const statusClass = STATUS_STYLES[statement.status] || 'border-white/10 bg-white/5 text-slate-100'

              return (
                <div
                  key={statement.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-white">{statement.reference}</div>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${statusClass}`}>
                          {statement.status}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-slate-300/80">
                        {formatDate(statement.date_from)} to {formatDate(statement.date_to)}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        Requested {formatDateTime(statement.created_at)}
                        {statement.generated_at ? ` • Ready ${formatDateTime(statement.generated_at)}` : ''}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      {statement.download_url ? (
                        <button
                          type="button"
                          onClick={() => openDownload(statement)}
                          className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600/90 text-white font-semibold hover:bg-emerald-600 transition"
                        >
                          Download PDF
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {statement.status === 'failed' && statement.failure_reason ? (
                    <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-3 text-sm text-red-100">
                      {statement.failure_reason}
                    </div>
                  ) : null}

                  {statement.status === 'ready' ? (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-xl border border-white/10 bg-[#0d1324] px-3 py-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Opening</div>
                        <div className="mt-2 text-sm font-semibold text-white">{formatMoneyFromCents(statement.opening_balance_cents)}</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-[#0d1324] px-3 py-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Closing</div>
                        <div className="mt-2 text-sm font-semibold text-white">{formatMoneyFromCents(statement.closing_balance_cents)}</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-[#0d1324] px-3 py-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Credits</div>
                        <div className="mt-2 text-sm font-semibold text-white">{formatMoneyFromCents(statement.total_credits_cents)}</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-[#0d1324] px-3 py-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Transactions</div>
                        <div className="mt-2 text-sm font-semibold text-white">{Number(statement.transaction_count || 0).toLocaleString('en-NG')}</div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
