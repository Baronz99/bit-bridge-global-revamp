import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import Orders from './transactions/Orders'
import Trades from './transactions/Trades'
import Loading from '../../components/loader/Loading'
import ShadowValue from '../../components/ShadowValue'
import nairaFormat from '../../utils/nairaFormat'
import { getCircleWorkspace } from '../../api/circles'
import { getTimelinePreview } from '../../api/home'
import { resolveReceiptPath } from '../../utils/receiptRouting'
import { buildCircleWorkspaceActions, extractCircleRecentActivity } from '../../utils/circleWorkspace'

const VALID_TABS = ['all', 'transactions', 'orders', 'trades', 'receipts']
const VALID_WALLETS = ['ngn', 'usd']
const VALID_TRANSACTION_VIEWS = ['deposits', 'withdrawals']

const TABS = [
  { key: 'all', label: 'All Activity' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'orders', label: 'Orders' },
  { key: 'trades', label: 'Trades' },
  { key: 'receipts', label: 'Receipts' },
]

const sectionClass =
  'rounded-3xl border border-slate-800 bg-slate-900/70 p-5 lg:p-6 shadow-[0_16px_40px_rgba(15,23,42,0.18)]'
const pillBase = 'rounded-full px-4 py-2 text-sm font-medium transition'

const formatDate = (value) => {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return date.toLocaleString()
}

const normalizeCurrency = (item) => {
  const currency = String(item?.meta?.currency || '').toUpperCase()
  if (currency === 'USD') return 'usd'
  const walletType = String(item?.meta?.wallet_type || '').toLowerCase()
  if (walletType === 'usd') return 'usd'
  return 'ngn'
}

const formatAmount = (item) => {
  const amount = Number(item?.amount_cents || 0) / 100
  if (normalizeCurrency(item) === 'usd') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount)
  }
  return nairaFormat(amount, 'ngn')
}

const statusTone = (status) => {
  const normalized = String(status || '').toLowerCase()
  if (['approved', 'completed', 'success', 'paid'].includes(normalized)) {
    return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
  }
  if (['failed', 'declined', 'cancelled', 'reversed', 'provider_unavailable', 'timedout', 'timeout'].includes(normalized)) {
    return 'text-rose-300 bg-rose-500/10 border-rose-500/20'
  }
  return 'text-amber-300 bg-amber-500/10 border-amber-500/20'
}

const humanizeKind = (value) => String(value || 'activity').replace(/_/g, ' ')

const ActivityCenter = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { ownerMode, selectedCircleId, circleEntities } = useSelector((state) => state.app || {})
  const [receiptReference, setReceiptReference] = useState('')
  const [timelineItems, setTimelineItems] = useState([])
  const [timelineLoading, setTimelineLoading] = useState(true)
  const [circleWorkspace, setCircleWorkspace] = useState(null)

  const activeTab = useMemo(() => {
    const value = searchParams.get('tab') || 'all'
    return VALID_TABS.includes(value) ? value : 'all'
  }, [searchParams])

  const walletType = useMemo(() => {
    const value = (searchParams.get('wallet') || 'ngn').toLowerCase()
    return VALID_WALLETS.includes(value) ? value : 'ngn'
  }, [searchParams])

  const transactionView = useMemo(() => {
    const value = (searchParams.get('view') || 'deposits').toLowerCase()
    return VALID_TRANSACTION_VIEWS.includes(value) ? value : 'deposits'
  }, [searchParams])

  useEffect(() => {
    let active = true

    const loadTimeline = async () => {
      setTimelineLoading(true)
      try {
        if (ownerMode === 'circle' && selectedCircleId) {
          const response = await getCircleWorkspace(selectedCircleId).catch(() => null)
          if (!active) return
          const circleData = response?.data || null
          setCircleWorkspace(circleData)
          setTimelineItems(extractCircleRecentActivity(circleData))
          return
        }

        const response = await getTimelinePreview({ limit: 40 })
        if (!active) return
        setTimelineItems(Array.isArray(response?.data?.items) ? response.data.items : [])
        setCircleWorkspace(null)
      } catch {
        if (!active) return
        setTimelineItems([])
      } finally {
        if (active) setTimelineLoading(false)
      }
    }

    loadTimeline()

    return () => {
      active = false
    }
  }, [ownerMode, selectedCircleId])
  const selectedCircle = useMemo(
    () => circleEntities?.find((circle) => String(circle?.id) === String(selectedCircleId || '')) || null,
    [circleEntities, selectedCircleId]
  )
  const activeCircle = circleWorkspace || selectedCircle
  const isCircleWorkspace = ownerMode === 'circle' && Boolean(activeCircle?.id || selectedCircleId)
  const circleName = String(activeCircle?.name || activeCircle?.title || 'Circle workspace')
  const circleRoleLabel = String(
    activeCircle?.current_user_role || activeCircle?.membership_role || activeCircle?.role || 'member'
  )
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
  const circleMembersCount = Number(activeCircle?.member_count || activeCircle?.members_count || 0)
  const circleBalance = Number(activeCircle?.balance_cents || 0) / 100
  const circleActions = useMemo(
    () => (selectedCircleId ? buildCircleWorkspaceActions(selectedCircleId, activeCircle) : []),
    [activeCircle, selectedCircleId]
  )
  const circlePermissions = activeCircle?.permissions || {}
  const circleDuesSummary = activeCircle?.dues_summary || {}

  const setTab = (tab) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    if (tab !== 'transactions') {
      next.delete('wallet')
      next.delete('view')
    }
    setSearchParams(next)
  }

  const setWallet = (wallet) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', 'transactions')
    next.set('wallet', wallet)
    setSearchParams(next)
  }

  const setView = (view) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', 'transactions')
    next.set('view', view)
    setSearchParams(next)
  }

  const transactionItems = useMemo(() => {
    return timelineItems.filter((item) => {
      if (item?.kind !== 'wallet_transaction') return false
      if (normalizeCurrency(item) !== walletType) return false
      const txType = String(item?.meta?.transaction_type || '').toLowerCase()
      return transactionView === 'withdrawals' ? txType === 'withdrawal' : txType === 'deposit'
    })
  }, [timelineItems, transactionView, walletType])

  const ledgerStats = useMemo(() => {
    const walletCount = timelineItems.filter((item) => item?.kind === 'wallet_transaction').length
    const billCount = timelineItems.filter((item) => item?.kind === 'bill_order').length
    const cardCount = timelineItems.filter((item) => item?.kind === 'card_event').length
    const circleCount = timelineItems.filter(
      (item) => item?.kind === 'circle_transaction' || item?.kind === 'circle_fund_group'
    ).length

    return [
      { label: 'Wallet movements', value: walletCount },
      { label: 'Bill activity', value: billCount },
      { label: 'Card events', value: cardCount },
      { label: 'Circle events', value: circleCount },
    ]
  }, [timelineItems])

  const renderTransactionControls = () => (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <div className="inline-flex rounded-full border border-slate-700 bg-slate-950/60 p-1">
        {VALID_WALLETS.map((wallet) => {
          const active = walletType === wallet
          return (
            <button
              key={wallet}
              type="button"
              onClick={() => setWallet(wallet)}
              className={`${pillBase} ${
                active ? 'bg-white text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              {wallet === 'ngn' ? 'NGN Wallet' : 'USD Wallet'}
            </button>
          )
        })}
      </div>

      <div className="inline-flex rounded-full border border-slate-700 bg-slate-950/60 p-1">
        {VALID_TRANSACTION_VIEWS.map((view) => {
          const active = transactionView === view
          return (
            <button
              key={view}
              type="button"
              onClick={() => setView(view)}
              className={`${pillBase} ${
                active ? 'bg-white text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              {view === 'deposits' ? 'Deposits' : 'Withdrawals'}
            </button>
          )
        })}
      </div>
    </div>
  )

  const renderReceiptsLookup = () => (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold text-white">Receipts</h3>
        <p className="mt-1 text-sm text-slate-400">
          Open an existing receipt by entering its reference.
        </p>
      </div>
      <form
        className="flex flex-col md:flex-row gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          const reference = receiptReference.trim()
          if (!reference) return
          navigate(`/dashboard/activity/receipts/${encodeURIComponent(reference)}`)
        }}
      >
        <input
          type="text"
          value={receiptReference}
          onChange={(event) => setReceiptReference(event.target.value)}
          placeholder="Enter receipt reference"
          className="flex-1 rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/60"
        />
        <button
          type="submit"
          className="rounded-2xl border border-slate-700 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
        >
          Open receipt
        </button>
      </form>
    </div>
  )

  const renderTimelineTable = (items, emptyMessage) => {
    if (timelineLoading) {
      return (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-6">
          <Loading />
        </div>
      )
    }

    if (!items.length) {
      return (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-6 text-sm text-slate-400">
          {emptyMessage}
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {items.map((item) => {
          const receiptRoute = resolveReceiptPath(item)
          const status = String(item?.status || 'pending').toLowerCase()
          return (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">{item.label || 'Activity'}</h3>
                    <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                      {humanizeKind(item.kind)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">{formatDate(item.occurred_at)}</div>
                  <div className="mt-2 text-xs text-slate-500">
                    {item?.meta?.description || item?.meta?.reference || item?.meta?.transaction_record_reference || 'BitBridge activity'}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                  <div className="text-right min-w-[8rem]">
                    <div className="text-sm font-semibold text-white">
                      <ShadowValue>{formatAmount(item)}</ShadowValue>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500 uppercase tracking-[0.16em]">
                      {normalizeCurrency(item).toUpperCase()}
                    </div>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${statusTone(status)}`}>
                    {status}
                  </span>
                  {receiptRoute ? (
                    <Link
                      to={receiptRoute}
                      className="text-xs text-alt hover:text-white transition"
                    >
                      Receipt
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  if (isCircleWorkspace) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Activity</p>
            <h1 className="mt-2 text-2xl md:text-3xl font-semibold text-white">{circleName}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Circle activity is active for this workspace. Personal wallet framing is hidden until you switch back.
            </p>
          </div>

          <section className={sectionClass}>
            <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Circle balance</div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  <ShadowValue>{nairaFormat(circleBalance, 'ngn')}</ShadowValue>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Members</div>
                <div className="mt-2 text-2xl font-semibold text-white">{circleMembersCount || 0}</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Role</div>
                <div className="mt-2 text-2xl font-semibold text-white">{circleRoleLabel}</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Actions</div>
                <button
                  type="button"
                  onClick={() => navigate(`/dashboard/shared-groups/${selectedCircleId}`)}
                  className="mt-2 text-sm font-semibold text-sky-300 hover:text-white transition"
                >
                  Open circle
                </button>
              </div>
            </div>
            {circleDuesSummary?.enabled ? (
              <div className="mb-5 rounded-2xl border border-sky-500/20 bg-slate-950/35 px-4 py-3 text-sm text-slate-300">
                Dues active:
                {' '}
                {Number(circleDuesSummary?.current_user_due_summary?.payable_months_count || 0)} open cycle(s)
              </div>
            ) : null}
            {renderTimelineTable(
              timelineItems,
              'No circle activity recorded yet. Contributions, dues, and payouts will appear here when they happen.'
            )}
          </section>

          <section className={sectionClass}>
            <div className="flex flex-wrap gap-3">
              {circleActions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  onClick={() => navigate(action.to)}
                  className={
                    action.primary
                      ? 'rounded-2xl bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-sky-300 transition'
                      : 'rounded-2xl border border-slate-700 bg-slate-900/70 px-5 py-3 text-sm font-medium text-slate-100 hover:border-slate-500 hover:text-white'
                  }
                >
                  {action.label}
                </button>
              ))}
            </div>
            {(circlePermissions.can_approve_withdrawals || circlePermissions.can_manage_governance) ? (
              <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
                {circlePermissions.can_approve_withdrawals ? (
                  <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-amber-100">
                    Approval role enabled
                  </span>
                ) : null}
                {circlePermissions.can_manage_governance ? (
                  <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-3 py-1 text-sky-100">
                    Governance access
                  </span>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Activity</p>
          <h1 className="mt-2 text-2xl md:text-3xl font-semibold text-white">Ledger center</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Review wallet movement, bill events, card activity, and receipt references from one audit surface.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-4">
          {TABS.map((tab) => {
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setTab(tab.key)}
                className={`${pillBase} ${
                  active
                    ? 'bg-white text-slate-950'
                    : 'border border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {activeTab === 'all' && (
          <section className={sectionClass}>
            <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
              {ledgerStats.map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{item.value}</div>
                </div>
              ))}
            </div>
            {renderTimelineTable(
              timelineItems,
              'No activity recorded yet. Bridge, Tunnel, bills, and circles will appear here when they happen.'
            )}
          </section>
        )}

        {activeTab === 'transactions' && (
          <section className={sectionClass}>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-white">Transactions</h2>
              <p className="mt-1 text-sm text-slate-400">
                Filter direct wallet movement by rail and direction.
              </p>
            </div>
            {renderTransactionControls()}
            {renderTimelineTable(
              transactionItems,
              `No ${transactionView} found for the ${walletType.toUpperCase()} wallet.`
            )}
          </section>
        )}

        {activeTab === 'orders' && (
          <section className={sectionClass}>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-white">Orders</h2>
            </div>
            <Orders />
          </section>
        )}

        {activeTab === 'trades' && (
          <section className={sectionClass}>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-white">Trades</h2>
            </div>
            <Trades />
          </section>
        )}

        {activeTab === 'receipts' && <section className={sectionClass}>{renderReceiptsLookup()}</section>}
      </div>
    </div>
  )
}

export default ActivityCenter


