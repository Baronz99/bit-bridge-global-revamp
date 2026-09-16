import { UserAddOutlined } from '@ant-design/icons'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { NavLink } from 'react-router-dom'
import { PiHandDepositBold, PiHandWithdrawFill } from 'react-icons/pi'
import { getTransactions } from '../../redux/actions/transaction'
import { getStatistics } from '../../redux/actions/statistics'
import { getServiceCatalog } from '../../api/catalog'
import { getAdminTransactionTotals } from '../../api/adminDashboardMetrics'
import { mapCatalogToAdminActions } from '../../utils/catalogServices'
import Spinner from '../../components/spiner/Spinner'
import dateFormater from '../../utils/dateFormat'
import nairaFormat from '../../utils/nairaFormat'
import statusStyle from '../../utils/statusStyle'

const TRANSACTION_RANGE_OPTIONS = [
  { key: 'all_time', label: 'All-time' },
  { key: 'today', label: 'Today' },
  { key: 'last_7_days', label: 'Last 7 days' },
  { key: 'last_30_days', label: 'Last 30 days' },
  { key: 'custom', label: 'Custom range' },
]

const transactionCountFormatter = new Intl.NumberFormat('en-NG', {
  maximumFractionDigits: 0,
})

const ngnFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const formatDateInputValue = (value) => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const shiftDate = (value, offsetDays) => {
  const next = new Date(value)
  next.setDate(next.getDate() + offsetDays)
  return next
}

const buildTransactionTotalsParams = (rangeKey, customRange) => {
  const today = new Date()
  const todayString = formatDateInputValue(today)

  switch (rangeKey) {
    case 'today':
      return { date_from: todayString, date_to: todayString }
    case 'last_7_days':
      return {
        date_from: formatDateInputValue(shiftDate(today, -6)),
        date_to: todayString,
      }
    case 'last_30_days':
      return {
        date_from: formatDateInputValue(shiftDate(today, -29)),
        date_to: todayString,
      }
    case 'custom':
      if (!customRange.dateFrom || !customRange.dateTo) return null
      return {
        date_from: customRange.dateFrom,
        date_to: customRange.dateTo,
      }
    case 'all_time':
    default:
      return {}
  }
}

const formatNgnAmount = (value) => {
  const numeric = Number(value || 0)
  return ngnFormatter.format(Number.isFinite(numeric) ? numeric : 0)
}

const formatCount = (value) => {
  const numeric = Number(value || 0)
  return transactionCountFormatter.format(Number.isFinite(numeric) ? numeric : 0)
}

const transactionBreakdownItems = (breakdown = {}) => [
  {
    key: 'deposits',
    label: 'Deposits',
    value: breakdown?.deposits,
    accent: 'text-emerald-300',
  },
  {
    key: 'transfers',
    label: 'Transfers',
    value: breakdown?.transfers,
    accent: 'text-sky-300',
  },
  {
    key: 'bills',
    label: 'Bills',
    value: breakdown?.bills,
    accent: 'text-amber-300',
  },
  {
    key: 'treasury_inflows',
    label: 'Treasury inflows',
    value: breakdown?.treasury_inflows,
    accent: 'text-violet-300',
  },
]

const AdminHome = () => {
  const dispatch = useDispatch()
  const { user, loading: authLoading } = useSelector((state) => state.auth)
  const {
    transactions,
    loading: transactionsLoading,
    message: transactionsError,
  } = useSelector((state) => state.transaction)
  const { stats, loading: statsLoading, message: statsError } = useSelector(
    (state) => state.stat
  )
  const [catalogItems, setCatalogItems] = useState([])
  const [hasFetchedDashboard, setHasFetchedDashboard] = useState(false)
  const [transactionTotals, setTransactionTotals] = useState(null)
  const [transactionTotalsLoading, setTransactionTotalsLoading] = useState(false)
  const [transactionTotalsError, setTransactionTotalsError] = useState('')
  const [transactionRange, setTransactionRange] = useState('all_time')
  const [customDateRange, setCustomDateRange] = useState({
    dateFrom: '',
    dateTo: '',
  })

  useEffect(() => {
    if (authLoading || !user?.admin) return

    dispatch(getTransactions({ params: { summary: true, limit: 30 } }))
    dispatch(getStatistics())
    setHasFetchedDashboard(true)
  }, [authLoading, dispatch, user?.admin])

  useEffect(() => {
    let active = true

    const loadCatalog = async () => {
      try {
        const response = await getServiceCatalog()
        if (!active) return
        setCatalogItems(Array.isArray(response?.data?.data) ? response.data.data : [])
      } catch {
        if (!active) return
        setCatalogItems([])
      }
    }

    loadCatalog()

    return () => {
      active = false
    }
  }, [])

  const loadTransactionTotals = useCallback(
    async (rangeKey, customRange = customDateRange) => {
      if (!user?.admin) return

      const params = buildTransactionTotalsParams(rangeKey, customRange)
      if (rangeKey === 'custom' && !params) {
        setTransactionTotals(null)
        setTransactionTotalsError('Choose both a start date and end date to load a custom range.')
        return
      }

      try {
        setTransactionTotalsLoading(true)
        setTransactionTotalsError('')
        const response = await getAdminTransactionTotals(params || {})
        setTransactionTotals(response?.data || null)
      } catch (error) {
        setTransactionTotals(null)
        setTransactionTotalsError(
          error?.response?.data?.message ||
            error?.message ||
            'Unable to load transaction totals right now.'
        )
      } finally {
        setTransactionTotalsLoading(false)
      }
    },
    [customDateRange, user?.admin]
  )

  useEffect(() => {
    if (authLoading || !user?.admin) return
    if (transactionRange === 'custom') return

    loadTransactionTotals(transactionRange)
  }, [authLoading, loadTransactionTotals, transactionRange, user?.admin])

  const adminServiceActions = useMemo(
    () => mapCatalogToAdminActions(catalogItems),
    [catalogItems]
  )

  const dashboardLoading =
    authLoading || (!hasFetchedDashboard && user?.admin) || statsLoading || transactionsLoading
  const dashboardError = statsError || transactionsError
  const hasTransactions = Array.isArray(transactions) && transactions.length > 0
  const hasStats = Boolean(stats && Object.keys(stats).length > 0)
  const showStatsPlaceholder = dashboardLoading && !hasStats
  const breakdownItems = useMemo(
    () => transactionBreakdownItems(transactionTotals?.breakdown),
    [transactionTotals]
  )
  const hasTransactionTotals =
    Number(transactionTotals?.total_successful_transaction_count || 0) > 0 ||
    Number(transactionTotals?.total_successful_transaction_volume_ngn || 0) > 0
  const activeRangeLabel =
    TRANSACTION_RANGE_OPTIONS.find((option) => option.key === transactionRange)?.label ||
    'All-time'

  const renderStatAmount = (amount) => {
    if (showStatsPlaceholder) return 'Loading...'
    return nairaFormat(amount ?? 0)
  }

  const handleRetry = () => {
    if (!user?.admin) return
    dispatch(getTransactions({ params: { summary: true, limit: 30 } }))
    dispatch(getStatistics())
    loadTransactionTotals(transactionRange)
    setHasFetchedDashboard(true)
  }

  const handleTransactionRangeChange = (nextRange) => {
    setTransactionRange(nextRange)
    setTransactionTotalsError('')
  }

  const handleApplyCustomRange = () => {
    setTransactionRange('custom')
    loadTransactionTotals('custom', customDateRange)
  }

  const formatAdminAmount = (amount, currency, walletType) => {
    const value = Number(amount || 0)
    if (Number.isNaN(value)) return '--'
    const code =
      currency ||
      (walletType === 'usd' ? 'USD' : walletType === 'ngn' ? 'NGN' : null)
    if (!code || code.toUpperCase() === 'NGN') {
      return nairaFormat(value, 'ngn')
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code.toUpperCase(),
      minimumFractionDigits: 2,
    }).format(value)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 overflow-y-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">
            BitBridge Admin Dashboard
          </h1>
          <p className="text-slate-400 mt-1">
            Monitor users, cash flow and recent activity across the platform.
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-400">Today</p>
          <p className="text-lg font-medium">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex flex-col items-center justify-center shadow-sm">
          <UserAddOutlined className="text-3xl text-sky-400 mb-2" />
          <span className="text-slate-400 text-xs tracking-wide">
            TOTAL USERS
          </span>
          <p className="text-2xl font-semibold mt-1">
            {showStatsPlaceholder ? '...' : stats?.users ?? 0}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex flex-col items-center justify-center shadow-sm">
          <PiHandDepositBold className="text-3xl text-emerald-400 mb-2" />
          <span className="text-slate-400 text-xs tracking-wide">
            AMOUNT DEPOSITED
          </span>
          <p className="text-2xl font-semibold mt-1">
            {renderStatAmount(stats?.total_deposits)}
          </p>
          <p className="mt-2 text-[11px] text-slate-500 text-center">
            Includes platform deposits and circle treasury inflows
          </p>
        </div>

        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex flex-col items-center justify-center shadow-sm">
          <PiHandWithdrawFill className="text-3xl text-amber-400 mb-2" />
          <span className="text-slate-400 text-xs tracking-wide">
            AMOUNT WITHDRAWN
          </span>
          <p className="text-2xl font-semibold mt-1">
            {renderStatAmount(stats?.total_withdrawals)}
          </p>
        </div>
      </div>

      <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
              Gross successful NGN activity
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-100">
              Canonical transaction totals
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              View successful transaction count and gross processed value for the selected period.
            </p>
          </div>

          <div className="flex flex-col gap-3 xl:items-end">
            <div className="flex flex-wrap gap-2">
              {TRANSACTION_RANGE_OPTIONS.map((option) => {
                const active = option.key === transactionRange
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => handleTransactionRangeChange(option.key)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? 'border-sky-400/60 bg-sky-400/10 text-sky-200'
                        : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-600 hover:text-slate-100'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>

            {transactionRange === 'custom' ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="date"
                  value={customDateRange.dateFrom}
                  onChange={(event) =>
                    setCustomDateRange((prev) => ({ ...prev, dateFrom: event.target.value }))
                  }
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                />
                <input
                  type="date"
                  value={customDateRange.dateTo}
                  onChange={(event) =>
                    setCustomDateRange((prev) => ({ ...prev, dateTo: event.target.value }))
                  }
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                />
                <button
                  type="button"
                  onClick={handleApplyCustomRange}
                  className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition-colors hover:bg-sky-400"
                >
                  Apply
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Window: {activeRangeLabel}</p>
            )}
          </div>
        </div>

        {transactionTotalsError ? (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p>{transactionTotalsError}</p>
              <button
                type="button"
                onClick={() => loadTransactionTotals(transactionRange)}
                className="rounded-lg bg-rose-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-rose-400"
              >
                Retry
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            {transactionTotalsLoading ? (
              <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 text-slate-400">
                <Spinner />
                <span className="text-sm">Loading canonical transaction totals...</span>
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Total Successful Transactions
                    </p>
                    <p className="mt-3 text-4xl font-semibold text-slate-100">
                      {formatCount(transactionTotals?.total_successful_transaction_count)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Total Transaction Volume NGN
                    </p>
                    <p className="mt-3 text-4xl font-semibold text-slate-100 break-words">
                      {formatNgnAmount(transactionTotals?.total_successful_transaction_volume_ngn)}
                    </p>
                  </div>
                </div>

                <p className="mt-6 text-xs text-slate-500">
                  Generated {transactionTotals?.generated_at ? dateFormater(transactionTotals.generated_at) : 'just now'}
                </p>

                {!hasTransactionTotals ? (
                  <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-400">
                    No successful NGN activity has been recorded for this window yet.
                  </div>
                ) : null}
              </>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {breakdownItems.map((item) => (
              <div
                key={item.key}
                className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
              >
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  {item.label}
                </p>
                {transactionTotalsLoading ? (
                  <div className="mt-6 h-16 animate-pulse rounded-xl bg-slate-800/80" />
                ) : (
                  <>
                    <p className={`mt-3 text-2xl font-semibold ${item.accent}`}>
                      {formatCount(item.value?.count)}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      {formatNgnAmount(item.value?.volume_ngn)}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)] gap-6">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Transactions</h2>
            <span className="text-xs text-slate-400">
              Showing latest {transactions?.slice(0, 6).length ?? 0} records
            </span>
          </div>

          {dashboardError ? (
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p>{dashboardError}</p>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-slate-950 transition-colors hover:bg-amber-400"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-800">
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Total Amount</th>
                  <th className="py-2 px-3 text-center hidden sm:table-cell">
                    Status
                  </th>
                  <th className="py-2 px-3 text-center">Address</th>
                  <th className="py-2 px-3 text-center hidden lg:table-cell">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {hasTransactions &&
                  transactions.slice(0, 6).map((item) => (
                    <tr
                      key={item?.id}
                      className="border-b border-slate-800 hover:bg-slate-950/60"
                    >
                      <td className="whitespace-nowrap py-2 px-3 text-slate-200">
                        <p className="font-medium capitalize">
                          {item?.display_type || item?.transaction_type}
                        </p>
                        {item?.source_kind ? (
                          <p className="text-[11px] text-slate-500 capitalize">
                            {item.source_kind.replaceAll('_', ' ')}
                          </p>
                        ) : null}
                      </td>

                      <td className="whitespace-nowrap py-2 px-3 text-slate-200">
                        <p className="font-medium">
                          {formatAdminAmount(item.amount, item.currency, item.wallet_type)}
                        </p>
                      </td>

                      <td className="whitespace-nowrap py-2 px-3 text-center hidden sm:table-cell">
                        <span
                          className={`${statusStyle(
                            item?.status
                          )} py-1 px-3 rounded-full inline-block text-xs capitalize`}
                        >
                          {item.status}
                        </span>
                      </td>

                      <td className="whitespace-nowrap py-2 px-3 text-center text-slate-200">
                        {item?.address ?? 'Not Available'}
                      </td>

                      <td className="whitespace-nowrap py-2 px-3 text-center text-slate-400 hidden lg:table-cell">
                        {dateFormater(item?.created_at)}
                      </td>
                    </tr>
                  ))}

                {dashboardLoading && !hasTransactions && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-10 text-center text-slate-400 text-sm"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <Spinner />
                        <span>Loading dashboard activity...</span>
                      </div>
                    </td>
                  </tr>
                )}

                {!dashboardLoading && !hasTransactions && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-6 text-center text-slate-500 text-sm"
                    >
                      No transactions found yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-sm">
            <h2 className="text-lg font-semibold mb-1">Quick Actions</h2>
            <p className="text-xs text-slate-400 mb-3">
              Product actions are now driven from the backend service catalog.
            </p>
            <div className="flex flex-col space-y-3 text-sm">
              {adminServiceActions.map((item) => (
                <NavLink
                  key={item.key}
                  to={item.adminAction.to}
                  className="w-full text-center py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 transition-colors"
                >
                  {item.adminAction.label}
                </NavLink>
              ))}
              <NavLink
                to="/admin/add-product"
                className="w-full text-center py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-colors"
              >
                Add Product
              </NavLink>
              <NavLink
                to="/admin/query"
                className="w-full text-center py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 transition-colors"
              >
                Query Transaction
              </NavLink>
              <NavLink
                to="/admin/official-circles"
                className="w-full text-center py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
              >
                Founders Circle
              </NavLink>
              <NavLink
                to="/admin/kyc-reuse-review"
                className="w-full text-center py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 transition-colors"
              >
                Reusable BVN Review
              </NavLink>
              <NavLink
                to="/admin/risk-monitoring"
                className="w-full text-center py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-colors"
              >
                Risk Monitoring
              </NavLink>
              <NavLink
                to="/admin/treasury-sources"
                className="w-full text-center py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 transition-colors"
              >
                Treasury Sources
              </NavLink>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-sm">
            <h2 className="text-lg font-semibold mb-3">System Notes</h2>
            <p className="text-sm text-slate-400">
              You can use this space later for alerts, settlement summaries or
              integration health checks.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-sm">
            <h2 className="text-lg font-semibold mb-1">Founders Circle</h2>
            <p className="text-sm text-slate-400">
              Create the official Founders campaign and open the private contributors report from one admin surface.
            </p>
            <div className="mt-4 flex flex-col gap-3 text-sm">
              <NavLink
                to="/admin/official-circles"
                className="w-full text-center py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-colors"
              >
                Manage official circles
              </NavLink>
              <NavLink
                to="/admin/official-circles"
                className="w-full text-center py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 transition-colors"
              >
                View contributors report
              </NavLink>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-sm">
            <h2 className="text-lg font-semibold mb-1">Risk Monitoring</h2>
            <p className="text-sm text-slate-400">
              Review monitored accounts, restriction posture and provider freeze state from one compliance queue.
            </p>
            <div className="mt-4 flex flex-col gap-3 text-sm">
              <NavLink
                to="/admin/risk-monitoring"
                className="w-full text-center py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-colors"
              >
                Open risk queue
              </NavLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminHome
