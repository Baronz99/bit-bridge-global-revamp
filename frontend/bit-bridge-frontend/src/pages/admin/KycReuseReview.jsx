import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { getAdminOpsHealth } from '../../api/adminOps'

const actionLabel = (value) => {
  switch (value) {
    case 'secure_reconciliation_for_anchor_and_cards':
      return 'Anchor and cards exposed'
    case 'secure_reconciliation_for_cards':
      return 'Cards exposed'
    case 'monitor_anchor_safe_cards_risky':
      return 'Anchor safe, cards risky'
    case 'secure_bvn_reentry_before_anchor_or_cards':
      return 'Re-entry before use'
    default:
      return 'Review required'
  }
}

const flagBadge = (active, label, tone = 'slate') => {
  const toneClasses =
    tone === 'emerald'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
      : tone === 'amber'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
        : 'border-slate-700 bg-slate-800 text-slate-200'

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${toneClasses}`}
    >
      {label}: {active ? 'Yes' : 'No'}
    </span>
  )
}

const KycReuseReview = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [health, setHealth] = useState(null)

  useEffect(() => {
    let active = true

    const loadHealth = async () => {
      try {
        setLoading(true)
        setError('')
        const response = await getAdminOpsHealth()
        if (!active) return
        setHealth(response?.data?.data || null)
      } catch (err) {
        if (!active) return
        setError(
          err?.response?.data?.message ||
            'Unable to load KYC reuse anomalies right now.'
        )
      } finally {
        if (active) setLoading(false)
      }
    }

    loadHealth()

    return () => {
      active = false
    }
  }, [])

  const reuse = health?.kyc_reuse || {}
  const staleUsers = Array.isArray(reuse?.stale_verified_bvn_sample)
    ? reuse.stale_verified_bvn_sample
    : []

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 overflow-y-auto">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-amber-300">
            Admin Review
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold mt-1">
            Reusable BVN Integrity
          </h1>
          <p className="text-sm text-slate-400 mt-2 max-w-3xl">
            Review users whose BVN is marked verified on the platform but is not
            reusable for downstream Anchor or card flows.
          </p>
        </div>
        <div className="flex gap-3">
          <NavLink
            to="/admin/dashboard"
            className="px-4 py-2 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-900 transition-colors"
          >
            Back to Dashboard
          </NavLink>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-slate-400">
          Loading ops review data...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-950/20 p-5 text-rose-200">
          {error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                Verified BVN
              </p>
              <p className="text-3xl font-semibold mt-3">
                {reuse?.verified_bvn_total ?? 0}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/10 p-5">
              <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">
                Reusable BVN
              </p>
              <p className="text-3xl font-semibold mt-3 text-emerald-200">
                {reuse?.reusable_bvn_total ?? 0}
              </p>
            </div>

            <div className="rounded-2xl border border-amber-500/30 bg-amber-950/10 p-5">
              <p className="text-xs uppercase tracking-[0.25em] text-amber-300">
                Needs Review
              </p>
              <p className="text-3xl font-semibold mt-3 text-amber-200">
                {reuse?.verified_missing_reusable_bvn_count ?? 0}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between mb-4 gap-3">
              <div>
                <h2 className="text-lg font-semibold">Stale Verified BVN Sample</h2>
                <p className="text-sm text-slate-400 mt-1">
                  These users can be blocked later on Anchor or cards unless BVN
                  is re-entered or securely reconciled.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-800">
                    <th className="py-2 px-3">User</th>
                    <th className="py-2 px-3">Tier</th>
                    <th className="py-2 px-3">Onboarding</th>
                    <th className="py-2 px-3">Exposure</th>
                    <th className="py-2 px-3">Support Guidance</th>
                    <th className="py-2 px-3">BVN Verified</th>
                    <th className="py-2 px-3">KYC Updated</th>
                    <th className="py-2 px-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {staleUsers.map((item) => (
                    <tr
                      key={item.user_id}
                      className="border-b border-slate-800 hover:bg-slate-950/60"
                    >
                      <td className="py-3 px-3">
                        <div className="flex flex-col">
                          <span className="text-slate-100 font-medium">
                            {item.email}
                          </span>
                          <span className="text-xs text-slate-500">
                            {item.user_id}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 capitalize text-slate-200">
                        {(item.kyc_level || '--').replace('_', ' ')}
                      </td>
                      <td className="py-3 px-3 capitalize text-slate-300">
                        {(item.onboarding_stage || '--').replaceAll('_', ' ')}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-2">
                          {flagBadge(item.has_anchor_account, 'Anchor', item.anchor_account_provisioned ? 'emerald' : 'amber')}
                          {flagBadge(item.has_cards || item.has_cardholder_profile, 'Cards', item.has_cards || item.has_cardholder_profile ? 'amber' : 'slate')}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-200">
                          {actionLabel(item.recommended_action)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        {item.bvn_verified_at
                          ? new Date(item.bvn_verified_at).toLocaleString()
                          : '--'}
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        {item.updated_at
                          ? new Date(item.updated_at).toLocaleString()
                          : '--'}
                      </td>
                      <td className="py-3 px-3">
                        <NavLink
                          to={`/admin/users/${item.user_id}`}
                          className="inline-flex items-center rounded-lg bg-slate-800 px-3 py-2 text-slate-100 hover:bg-slate-700 transition-colors"
                        >
                          Review User
                        </NavLink>
                      </td>
                    </tr>
                  ))}

                  {staleUsers.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-8 text-center text-slate-500"
                      >
                        No stale reusable-BVN anomalies found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default KycReuseReview
