// src/pages/dashboard/Rewards.jsx
import React from 'react'
import { GiftOutlined, ThunderboltOutlined, TrophyOutlined } from '@ant-design/icons'

const rewardsPreview = [
  {
    id: 'reward-1',
    title: 'MTN Airtime top-up',
    meta: 'Airtime · VTU',
    amount: '+₦25',
    status: 'Pending',
    date: 'Today',
  },
  {
    id: 'reward-2',
    title: 'Airtel data bundle',
    meta: 'Data · Mobile',
    amount: '+₦15',
    status: 'Earned',
    date: 'Yesterday',
  },
]

const Rewards = () => {
  return (
    <div className="min-h-screen p-4 md:p-8 bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 md:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500 mb-2">
              Rewards hub
            </p>
            <h1 className="text-2xl md:text-3xl font-semibold">
              Track rewards from every top-up
            </h1>
            <p className="text-sm text-slate-400 mt-2 max-w-xl">
              Earn rewards when you buy airtime or data. We will show rewards here once the
              system goes live.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-5 py-4 text-center">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
              Rewards balance
            </p>
            <p className="text-2xl font-semibold text-slate-100 mt-2">₦0</p>
            <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-amber-200">
              <TrophyOutlined />
              Coming soon
            </span>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-400/10 text-amber-200">
                <ThunderboltOutlined />
              </span>
              <div>
                <p className="text-sm font-semibold">Airtime rewards</p>
                <p className="text-xs text-slate-400">Earned on mobile top-ups</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-cyan-400/10 text-cyan-200">
                <GiftOutlined />
              </span>
              <div>
                <p className="text-sm font-semibold">Data rewards</p>
                <p className="text-xs text-slate-400">Stack bonuses on data bundles</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-200">
                <TrophyOutlined />
              </span>
              <div>
                <p className="text-sm font-semibold">Streaks</p>
                <p className="text-xs text-slate-400">Maintain weekly reward streaks</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Rewards activity</h2>
              <p className="text-xs text-slate-400">
                Rewards will list the source and status once live.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {rewardsPreview.map((reward) => (
              <div
                key={reward.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold">{reward.title}</p>
                  <p className="text-xs text-slate-400">{reward.meta}</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-400">{reward.date}</span>
                  <span className="text-slate-200 font-semibold">{reward.amount}</span>
                  <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-slate-300">
                    {reward.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs text-slate-400">
            Rewards are currently in preview mode. Activity will update automatically once the
            reward engine is enabled.
          </div>
        </section>
      </div>
    </div>
  )
}

export default Rewards
