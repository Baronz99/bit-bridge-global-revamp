import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRightOutlined,
  CalendarOutlined,
  GiftOutlined,
  ReloadOutlined,
  SwapOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { getRewards } from '../../api/rewards'
import nairaFormat from '../../utils/nairaFormat'

const shellClass = 'mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8'
const cardClass = 'rounded-[28px] border border-slate-800 bg-slate-900/80 p-5 shadow-[0_18px_44px_rgba(15,23,42,0.18)] md:p-6'
const subtleCardClass = 'rounded-3xl border border-slate-800/90 bg-slate-950/45 p-4 md:p-5'
const metricCardClass = 'rounded-[24px] border border-slate-800/90 bg-slate-950/40 p-4 md:p-5'
const pillClass = 'inline-flex items-center rounded-full border border-slate-700 bg-slate-950/50 px-3 py-1 text-[11px] font-medium text-slate-300'
const tabClass = 'rounded-full border px-4 py-2 text-xs font-medium transition'
const ctaClass = 'inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/35 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-900/70'
const primaryCtaClass = 'inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300'
const bridgePointsStatusCopy = {
  accruing: {
    label: 'Accruing this month',
    detail: 'Eligible personal transfers are building toward your next wallet payout.',
  },
  paid: {
    label: 'Paid this cycle',
    detail: 'This month has already been settled to your NGN wallet.',
  },
  recently_paid: {
    label: 'Recently paid',
    detail: 'Your latest Bridge Points cycle has been paid to your NGN wallet.',
  },
  idle: {
    label: 'No points yet',
    detail: 'Make an eligible personal transfer to start earning Bridge Points.',
  },
}

const formatDate = (value, options = {}) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, options)
}

const formatDateTime = (value) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString()
}

const formatMonthLabel = (value) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

const metricValue = (value, fallback = '0') => {
  if (value === null || value === undefined || value === '') return fallback
  return value
}

const Rewards = () => {
  const [summary, setSummary] = useState(null)
  const [billRewards, setBillRewards] = useState(null)
  const [bridgePoints, setBridgePoints] = useState(null)
  const [rewards, setRewards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let active = true

    const loadRewards = async () => {
      setLoading(true)
      setError('')

      try {
        const response = await getRewards()
        if (!active) return

        const payload = response?.data || {}
        setSummary(payload.data || null)
        setBillRewards(payload.bill_rewards || payload.data || null)
        setBridgePoints(payload.bridge_points || null)
        setRewards(Array.isArray(payload.rewards) ? payload.rewards : [])
      } catch (loadError) {
        if (!active) return

        setSummary(null)
        setBillRewards(null)
        setBridgePoints(null)
        setRewards([])
        setError(loadError?.response?.data?.message || 'Unable to load your rewards right now. Please try again.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadRewards()

    return () => {
      active = false
    }
  }, [reloadToken])

  const availableBillRewards = Number(billRewards?.available_balance || 0)
  const totalBillRewardsEarned = Number(billRewards?.total_earned || summary?.total_earned || 0)
  const billRewardCount = Number(billRewards?.reward_count || summary?.reward_count || rewards.length || 0)
  const currentBridgePoints = Number(bridgePoints?.current_month_points || 0)
  const bridgePointsEstimate = Number(bridgePoints?.naira_estimate || 0)
  const bridgePointsStatus = String(bridgePoints?.payout_status || 'idle')
  const bridgePointsStatusCard = bridgePointsStatusCopy[bridgePointsStatus] || bridgePointsStatusCopy.idle
  const settlementMessage =
    bridgePoints?.settlement_message || 'Eligible Bridge Points pay out to your NGN wallet after the monthly payout cycle.'
  const lastBridgePointsPayout = bridgePoints?.last_payout || null
  const nextPayoutDate = formatDate(bridgePoints?.next_payout_date, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const lastBridgePointsPayoutDate = formatDateTime(lastBridgePointsPayout?.paid_at)
  const lastBridgePointsPayoutMonth = formatMonthLabel(lastBridgePointsPayout?.program_month)

  const billRewardsSubtitle = useMemo(() => {
    if (!billRewardCount) return 'Usable on eligible airtime and data purchases.'
    return `${billRewardCount} bill reward${billRewardCount === 1 ? '' : 's'} earned so far.`
  }, [billRewardCount])

  const billRewardActivity = useMemo(
    () =>
      rewards.map((reward) => ({
        id: `bill-${reward.id}`,
        group: 'bill',
        title: reward.source_label || reward.service_type || 'Bill reward earned',
        subtitle: reward.service_type ? `${reward.service_type} purchase` : 'Eligible bill purchase',
        timestamp: reward.earned_at || null,
        timestampLabel: formatDateTime(reward.earned_at),
        amountLabel: `+${nairaFormat(Number(reward.amount || 0))}`,
        supportingValue: reward.source_amount ? nairaFormat(Number(reward.source_amount || 0)) : null,
        supportingLabel: reward.source_amount ? 'Purchase value' : null,
        badge: reward.status || 'earned',
      })),
    [rewards]
  )

  const payoutActivity = useMemo(() => {
    const payoutHistory = Array.isArray(bridgePoints?.payout_history) ? bridgePoints.payout_history : []

    return payoutHistory.map((payout) => ({
      id: `payout-${payout.id}`,
      group: 'payout',
      title: 'Bridge Points Reward',
      subtitle: payout.program_month ? `Reward month: ${formatMonthLabel(payout.program_month)}` : 'Monthly wallet payout',
      timestamp: payout.paid_at || null,
      timestampLabel: formatDateTime(payout.paid_at),
      amountLabel: nairaFormat(Number(payout.naira_value || 0)),
      supportingValue: Number(payout.total_points || 0),
      supportingLabel: 'Points paid',
      badge: `${Number(payout.total_points || 0)} pts`,
    }))
  }, [bridgePoints?.payout_history])

  const activityItems = useMemo(() => {
    return [...billRewardActivity, ...payoutActivity].sort((left, right) => {
      const leftValue = left.timestamp ? new Date(left.timestamp).getTime() : 0
      const rightValue = right.timestamp ? new Date(right.timestamp).getTime() : 0
      return rightValue - leftValue
    })
  }, [billRewardActivity, payoutActivity])

  const filteredActivity = useMemo(() => {
    if (activeTab === 'bill') return billRewardActivity
    if (activeTab === 'bridge') return payoutActivity
    if (activeTab === 'payouts') return payoutActivity
    return activityItems
  }, [activeTab, activityItems, billRewardActivity, payoutActivity])

  const emptyState = useMemo(() => {
    if (activeTab === 'bill') {
      return {
        title: 'No Bill Rewards activity yet',
        body: 'Complete an eligible airtime or data purchase to start earning bill rewards.',
      }
    }

    if (activeTab === 'bridge') {
      return {
        title: 'No Bridge Points activity yet',
        body: 'Make an eligible transfer to start earning points. Monthly payouts will appear here once they are credited.',
      }
    }

    if (activeTab === 'payouts') {
      return {
        title: 'No payouts yet',
        body: 'Monthly Bridge Points payouts will appear here after a completed payout cycle.',
      }
    }

    return {
      title: 'No rewards activity yet',
      body: 'Eligible bill purchases and Bridge Points payouts will appear here as your rewards history grows.',
    }
  }, [activeTab])

  const metrics = [
    {
      label: 'Available Bill Rewards',
      value: nairaFormat(availableBillRewards),
      hint: 'Bill-only balance',
    },
    {
      label: 'Current Bridge Points',
      value: metricValue(currentBridgePoints),
      hint: 'This month',
    },
    {
      label: 'Estimated Bridge Points Payout',
      value: nairaFormat(bridgePointsEstimate),
      hint: nextPayoutDate ? `${bridgePointsStatusCard.label} • ${nextPayoutDate}` : bridgePointsStatusCard.label,
    },
  ]

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'bill', label: 'Bill Rewards' },
    { key: 'bridge', label: 'Bridge Points' },
    { key: 'payouts', label: 'Payouts' },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className={shellClass}>
        <section className="rounded-[32px] border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-6 shadow-[0_30px_80px_rgba(2,6,23,0.28)] md:p-8">
          <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] uppercase tracking-[0.28em] text-emerald-300/80">Rewards Center</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Your rewards, balances, and monthly payouts.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                Manage bill rewards and Bridge Points from one place.
              </p>
              {nextPayoutDate ? (
                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-100">
                  <CalendarOutlined />
                  <span>{bridgePointsStatus === 'paid' ? `Next Bridge Points payout: ${nextPayoutDate}` : `Bridge Points payout target: ${nextPayoutDate}`}</span>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setReloadToken((value) => value + 1)}
              className={ctaClass}
            >
              <ReloadOutlined />
              Refresh rewards
            </button>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {metrics.map((metric) => (
              <div key={metric.label} className={metricCardClass}>
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{metric.label}</p>
                <div className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-3xl">{metric.value}</div>
                <p className="mt-2 text-sm text-slate-400">{metric.hint}</p>
              </div>
            ))}
          </div>
        </section>

        {error ? (
          <section className={`${cardClass} border-rose-900/60 bg-rose-950/20`}>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Unable to load rewards</h2>
                <p className="mt-1 text-sm text-slate-300">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => setReloadToken((value) => value + 1)}
                className={ctaClass}
              >
                <ReloadOutlined />
                Try again
              </button>
            </div>
          </section>
        ) : null}

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <article className={cardClass}>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-xl">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
                  <GiftOutlined />
                </div>
                <p className="mt-4 text-[11px] uppercase tracking-[0.24em] text-slate-500">Bill Rewards</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Bill-only credits</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Usable on eligible airtime and data purchases.
                </p>
              </div>

              <Link to="/dashboard/utilities" className={primaryCtaClass}>
                Use on bills
                <ArrowRightOutlined />
              </Link>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className={subtleCardClass}>
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Available balance</p>
                <div className="mt-3 text-3xl font-semibold tracking-tight text-white">
                  {loading ? '...' : nairaFormat(availableBillRewards)}
                </div>
                <p className="mt-2 text-sm text-slate-400">Spendable on eligible bill purchases.</p>
              </div>

              <div className={subtleCardClass}>
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Lifetime earned</p>
                <div className="mt-3 text-3xl font-semibold tracking-tight text-white">
                  {loading ? '...' : nairaFormat(totalBillRewardsEarned)}
                </div>
                <p className="mt-2 text-sm text-slate-400">{billRewardsSubtitle}</p>
              </div>
            </div>
          </article>

          <article className={cardClass}>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-xl">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-200">
                  <ThunderboltOutlined />
                </div>
                <p className="mt-4 text-[11px] uppercase tracking-[0.24em] text-slate-500">Bridge Points</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Monthly wallet rewards</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Earn points from eligible outbound transfers. Paid monthly to your wallet.
                </p>
              </div>

              <Link to="/dashboard/bridge/send" className={primaryCtaClass}>
                Make a transfer
                <ArrowRightOutlined />
              </Link>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className={subtleCardClass}>
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Current month points</p>
                <div className="mt-3 text-3xl font-semibold tracking-tight text-white">
                  {loading ? '...' : metricValue(currentBridgePoints)}
                </div>
                <p className="mt-2 text-sm text-slate-400">Eligible transfers this month.</p>
              </div>

              <div className={subtleCardClass}>
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Estimated naira value</p>
                <div className="mt-3 text-3xl font-semibold tracking-tight text-white">
                  {loading ? '...' : nairaFormat(bridgePointsEstimate)}
                </div>
                <p className="mt-2 text-sm text-slate-400">Based on your current Bridge Points.</p>
              </div>

              <div className={subtleCardClass}>
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Next payout date</p>
                <div className="mt-3 text-xl font-semibold tracking-tight text-white">
                  {loading ? '...' : nextPayoutDate || 'At month end'}
                </div>
                <p className="mt-2 text-sm text-slate-400">{settlementMessage}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className={subtleCardClass}>
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Payout status</p>
                <div className="mt-3 text-xl font-semibold tracking-tight text-white">{bridgePointsStatusCard.label}</div>
                <p className="mt-2 text-sm text-slate-400">{bridgePointsStatusCard.detail}</p>
              </div>

              <div className={subtleCardClass}>
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Last payout</p>
                {lastBridgePointsPayout ? (
                  <>
                    <div className="mt-3 text-xl font-semibold tracking-tight text-white">
                      {nairaFormat(Number(lastBridgePointsPayout.naira_value || 0))}
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                      {Number(lastBridgePointsPayout.total_points || 0)} points
                      {lastBridgePointsPayoutMonth ? ` • Reward month ${lastBridgePointsPayoutMonth}` : ''}
                    </p>
                    {lastBridgePointsPayoutDate ? (
                      <p className="mt-2 text-xs text-slate-500">{lastBridgePointsPayoutDate}</p>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-3 text-sm text-slate-400">
                    Your first Bridge Points payout will appear here after settlement.
                  </p>
                )}
              </div>
            </div>
          </article>
        </section>

        <section className={cardClass}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Rewards activity</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Recent rewards movement</h2>
              <p className="mt-2 text-sm text-slate-400">
                Review real bill rewards activity and monthly Bridge Points payouts.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`${tabClass} ${
                      isActive
                        ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100'
                        : 'border-slate-700 bg-slate-950/35 text-slate-300 hover:border-slate-500 hover:text-slate-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="animate-pulse rounded-[22px] border border-slate-800 bg-slate-950/40 p-4">
                    <div className="h-4 w-40 rounded bg-slate-800" />
                    <div className="mt-3 h-3 w-56 rounded bg-slate-900" />
                  </div>
                ))}
              </div>
            ) : filteredActivity.length ? (
              filteredActivity.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-4 rounded-[24px] border border-slate-800 bg-slate-950/35 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={pillClass}>{item.group === 'bill' ? 'Bill Rewards' : 'Bridge Points'}</span>
                      {item.badge ? <span className={pillClass}>{item.badge}</span> : null}
                    </div>
                    <h3 className="mt-3 truncate text-base font-semibold text-white">{item.title}</h3>
                    <p className="mt-1 text-sm text-slate-400">{item.subtitle}</p>
                    {item.timestampLabel ? <p className="mt-2 text-xs text-slate-500">{item.timestampLabel}</p> : null}
                  </div>

                  <div className="flex flex-col gap-1 text-left md:min-w-[12rem] md:text-right">
                    <div className="text-lg font-semibold text-white">{item.amountLabel}</div>
                    {item.supportingValue !== null && item.supportingValue !== undefined && item.supportingLabel ? (
                      <div className="text-xs text-slate-400">
                        {item.supportingLabel}: {item.group === 'payout' ? `${Number(item.supportingValue || 0)} points` : item.supportingValue}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[28px] border border-slate-800 bg-slate-950/35 px-6 py-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-950/60 text-slate-300">
                  <SwapOutlined />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">{emptyState.title}</h3>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">{emptyState.body}</p>
              </div>
            )}
          </div>
        </section>

        <section className={cardClass}>
          <div className="max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">How rewards work</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Clear by design</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Bill Rewards and Bridge Points are separate reward systems with different uses and payout paths.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className={subtleCardClass}>
              <h3 className="text-sm font-semibold text-white">Bill Rewards</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Bill Rewards are bill-only credits. They can be used on eligible airtime and data purchases.
              </p>
            </div>

            <div className={subtleCardClass}>
              <h3 className="text-sm font-semibold text-white">Bridge Points</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Bridge Points are earned from eligible outbound transfers and paid monthly into your wallet.
              </p>
            </div>

            <div className={subtleCardClass}>
              <h3 className="text-sm font-semibold text-white">Eligibility</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Failed or reversed transfers do not qualify. Monthly payouts reflect only confirmed eligible activity.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default Rewards
