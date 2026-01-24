import React, { useEffect, useMemo, useState } from 'react'
import { FireOutlined, GiftOutlined, ThunderboltOutlined, TrophyOutlined } from '@ant-design/icons'
import client from '../../api/client'
import nairaFormat from '../../utils/nairaFormat'

const Rewards = () => {
  const [summary, setSummary] = useState(null)
  const [rewards, setRewards] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const loadRewards = async () => {
      setLoading(true)
      try {
        const response = await client.get('/rewards')
        if (!active) return
        setSummary(response?.data?.data || null)
        setRewards(Array.isArray(response?.data?.rewards) ? response.data.rewards : [])
      } catch (error) {
        if (!active) return
        setSummary(null)
        setRewards([])
      } finally {
        if (!active) return
        setLoading(false)
      }
    }

    loadRewards()
    return () => {
      active = false
    }
  }, [])

  const totalEarned = Number(summary?.total_earned || 0)
  const level = summary?.level || 1
  const nextGoal = Number(summary?.next_goal || 500)
  const progress = Math.min(totalEarned / nextGoal, 1)
  const streakDays = summary?.streak_days || 0
  const todayEarned = Number(summary?.today_earned || 0)
  const weekEarned = Number(summary?.week_earned || 0)
  const monthEarned = Number(summary?.month_earned || 0)

  const streakLabel = useMemo(() => {
    if (!streakDays) return 'No streak yet'
    return `${streakDays} day streak`
  }, [streakDays])

  const badges = useMemo(
    () => [
      {
        id: 'badge-first',
        title: 'First top-up',
        subtitle: 'Complete your first VTU/Data purchase.',
        earned: summary?.reward_count > 0,
      },
      {
        id: 'badge-streak',
        title: 'Weekly grinder',
        subtitle: 'Maintain a 3-day reward streak.',
        earned: streakDays >= 3,
      },
      {
        id: 'badge-boost',
        title: 'Reward booster',
        subtitle: 'Earn at least NGN 1,000 in rewards.',
        earned: totalEarned >= 1000,
      },
    ],
    [streakDays, summary?.reward_count, totalEarned]
  )

  return (
    <div className="rewards-page min-h-screen p-4 md:p-8">
      <div className="rewards-shell max-w-6xl mx-auto space-y-6">
        <header className="rewards-banner rounded-2xl border p-5 md:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <p className="rewards-kicker text-[11px] uppercase tracking-[0.3em]">
              Rewards hub
            </p>
            <h1 className="text-2xl md:text-3xl font-semibold">
              Ever wondered how you&apos;re doing in life? Here you will see all your rewards.
            </h1>
            <p className="rewards-muted text-sm max-w-xl">
              Every airtime or data purchase earns you 1% instantly. Track your progress, streaks,
              and reward activity below.
            </p>
          </div>

          <div className="rewards-balance rounded-2xl border px-5 py-4 text-center w-full sm:w-auto">
            <p className="rewards-kicker text-xs uppercase tracking-[0.25em]">
              Total rewards earned (lifetime)
            </p>
            <p className="text-2xl font-semibold mt-2">{nairaFormat(totalEarned)}</p>
            <p className="rewards-muted text-[11px] mt-1">
              This is progress/history, not spendable.
            </p>
            <div className="rewards-level mt-3 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.2em]">
              <TrophyOutlined />
              Level {level}
            </div>
            <div className="rewards-progress-track mt-3 h-2 rounded-full overflow-hidden">
              <div
                className="rewards-progress-fill h-full"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="rewards-muted mt-2 text-[11px]">
              Next goal: {nairaFormat(nextGoal)}
            </p>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rewards-card rounded-2xl border p-4">
            <div className="flex items-center gap-3">
              <span className="rewards-icon rewards-icon-amber inline-flex h-10 w-10 items-center justify-center rounded-full">
                <ThunderboltOutlined />
              </span>
              <div>
                <p className="text-sm font-semibold">Today&apos;s reward</p>
                <p className="rewards-muted text-xs">{nairaFormat(todayEarned)}</p>
              </div>
            </div>
          </div>
          <div className="rewards-card rounded-2xl border p-4">
            <div className="flex items-center gap-3">
              <span className="rewards-icon rewards-icon-cyan inline-flex h-10 w-10 items-center justify-center rounded-full">
                <GiftOutlined />
              </span>
              <div>
                <p className="text-sm font-semibold">This week</p>
                <p className="rewards-muted text-xs">{nairaFormat(weekEarned)}</p>
              </div>
            </div>
          </div>
          <div className="rewards-card rounded-2xl border p-4">
            <div className="flex items-center gap-3">
              <span className="rewards-icon rewards-icon-ember inline-flex h-10 w-10 items-center justify-center rounded-full">
                <FireOutlined />
              </span>
              <div>
                <p className="text-sm font-semibold">Streak</p>
                <p className="rewards-muted text-xs">{streakLabel}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rewards-card rewards-badges rounded-2xl border p-5 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold">Achievements</h2>
              <p className="rewards-muted text-xs">
                Complete milestones to unlock reward boosts.
              </p>
            </div>
            <span className="rewards-kicker text-[10px] uppercase tracking-[0.2em]">
              Gamified progress
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className={`rewards-badge rounded-2xl border px-4 py-4 ${
                  badge.earned ? 'is-earned' : 'is-locked'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{badge.title}</p>
                  <span className="rewards-pill text-[9px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-full border">
                    {badge.earned ? 'Unlocked' : 'Locked'}
                  </span>
                </div>
                <p className="rewards-muted text-xs mt-2">{badge.subtitle}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rewards-card rounded-2xl border p-5 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold">Rewards activity</h2>
              <p className="rewards-muted text-xs">
                Every successful airtime/data purchase adds 1% instantly.
              </p>
            </div>
            <div className="rewards-muted text-xs">
              Month total: {nairaFormat(monthEarned)}
            </div>
          </div>

          <div className="space-y-3">
            {loading && (
              <div className="rewards-item rounded-xl border px-4 py-3 text-xs">
                Loading rewards activity...
              </div>
            )}

            {!loading && rewards.length === 0 && (
              <div className="rewards-item rounded-xl border px-4 py-3 text-xs">
                No rewards yet. Top up airtime or data to start earning.
              </div>
            )}

            {!loading &&
              rewards.map((reward) => (
                <div
                  key={reward.id}
                  className="rewards-item flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold">
                      {reward.source_label || reward.service_type || 'Reward earned'}
                    </p>
                    <p className="rewards-muted text-xs">
                      {reward.service_type ? `${reward.service_type} purchase` : 'Airtime/Data purchase'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="rewards-muted">
                      {reward.earned_at ? new Date(reward.earned_at).toLocaleString() : ''}
                    </span>
                    <span className="font-semibold">+{nairaFormat(Number(reward.amount || 0))}</span>
                    <span className="rewards-pill rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.2em]">
                      {reward.status}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default Rewards
