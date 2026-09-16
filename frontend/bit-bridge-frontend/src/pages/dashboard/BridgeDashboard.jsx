import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { getCircleWorkspace } from '../../api/circles'
import ShadowValue from '../../components/ShadowValue'
import Loading from '../../components/loader/Loading'
import MoneyTransferFlow from '../../components/fundTransfer/FundTransfer'
import { getAccountSummary } from '../../redux/actions/account'
import { getTimelinePreview } from '../../api/home'
import { getSectionCatalog } from '../../api/catalog'
import { resolveReceiptPath } from '../../utils/receiptRouting'
import {
  getBridgeServicePresentation,
  isBridgeCatalogServiceType,
} from '../../utils/bridgeCatalogPresentation'
import { buildCircleWorkspaceActions, extractCircleRecentActivity } from '../../utils/circleWorkspace'

const cardClass =
  'rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.22)]'
const actionClass =
  'rounded-2xl border border-emerald-900/60 bg-slate-950/35 px-4 py-3 text-left text-sm font-medium text-slate-100 hover:border-emerald-400/60 hover:bg-slate-950/60 transition'

const uniqueBy = (items, getKey) => {
  const seen = new Set()
  return items.filter((item) => {
    const key = getKey(item)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const formatNgn = (value = 0) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

const formatDate = (value) => {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return date.toLocaleString()
}

const isBridgeItem = (item) => {
  const kind = String(item?.kind || '').toLowerCase()
  const currency = String(item?.meta?.currency || '').toUpperCase()
  const walletType = String(item?.meta?.wallet_type || '').toLowerCase()

  if (kind === 'wallet_transaction') {
    return currency !== 'USD' && walletType !== 'usd'
  }

  return ['bill_order', 'circle_transaction', 'circle_fund_group'].includes(kind)
}

const activityLabel = (item) => {
  if (item?.label) return item.label
  const kind = String(item?.kind || 'activity').replace(/_/g, ' ')
  return kind.charAt(0).toUpperCase() + kind.slice(1)
}

const BridgeDashboard = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { data: walletData, loading } = useSelector((state) => state.wallet)
  const { accountSummary } = useSelector((state) => state.account)
  const { ownerMode, selectedCircleId, circleEntities } = useSelector((state) => state.app || {})
  const [timelineItems, setTimelineItems] = useState([])
  const [timelineLoading, setTimelineLoading] = useState(true)
  const [catalogItems, setCatalogItems] = useState([])
  const [circleWorkspace, setCircleWorkspace] = useState(null)

  useEffect(() => {
    dispatch(getAccountSummary())
  }, [dispatch])

  useEffect(() => {
    let active = true

    const loadPageData = async () => {
      setTimelineLoading(true)
      try {
        if (ownerMode === 'circle' && selectedCircleId) {
          const circleResponse = await getCircleWorkspace(selectedCircleId).catch(() => null)
          if (!active) return
          const circleData = circleResponse?.data || null
          setCircleWorkspace(circleData)
          setTimelineItems(extractCircleRecentActivity(circleData).slice(0, 6))
          setCatalogItems([])
          return
        }

        const [timelineResponse, catalogResponse] = await Promise.all([
          getTimelinePreview({ limit: 30 }).catch(() => null),
          getSectionCatalog('bridge').catch(() => null),
        ])

        if (!active) return

        const items = Array.isArray(timelineResponse?.data?.items) ? timelineResponse.data.items : []
        setTimelineItems(items.filter(isBridgeItem).slice(0, 6))
        setCatalogItems(Array.isArray(catalogResponse?.data?.data) ? catalogResponse.data.data : [])
        setCircleWorkspace(null)
      } catch {
        if (!active) return
        setTimelineItems([])
        setCatalogItems([])
      } finally {
        if (active) setTimelineLoading(false)
      }
    }

    loadPageData()

    return () => {
      active = false
    }
  }, [ownerMode, selectedCircleId])

  const bridgeWallet =
    walletData?.bridge ||
    walletData?.data?.find?.((wallet) => String(wallet?.wallet_type || '').toLowerCase() !== 'usd') ||
    null

  const canonicalAnchorAccount = useMemo(() => {
    const summaryAnchorAccount = accountSummary?.data?.anchor_account || null
    if (!summaryAnchorAccount) return null

    return {
      ...summaryAnchorAccount,
      active: Boolean(summaryAnchorAccount?.active),
      status: summaryAnchorAccount?.status || accountSummary?.flow?.state || 'completed',
    }
  }, [accountSummary])
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

  const catalogWorkflows = useMemo(() => {
    return uniqueBy(
      catalogItems
        .filter((item) => isBridgeCatalogServiceType(item?.service_type))
        .map((item) => {
          const serviceType = String(item?.service_type || '').toUpperCase()
          const presentation = getBridgeServicePresentation(serviceType)
          const copy = presentation || {
            title: item?.label || item?.service_name || 'Service',
            detail: 'Open this active Bridge service.',
          }

          return {
            key: serviceType,
            title: copy.title,
            detail: copy.detail,
            to: item?.launcher_route || presentation?.route || '/dashboard/bridge/utilities',
          }
        }),
      (item) => item.key
    )
  }, [catalogItems])

  const actionGroups = [
    { label: 'Receive NGN', to: '/dashboard/virtual-accounts' },
    catalogWorkflows[0]
      ? { label: catalogWorkflows[0].title, to: catalogWorkflows[0].to }
      : { label: 'Utilities', to: '/dashboard/bridge/utilities' },
    { label: 'Circles', to: '/dashboard/bridge/circles' },
    { label: 'Rewards', to: '/dashboard/bridge/rewards' },
  ]

  const workflowEntries = [
    ...catalogWorkflows.slice(0, 3),
    {
      title: 'Shared circles',
      detail: 'Coordinate contributions and shared balance activity with other users.',
      to: '/dashboard/bridge/circles',
    },
    {
      title: 'Rewards and bonuses',
      detail: 'Review local incentives and wallet-linked reward activity.',
      to: '/dashboard/bridge/rewards',
    },
  ]

  if (isCircleWorkspace) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          <section className="rounded-[28px] border border-sky-500/30 bg-sky-500/10 p-5 md:p-7 shadow-[0_24px_60px_rgba(2,6,23,0.22)]">
            <p className="text-[11px] uppercase tracking-[0.24em] text-sky-200/80">Circle workspace</p>
            <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold text-white">{circleName}</h1>
                <p className="mt-2 text-sm text-slate-300 max-w-xl">
                  Circle context is active here, so Bridge wallet actions are replaced with shared-balance actions that keep you inside the selected circle.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
                  {circleMembersCount > 0 ? (
                    <span className="px-3 py-1 rounded-full border border-slate-700/80 bg-slate-900/70">
                      {circleMembersCount} members
                    </span>
                  ) : null}
                  <span className="px-3 py-1 rounded-full border border-slate-700/80 bg-slate-900/70">
                    {circleRoleLabel}
                  </span>
                  <span className="px-3 py-1 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-100">
                    Circle balance
                  </span>
                </div>
              </div>
              <div className="rounded-2xl border border-sky-500/30 bg-slate-950/45 px-4 py-3 min-w-[16rem]">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500 mb-2">Circle balance</div>
                <div className="text-3xl md:text-4xl font-semibold text-white">
                  <ShadowValue>{formatNgn(circleBalance)}</ShadowValue>
                </div>
              </div>
            </div>
          </section>

          <section className={cardClass}>
            <div className="mb-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Primary actions</p>
              <h2 className="text-lg md:text-xl font-semibold text-white mt-1">Operate the circle workspace</h2>
            </div>
            {circleDuesSummary?.enabled ? (
              <div className="mb-4 rounded-2xl border border-sky-500/20 bg-slate-950/35 px-4 py-3 text-sm text-slate-300">
                Dues active:
                {' '}
                {Number(circleDuesSummary?.current_user_due_summary?.payable_months_count || 0)} open cycle(s)
              </div>
            ) : null}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {[...circleActions, { key: 'activity', label: 'Activity', to: `/dashboard/shared-groups/${selectedCircleId}` }].map((action) => (
                <button
                  key={action.key}
                  type="button"
                  onClick={() => navigate(action.to)}
                  className={
                    action.primary
                      ? 'rounded-2xl bg-sky-400 px-4 py-3 text-left text-sm font-semibold text-slate-950 hover:bg-sky-300 transition'
                      : actionClass
                  }
                >
                  {action.label}
                </button>
              ))}
            </div>
          </section>

          <section className={cardClass}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Circle activity</p>
                <h2 className="mt-1 text-lg md:text-xl font-semibold text-white">Recent shared movement</h2>
                {(circlePermissions.can_approve_withdrawals || circlePermissions.can_manage_governance) ? (
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    {circlePermissions.can_approve_withdrawals ? (
                      <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-amber-100">
                        Approval role
                      </span>
                    ) : null}
                    {circlePermissions.can_manage_governance ? (
                      <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-3 py-1 text-sky-100">
                        Governance access
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => navigate(`/dashboard/shared-groups/${selectedCircleId}`)}
                className="text-xs text-sky-300 hover:text-sky-200 transition"
              >
                Open full circle
              </button>
            </div>

            {timelineLoading ? (
              <Loading />
            ) : timelineItems.length ? (
              <div className="space-y-3">
                {timelineItems.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white">{item.label || item.description || 'Circle activity'}</div>
                        <div className="mt-1 text-xs text-slate-400">{formatDate(item.occurred_at || item.created_at)}</div>
                        <div className="mt-2 text-xs text-slate-500">
                          {item?.meta?.reference || item.reference || item.status || 'Shared balance movement'}
                        </div>
                      </div>
                      <div className="text-right min-w-[8rem]">
                        <div className="text-sm font-semibold text-white">
                          <ShadowValue>{formatNgn((Number(item?.amount_cents || 0) || 0) / 100)}</ShadowValue>
                        </div>
                        <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                          {String(item?.activity_type || item?.direction || item?.status || 'posted').replace(/_/g, ' ')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-5 text-sm text-slate-400">
                No circle activity yet. Contributions and payouts will appear here once the selected circle starts moving money.
              </div>
            )}
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        <section className="rounded-[28px] border border-emerald-900/60 bg-emerald-950/35 p-5 md:p-7 shadow-[0_24px_60px_rgba(6,78,59,0.22)]">
          <p className="text-[11px] uppercase tracking-[0.24em] text-emerald-300/80">Bridge</p>
          <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-white">Local NGN rail</h1>
              <p className="mt-2 text-sm text-slate-300 max-w-xl">
                Move local money, receive transfers, pay bills, and coordinate shared NGN activity from one workspace.
              </p>
            </div>
            <div className="grid min-w-[18rem] grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-emerald-900/70 bg-slate-950/45 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500 mb-2">Bridge balance</div>
                {loading ? (
                  <Loading />
                ) : (
                  <div className="text-3xl md:text-4xl font-semibold text-white">
                    <ShadowValue>{formatNgn(bridgeWallet?.balance ?? 0)}</ShadowValue>
                  </div>
                )}
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-950/45 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500 mb-2">Receive account</div>
                <div className="text-sm font-semibold text-white">
                  {canonicalAnchorAccount?.account_number ? 'Active' : 'Setup required'}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {canonicalAnchorAccount?.bank_name || 'Anchor virtual account'}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={cardClass}>
          <div className="mb-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Primary actions</p>
            <h2 className="text-lg md:text-xl font-semibold text-white mt-1">Operate the Bridge rail</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            <button
              type="button"
              onClick={() => navigate('/dashboard/bridge/send')}
              className="rounded-2xl bg-emerald-400 px-4 py-3 text-left text-sm font-semibold text-black hover:bg-emerald-300 transition"
            >
              Send money
            </button>
            {actionGroups.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => navigate(action.to)}
                className={actionClass}
              >
                {action.label}
              </button>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <section className={cardClass}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Send</p>
                <h2 className="mt-1 text-lg md:text-xl font-semibold text-white">Transfer from Bridge</h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('/dashboard/bridge/send')}
                className="text-xs text-emerald-300 hover:text-emerald-200 transition"
              >
                Open full transfer page
              </button>
            </div>
            <MoneyTransferFlow embedded initialMode="bitbridge" />
          </section>

          <div className="flex flex-col gap-6">
            <section className={cardClass}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Receive</p>
                  <h2 className="mt-1 text-lg md:text-xl font-semibold text-white">NGN funding account</h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/virtual-accounts')}
                  className="text-xs text-emerald-300 hover:text-emerald-200 transition"
                >
                  Manage accounts
                </button>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4">
                {canonicalAnchorAccount?.account_number ? (
                  <div className="space-y-3 text-sm text-slate-300">
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Bank</div>
                      <div className="mt-1 text-slate-100">{canonicalAnchorAccount.bank_name || 'Anchor'}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Account number</div>
                      <div className="mt-1 text-slate-100">{canonicalAnchorAccount.account_number}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Account name</div>
                      <div className="mt-1 text-slate-100">{canonicalAnchorAccount.account_name || 'BitBridge account'}</div>
                    </div>
                    <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200">
                      Incoming transfers here fund your Bridge wallet.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-400">
                      You do not have an active NGN receive account yet. Create one to accept bank transfers into Bridge.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate('/dashboard/virtual-accounts')}
                      className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-300 transition"
                    >
                      Create receive account
                    </button>
                  </div>
                )}
              </div>
            </section>

            <section className={cardClass}>
              <div className="mb-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Workflow entries</p>
                <h2 className="mt-1 text-lg md:text-xl font-semibold text-white">Use Bridge for real tasks</h2>
              </div>
              <div className="space-y-3">
                {workflowEntries.map((entry) => (
                  <button
                    key={`${entry.title}-${entry.to}`}
                    type="button"
                    onClick={() => navigate(entry.to)}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4 text-left hover:border-slate-600 hover:bg-slate-950/65 transition"
                  >
                    <div className="text-sm font-semibold text-white">{entry.title}</div>
                    <div className="mt-1 text-xs text-slate-400">{entry.detail}</div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>

        <section className={cardClass}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Bridge activity</p>
              <h2 className="mt-1 text-lg md:text-xl font-semibold text-white">Recent NGN ledger</h2>
            </div>
            <Link to="/dashboard/activity" className="text-xs text-emerald-300 hover:text-emerald-200 transition">
              Open full activity
            </Link>
          </div>

          {timelineLoading ? (
            <Loading />
          ) : timelineItems.length ? (
            <div className="space-y-3">
              {timelineItems.map((item) => {
                const receiptRoute = resolveReceiptPath(item)
                const status = String(item?.status || 'posted').toLowerCase()
                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white">{activityLabel(item)}</div>
                        <div className="mt-1 text-xs text-slate-400">{formatDate(item.occurred_at)}</div>
                        <div className="mt-2 text-xs text-slate-500">
                          {item?.meta?.description || item?.meta?.reference || item?.meta?.transaction_record_reference || 'Bridge activity'}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                        <div className="text-right">
                          <div className="text-sm font-semibold text-white">
                            <ShadowValue>{formatNgn((Number(item?.amount_cents || 0) || 0) / 100)}</ShadowValue>
                          </div>
                          <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">{status}</div>
                        </div>
                        {receiptRoute ? (
                          <Link
                            to={receiptRoute}
                            className="text-xs text-emerald-300 hover:text-emerald-200 transition"
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
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-5 text-sm text-slate-400">
              No Bridge activity yet. Send money, receive an NGN transfer, or pay a bill to start the local ledger.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default BridgeDashboard


