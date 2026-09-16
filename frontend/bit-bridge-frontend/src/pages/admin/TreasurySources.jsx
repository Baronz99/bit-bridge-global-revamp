import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { getAdminTreasurySourcesAnalytics } from '../../api/adminTreasurySources'
import dateFormater from '../../utils/dateFormat'
import nairaFormat from '../../utils/nairaFormat'

const emptyValue = 'N/A'

const compact = (value) => {
  if (value === null || value === undefined || value === '') return emptyValue
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

const firstValue = (...values) => values.find((value) => value !== null && value !== undefined && value !== '')

const formatDateTime = (value) => {
  if (!value) return emptyValue
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return compact(value)
  return `${dateFormater(value)} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

const formatMoney = (value, currency = 'NGN', cents = false) => {
  if (value === null || value === undefined || value === '') return emptyValue
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return compact(value)
  const amount = cents ? numeric / 100 : numeric
  return nairaFormat(amount, currency)
}

const formatRecordMoney = (record, centsKey, amountKey, currencyKey = 'currency') => {
  const centsValue = record?.[centsKey]
  if (centsValue !== null && centsValue !== undefined && centsValue !== '') {
    return formatMoney(centsValue, record?.[currencyKey] || 'NGN', true)
  }
  return formatMoney(record?.[amountKey], record?.[currencyKey] || 'NGN')
}

const renderObject = (value) => {
  if (!value || typeof value !== 'object') return compact(value)
  return (
    <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950 p-2 text-[11px] text-slate-300">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

const statusTone = (status) => {
  switch (String(status || '').toLowerCase()) {
    case 'success':
    case 'successful':
    case 'completed':
    case 'posted':
      return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
    case 'pending':
    case 'processing':
      return 'border-amber-400/30 bg-amber-400/10 text-amber-200'
    case 'failed':
    case 'reversed':
    case 'declined':
      return 'border-rose-400/30 bg-rose-400/10 text-rose-200'
    default:
      return 'border-slate-700 bg-slate-800 text-slate-200'
  }
}

const varianceTone = (value) => {
  if (value === null || value === undefined || value === '') return 'border-slate-700 bg-slate-800 text-slate-200'
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric === 0) {
    return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
  }
  return numeric < 0
    ? 'border-rose-400/30 bg-rose-400/10 text-rose-200'
    : 'border-amber-400/30 bg-amber-400/10 text-amber-200'
}

const detailItems = (account, providerBalance) => {
  const providerBalanceIsObject = providerBalance && typeof providerBalance === 'object'
  const providerBalanceValue = providerBalanceIsObject
    ? firstValue(providerBalance?.balance, providerBalance?.provider_balance, account?.provider_balance)
    : providerBalance

  return [
    { label: 'Account number', value: account?.account_number },
    { label: 'Account name', value: account?.account_name },
    { label: 'Bank name', value: account?.bank_name },
    {
      label: 'Vendor',
      value: firstValue(account?.vendor, account?.provider, providerBalance?.vendor, providerBalance?.provider),
    },
    { label: 'Account type', value: firstValue(account?.account_type, account?.type) },
    { label: 'Useable ID', value: firstValue(account?.useable_id, account?.usable_id) },
    {
      label: 'Provider balance',
      value: providerBalanceValue,
      money: true,
    },
    { label: 'Synced at', value: firstValue(providerBalance?.synced_at, account?.synced_at), date: true },
    {
      label: 'Available balance',
      value: firstValue(providerBalance?.available_balance, providerBalance?.available, account?.available_balance),
      money: true,
    },
    {
      label: 'Ledger balance',
      value: firstValue(providerBalance?.ledger_balance, providerBalance?.ledger, account?.ledger_balance),
      money: true,
    },
  ]
}

const summaryItems = (summary) => [
  { label: 'Transfer count', value: firstValue(summary?.transfer_count, summary?.count, 0), count: true },
  {
    label: 'Total principal',
    value: firstValue(summary?.total_principal_cents, summary?.principal_cents),
    fallback: firstValue(summary?.total_principal, summary?.principal),
  },
  {
    label: 'Total fee',
    value: firstValue(summary?.total_fee_cents, summary?.fee_cents),
    fallback: firstValue(summary?.total_fee, summary?.fee),
  },
  {
    label: 'Total debit',
    value: firstValue(summary?.total_debit_cents, summary?.debit_cents),
    fallback: firstValue(summary?.total_debit, summary?.debit),
  },
]

const reconciliationItems = (reconciliation) => [
  {
    label: 'Status',
    value: compact(reconciliation?.status),
  },
  {
    label: 'Prev snapshot',
    value: reconciliation?.previous_snapshot_balance_cents,
    money: true,
  },
  {
    label: 'Live balance',
    value: reconciliation?.live_balance_cents,
    money: true,
  },
  {
    label: 'Expected balance',
    value: reconciliation?.expected_balance_cents,
    money: true,
  },
  {
    label: 'Variance',
    value: reconciliation?.variance_cents,
    money: true,
  },
  {
    label: 'Journal balance',
    value: reconciliation?.journal_balance_cents,
    money: true,
  },
  {
    label: 'Journal variance',
    value: reconciliation?.journal_variance_cents,
    money: true,
  },
  {
    label: 'Records since sync',
    value: reconciliation?.records_since_sync_count,
    count: true,
  },
]

const TreasurySources = () => {
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const response = await getAdminTreasurySourcesAnalytics()
      setPayload(response?.data?.data || response?.data || null)
    } catch (loadError) {
      setPayload(null)
      setError(
        loadError?.response?.data?.message ||
          loadError?.message ||
          'Unable to load treasury source analytics.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const treasuryAccount = useMemo(() => payload?.treasury_account || {}, [payload])
  const providerBalance = useMemo(() => payload?.provider_balance ?? {}, [payload])
  const transferSummary = useMemo(() => payload?.transfer_summary || {}, [payload])
  const reconciliation = useMemo(() => payload?.reconciliation || {}, [payload])
  const treasuryJournal = useMemo(() => payload?.treasury_journal || {}, [payload])
  const transferRecords = Array.isArray(payload?.transfer_records) ? payload.transfer_records : []
  const range = payload?.range || {}
  const treasuryJournalEntries = Array.isArray(treasuryJournal?.recent_entries) ? treasuryJournal.recent_entries : []

  const accountDetails = useMemo(
    () => detailItems(treasuryAccount, providerBalance),
    [providerBalance, treasuryAccount]
  )
  const transferSummaryItems = useMemo(() => summaryItems(transferSummary), [transferSummary])
  const reconciliationItemsList = useMemo(
    () => reconciliationItems(reconciliation),
    [reconciliation]
  )
  const reconciliationVariance = Number(reconciliation?.variance_cents ?? 0)
  const reconciliationHasVariance = Number.isFinite(reconciliationVariance) && reconciliationVariance !== 0
  const reconciliationAvailable = reconciliation?.status !== 'unavailable'

  const hasPayload = Boolean(payload && Object.keys(payload).length > 0)

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Admin analytics</p>
            <h1 className="text-2xl font-semibold md:text-3xl">Treasury source dashboard</h1>
            <p className="mt-1 text-sm text-slate-400">
              Read-only treasury source account, provider balance, and transfer reconciliation visibility.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={loadDashboard}
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
                onClick={loadDashboard}
                className="rounded-lg bg-rose-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-rose-400"
              >
                Retry
              </button>
            </div>
          </div>
        ) : null}

        {!loading && !error && !hasPayload ? (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/70 px-4 py-8 text-center text-sm text-slate-400">
            Treasury source analytics returned no data.
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-4">
          {transferSummaryItems.map((item) => {
            const hasCentsValue = item.value !== null && item.value !== undefined && item.value !== ''
            return (
              <div
                key={item.label}
                className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
                <p className="mt-3 text-3xl font-semibold text-slate-100">
                  {loading
                    ? '...'
                    : item.count
                      ? compact(item.value)
                      : hasCentsValue
                        ? formatMoney(item.value, transferSummary?.currency || 'NGN', true)
                        : formatMoney(item.fallback, transferSummary?.currency || 'NGN')}
                </p>
              </div>
            )
          })}
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Treasury source account</h2>
              <p className="mt-1 text-xs text-slate-400">
                Provider-backed account, latest synced snapshot, and reconciliation drift.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-400">
              Range: {compact(firstValue(range?.label, range?.name))}
              {range?.date_from || range?.from ? ` | From ${compact(firstValue(range?.date_from, range?.from))}` : ''}
              {range?.date_to || range?.to ? ` | To ${compact(firstValue(range?.date_to, range?.to))}` : ''}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {accountDetails.map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                <p className="mt-2 break-words text-sm font-medium text-slate-100">
                  {loading
                    ? 'Loading...'
                    : item.date
                      ? formatDateTime(item.value)
                      : item.money
                        ? formatMoney(item.value, providerBalance?.currency || treasuryAccount?.currency || 'NGN')
                        : compact(item.value)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className={`rounded-2xl border p-6 shadow-sm ${reconciliationHasVariance ? 'border-amber-400/30 bg-amber-400/10' : 'border-slate-800 bg-slate-900/80'}`}>
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Reconciliation check</h2>
              <p className="mt-1 text-xs text-slate-400">
                Compares the previous synced provider snapshot with the latest live provider balance and locally recorded treasury withdrawals since that snapshot.
              </p>
            </div>
            <div className={`rounded-xl border px-3 py-2 text-xs ${varianceTone(reconciliation?.variance_cents)}`}>
              {reconciliationAvailable
                ? reconciliationHasVariance
                  ? 'Variance detected'
                  : 'In sync'
                : 'Unavailable'}
            </div>
          </div>

          {!reconciliationAvailable ? (
            <p className="text-sm text-slate-400">
              Reconciliation is unavailable until the treasury source has a synced provider snapshot.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              {reconciliationItemsList.map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                  <p className={`mt-2 break-words text-sm font-medium ${item.label === 'Variance' ? 'text-slate-100' : 'text-slate-100'}`}>
                    {loading
                      ? 'Loading...'
                      : item.count
                        ? compact(item.value)
                        : item.money
                          ? formatMoney(item.value, reconciliation?.currency || treasuryAccount?.currency || 'NGN', true)
                          : compact(item.value)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Treasury journal</h2>
              <p className="mt-1 text-xs text-slate-400">
                Internal balance journal for the treasury source. Snapshot refreshes and treasury-mode withdrawals are recorded here.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-400">
              Balance: {formatMoney(treasuryJournal?.balance_cents, treasuryAccount?.currency || providerBalance?.currency || 'NGN', true)}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Entry count</p>
              <p className="mt-2 text-sm font-medium text-slate-100">
                {loading ? 'Loading...' : compact(treasuryJournal?.entry_count)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Latest entry type</p>
              <p className="mt-2 text-sm font-medium text-slate-100">
                {loading ? 'Loading...' : compact(treasuryJournalEntries[0]?.entry_type)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Latest entry</p>
              <p className="mt-2 text-sm font-medium text-slate-100">
                {loading ? 'Loading...' : formatMoney(treasuryJournalEntries[0]?.balance_after_cents, treasuryAccount?.currency || providerBalance?.currency || 'NGN', true)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Last synced</p>
              <p className="mt-2 text-sm font-medium text-slate-100">
                {loading ? 'Loading...' : formatDateTime(treasuryJournalEntries[0]?.provider_synced_at || treasuryJournalEntries[0]?.created_at)}
              </p>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-slate-400">
                  <th className="px-3 py-2">Created at</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Before</th>
                  <th className="px-3 py-2">After</th>
                  <th className="px-3 py-2">Reference</th>
                  <th className="px-3 py-2">Provider</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                      Loading treasury journal...
                    </td>
                  </tr>
                ) : treasuryJournalEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                      No treasury journal entries found.
                    </td>
                  </tr>
                ) : (
                  treasuryJournalEntries.map((entry, index) => (
                    <tr key={entry?.id || entry?.reference || index} className="border-b border-slate-800/80 align-top">
                      <td className="px-3 py-3 text-xs text-slate-300">{formatDateTime(entry?.created_at)}</td>
                      <td className="px-3 py-3 text-slate-100">{compact(entry?.entry_type)}</td>
                      <td className="px-3 py-3 text-slate-100">{formatMoney(entry?.amount_cents, entry?.currency || treasuryAccount?.currency || 'NGN', true)}</td>
                      <td className="px-3 py-3 text-slate-100">{formatMoney(entry?.balance_before_cents, entry?.currency || treasuryAccount?.currency || 'NGN', true)}</td>
                      <td className="px-3 py-3 text-slate-100">{formatMoney(entry?.balance_after_cents, entry?.currency || treasuryAccount?.currency || 'NGN', true)}</td>
                      <td className="px-3 py-3 text-xs text-slate-300 break-all">{compact(entry?.reference)}</td>
                      <td className="px-3 py-3 text-xs text-slate-300 break-all">{compact(entry?.provider_transfer_id || entry?.provider_reference || entry?.provider_transaction_id)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Transfer records</h2>
            <p className="mt-1 text-xs text-slate-400">
              Read-only transfer source, wallet, provider status, and ledger reference data.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-slate-400">
                  <th className="px-3 py-2">Created at</th>
                  <th className="px-3 py-2">User / wallet</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Fee</th>
                  <th className="px-3 py-2">Total debit</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Provider</th>
                  <th className="px-3 py-2">References</th>
                  <th className="px-3 py-2">Wallet balance snapshot</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-slate-400">
                      Loading treasury source transfers...
                    </td>
                  </tr>
                ) : transferRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                      No treasury source transfer records found.
                    </td>
                  </tr>
                ) : (
                  transferRecords.map((record, index) => (
                    <tr
                      key={record?.id || record?.transaction_reference || index}
                      className="border-b border-slate-800/80 align-top"
                    >
                      <td className="px-3 py-3 text-xs text-slate-300">
                        {formatDateTime(record?.created_at)}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-slate-100">
                          {compact(firstValue(record?.user_name, record?.user?.full_name, record?.user?.email, record?.user_id))}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Wallet: {compact(firstValue(record?.wallet_name, record?.wallet?.name, record?.wallet_id))}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Type: {compact(firstValue(record?.wallet_type, record?.wallet?.wallet_type, record?.wallet?.currency))}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-slate-100">
                        {formatRecordMoney(record, 'amount_cents', 'amount')}
                      </td>
                      <td className="px-3 py-3 text-slate-100">
                        {formatRecordMoney(record, 'fee_cents', 'fee')}
                      </td>
                      <td className="px-3 py-3 text-slate-100">
                        {formatRecordMoney(record, 'total_debit_cents', 'total_debit')}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-300">
                        <p>Mode: {compact(record?.source_mode)}</p>
                        <p className="mt-1">Account: {compact(record?.source_account_number)}</p>
                        <p className="mt-1 text-slate-500">
                          Useable ID: {compact(firstValue(record?.source_account_useable_id, record?.source_account_usable_id))}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${statusTone(record?.provider_status)}`}>
                          {compact(record?.provider_status)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-300">
                        <p>Txn: {compact(record?.transaction_reference)}</p>
                        <p className="mt-1">Record: {compact(record?.transaction_record_reference)}</p>
                        <p className="mt-1 text-slate-500">
                          Debit: {compact(record?.debit_entry_reference)}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-300">
                        {renderObject(firstValue(record?.wallet_balance_snapshot, record?.wallet_snapshot))}
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

export default TreasurySources
