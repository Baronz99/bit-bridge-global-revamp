import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import ShadowValue from '../../components/ShadowValue'
import BusinessWorkspaceNav from '../../components/business/BusinessWorkspaceNav'
import BusinessWorkspaceRequired from '../../components/business/BusinessWorkspaceRequired'
import useBusinessDashboardPresentation from '../../hooks/useBusinessDashboardPresentation'
import useSelectedBusiness from '../../hooks/useSelectedBusiness'
import { createBusinessProvisioning, getBusinessTransactions } from '../../api/business'
import { isInvestorSandbox } from '../../config/sandbox'
import { SandboxContextCard } from '../../components/investorSandbox/SandboxInvestorTour'

const cardClass =
  'rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.22)]'

const skeletonClass = 'animate-pulse rounded-2xl bg-slate-800/70'

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

const statusTone = (status) => {
  const normalized = String(status || '').toLowerCase()
  if (['successful', 'approved', 'completed'].includes(normalized)) return 'text-emerald-300'
  if (['failed', 'rejected', 'reversed'].includes(normalized)) return 'text-rose-300'
  return 'text-amber-300'
}

const actionToneClass = (tone) => {
  if (tone === 'primary') return 'bg-[#FFB05A] text-slate-950 hover:bg-[#ffc27d]'
  if (tone === 'accent') {
    return 'border border-[#FFB05A]/40 bg-[rgba(255,176,90,0.12)] text-[#FFD2A0] hover:border-[#FFB05A]/70 hover:bg-[rgba(255,176,90,0.18)]'
  }
  return 'border border-slate-700 bg-slate-950/45 text-slate-100 hover:border-slate-500 hover:bg-slate-950/65'
}

const BusinessDashboardSkeleton = () => (
  <>
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
      <section className={`${cardClass} xl:col-span-2`}>
        <div className={`h-4 w-32 ${skeletonClass}`} />
        <div className={`mt-4 h-14 w-3/4 ${skeletonClass}`} />
        <div className={`mt-3 h-4 w-1/2 ${skeletonClass}`} />
      </section>
      <section className={cardClass}>
        <div className={`h-4 w-28 ${skeletonClass}`} />
        <div className={`mt-4 h-8 w-2/3 ${skeletonClass}`} />
        <div className={`mt-3 h-4 w-1/2 ${skeletonClass}`} />
      </section>
      <section className={cardClass}>
        <div className={`h-4 w-32 ${skeletonClass}`} />
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="rounded-2xl border border-slate-800 bg-slate-950/45 px-3 py-4">
              <div className={`mx-auto h-8 w-10 ${skeletonClass}`} />
              <div className={`mx-auto mt-3 h-3 w-14 ${skeletonClass}`} />
            </div>
          ))}
        </div>
      </section>
    </div>

    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <section className={cardClass}>
        <div className={`h-5 w-48 ${skeletonClass}`} />
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="w-full max-w-[18rem] space-y-2">
                  <div className={`h-4 w-2/3 ${skeletonClass}`} />
                  <div className={`h-3 w-1/3 ${skeletonClass}`} />
                </div>
                <div className="w-24 space-y-2">
                  <div className={`h-4 w-full ${skeletonClass}`} />
                  <div className={`h-3 w-2/3 ml-auto ${skeletonClass}`} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-6">
        {[1, 2, 3].map((item) => (
          <section key={item} className={cardClass}>
            <div className={`h-4 w-32 ${skeletonClass}`} />
            <div className="mt-4 space-y-3">
              <div className={`h-4 w-full ${skeletonClass}`} />
              <div className={`h-4 w-full ${skeletonClass}`} />
              <div className={`h-4 w-3/4 ${skeletonClass}`} />
            </div>
          </section>
        ))}
      </div>
    </div>
  </>
)

const BusinessDashboard = () => {
  const { ownerMode, selectedBusiness } = useSelectedBusiness()
  const [transactions, setTransactions] = useState([])
  const [activityLoading, setActivityLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [provisioning, setProvisioning] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)
  const {
    loading,
    error,
    reload,
    wallet,
    account,
    approvalSummary,
    financialControls,
    currentUserRole,
    progress,
    hero,
    screenMode,
    statusSummary,
    metrics,
    activitySection,
    navigationItems,
  } = useBusinessDashboardPresentation(selectedBusiness?.id)

  useEffect(() => {
    let active = true

    const loadTransactions = async () => {
      if (!selectedBusiness?.id) {
        if (active) setActivityLoading(false)
        return
      }

      setActivityLoading(true)
      try {
        const response = await getBusinessTransactions(selectedBusiness.id, { limit: 8 }).catch(() => null)
        if (!active) return
        setTransactions(Array.isArray(response?.data?.items) ? response.data.items : [])
      } catch (requestError) {
        if (!active) return
        setErrorMessage(requestError?.response?.data?.message || 'Unable to load recent business activity right now.')
      } finally {
        if (active) setActivityLoading(false)
      }
    }

    loadTransactions()

    return () => {
      active = false
    }
  }, [selectedBusiness?.id, reloadTick])

  useEffect(() => {
    if (!error) return
    setErrorMessage(error?.response?.data?.message || 'Unable to load the business workspace right now.')
  }, [error])

  const retryLoad = () => {
    if (!selectedBusiness?.id) return
    setErrorMessage('')
    setReloadTick((tick) => tick + 1)
    reload()
  }

  const handleProvision = async () => {
    if (!selectedBusiness?.id) return

    setProvisioning(true)
    setErrorMessage('')
    try {
      const response = await createBusinessProvisioning(selectedBusiness.id)
      toast.success(response?.data?.message || 'Business account activated successfully.')
      reload()
      setReloadTick((tick) => tick + 1)
    } catch (requestError) {
      const message = requestError?.response?.data?.message || 'Unable to activate the business account right now.'
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setProvisioning(false)
    }
  }

  const activePolicy = financialControls?.activeApprovalPolicy || null
  const activePolicyRequiredRoles = Array.isArray(activePolicy?.required_roles) ? activePolicy.required_roles : []
  const policyTone =
    activePolicy?.mode === 'enforce'
      ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
      : 'border-amber-500/40 bg-amber-500/10 text-amber-200'

  const renderAction = (action, index) => {
    if (!action) return null

    const className = `rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${actionToneClass(action.tone)}`
    const key = `${action.key || action.route || action.label}-${index}`

    if (action.key === 'activate_business_account' && progress?.canProvision) {
      return (
        <button key={key} type="button" onClick={handleProvision} disabled={provisioning} className={className}>
          {provisioning ? 'Activating...' : action.label}
        </button>
      )
    }

    return (
      <Link key={key} to={action.route || '/dashboard/business'} className={className}>
        {action.label}
      </Link>
    )
  }

  if (ownerMode !== 'business') {
    return <Navigate to="/dashboard/home" replace />
  }

  if (!selectedBusiness) {
    return <BusinessWorkspaceRequired message="Select a business workspace from the switcher to open your business account." />
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        <section className="rounded-[28px] border border-[#FF7A18] bg-[linear-gradient(135deg,rgba(255,138,42,0.16),rgba(255,176,90,0.08)_40%,rgba(15,23,42,0.94)_100%)] p-5 md:p-7 shadow-[0_24px_60px_rgba(255,122,24,0.16)]">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#FFB05A]">Business account</p>
          <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-white">{hero?.title || selectedBusiness.name}</h1>
              <div className="mt-3 inline-flex rounded-full border border-[#FFB05A]/35 bg-[rgba(255,176,90,0.12)] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#FFD2A0]">
                {hero?.statusBadge || 'Business banking'}
              </div>
              <p className="mt-3 max-w-2xl text-sm text-slate-300">{hero?.subtitle}</p>
            </div>
            <div className="flex flex-wrap gap-3 lg:max-w-[30rem] lg:justify-end">
              {renderAction(hero?.primaryAction, 0)}
              {(hero?.secondaryActions || []).map((action, index) => renderAction(action, index + 1))}
              <div className="rounded-2xl border border-slate-700 bg-slate-950/45 px-4 py-3 text-sm text-slate-300">
                Access: <span className="font-semibold text-white">{currentUserRole || 'member'}</span>
              </div>
            </div>
          </div>
        </section>

        <BusinessWorkspaceNav pendingCount={approvalSummary?.total_pending || 0} visibleNavigationItems={navigationItems} />

        {isInvestorSandbox ? (
          <SandboxContextCard eyebrow="03 · Business" title="The same infrastructure, extended to business operations">
            Greenfield Services Ltd shows how the platform extends from personal and group finance into business operations: receiving funds, vendors and payees, operational transfers, controls and payouts. The balances and activity below are the business workspace&apos;s live server-authoritative data.
          </SandboxContextCard>
        ) : null}

        {errorMessage ? (
          <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 px-5 py-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-semibold text-rose-100">Workspace unavailable</div>
                <div className="mt-1 text-sm text-rose-200/90">{errorMessage}</div>
              </div>
              <button
                type="button"
                onClick={retryLoad}
                className="rounded-xl border border-rose-300/30 px-4 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-500/10 transition"
              >
                Retry
              </button>
            </div>
          </div>
        ) : loading ? (
          <BusinessDashboardSkeleton />
        ) : screenMode === 'operational' ? (
          <>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
              {metrics.map((metric) => {
                if (metric.type === 'balance') {
                  return (
                    <section key={metric.key} className={`${cardClass} xl:col-span-2`}>
                      <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{metric.label}</div>
                      <div className="mt-3 text-4xl md:text-5xl font-semibold text-white">
                        <ShadowValue>{formatNgn(metric.value ?? 0)}</ShadowValue>
                      </div>
                      <div className="mt-3 text-sm text-slate-400">
                        Available balance: {formatNgn(wallet?.available_balance ?? wallet?.balance ?? metric.value ?? 0)}
                      </div>
                    </section>
                  )
                }

                if (metric.type === 'receiving_account') {
                  return (
                    <section key={metric.key} className={cardClass}>
                      <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{metric.label}</div>
                      <div className="mt-3 text-xl font-semibold text-white">{metric.value}</div>
                      <div className="mt-2 text-sm text-slate-400">{metric.bankName || 'Business account unavailable'}</div>
                      <div className="mt-2 text-xs text-slate-500">
                        {account?.account_number
                          ? 'Use this account number for inbound business funding.'
                          : 'Receiving account is not available yet.'}
                      </div>
                      <div className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">{metric.status}</div>
                    </section>
                  )
                }

                return (
                  <section key={metric.key} className={cardClass}>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{metric.label}</div>
                    <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-4">
                        <div className="text-2xl font-semibold text-amber-300">{metric.value || 0}</div>
                        <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">Pending</div>
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-3 py-4">
                        <div className="text-2xl font-semibold text-emerald-300">{metric.approved || 0}</div>
                        <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">Approved</div>
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-3 py-4">
                        <div className="text-2xl font-semibold text-rose-300">{metric.rejected || 0}</div>
                        <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">Rejected</div>
                      </div>
                    </div>
                  </section>
                )
              })}
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <section className={cardClass}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Transactions</p>
                    <h2 className="mt-1 text-lg md:text-xl font-semibold text-white">{activitySection?.title || 'Recent business activity'}</h2>
                  </div>
                </div>

                {activityLoading ? (
                  <div className="text-sm text-slate-400">Loading recent business activity...</div>
                ) : transactions.length ? (
                  <div className="space-y-3">
                    {transactions.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <div className="text-sm font-semibold text-white">{item.label || 'Business activity'}</div>
                            <div className="mt-1 text-xs text-slate-400">{formatDate(item.occurred_at)}</div>
                            <div className="mt-2 text-xs text-slate-500">
                              {item?.meta?.narration || item?.meta?.beneficiary_name || item?.meta?.transfer_reference || 'Business ledger entry'}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-white">
                              <ShadowValue>{formatNgn((Number(item?.amount_cents || 0) || 0) / 100)}</ShadowValue>
                            </div>
                            <div className={`mt-1 text-[11px] uppercase tracking-[0.16em] ${statusTone(item?.status)}`}>
                              {item?.meta?.status_label || item?.status || 'posted'}
                            </div>
                            <div className="mt-3 flex justify-end gap-2">
                              {item?.meta?.transfer_reference ? (
                                <Link
                                  to={`/dashboard/business/transfers/${encodeURIComponent(item.meta.transfer_reference)}`}
                                  className="text-xs text-[#FFB05A] hover:text-[#ffd2a0] transition"
                                >
                                  Details
                                </Link>
                              ) : null}
                              {item?.meta?.transfer_reference ? (
                                <Link
                                  to={`/dashboard/business/receipts/${encodeURIComponent(item.meta.transfer_reference)}`}
                                  className="text-xs text-slate-300 hover:text-white transition"
                                >
                                  Receipt
                                </Link>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-5">
                    <div className="text-sm font-medium text-slate-200">No activity yet.</div>
                    <div className="mt-2 text-sm text-slate-400">
                      {activitySection?.emptyState || 'Inbound funding and business transfer activity will appear here as soon as this workspace starts moving money.'}
                    </div>
                  </div>
                )}
              </section>

              <div className="flex flex-col gap-6">
                <section className={cardClass}>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Financial controls</p>
                  {activePolicy ? (
                    <div className="mt-4 space-y-3 text-sm text-slate-300">
                      <div className="flex items-center justify-between gap-3">
                        <span>Policy mode</span>
                        <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${policyTone}`}>
                          {activePolicy.mode}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Policy type</span>
                        <span className="text-white capitalize">{activePolicy.policy_type}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Threshold</span>
                        <span className="text-white">{formatNgn(activePolicy.threshold_amount)}</span>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Required roles</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {activePolicyRequiredRoles.length ? (
                            activePolicyRequiredRoles.map((role) => (
                              <span
                                key={role}
                                className="rounded-full border border-slate-700 bg-slate-950/50 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-slate-200"
                              >
                                {role}
                              </span>
                            ))
                          ) : (
                            <span className="rounded-full border border-slate-700 bg-slate-950/50 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-slate-400">
                              No explicit approver roles
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4 text-sm text-slate-400">
                      No active approval policy configured for this business yet.
                    </div>
                  )}
                </section>
              </div>
            </div>
            {isInvestorSandbox ? (
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-4 text-sm leading-6 text-slate-300">
                Personal → Group Finance → Business: three relationships operating on the same BitBridge Global financial infrastructure.
              </div>
            ) : null}
          </>
        ) : (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
            <section className={cardClass}>
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{statusSummary?.title || 'Your account progress'}</p>
              <div className="mt-4 space-y-3">
                {(statusSummary?.items || []).map((item) => (
                  <div key={item.key} className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{item.label}</div>
                        <div className="mt-2 text-sm font-medium text-slate-100">{item.value}</div>
                      </div>
                      <div
                        className={[
                          'rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.14em]',
                          item.tone === 'positive'
                            ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                            : item.tone === 'warning'
                            ? 'border border-amber-500/30 bg-amber-500/10 text-amber-100'
                            : 'border border-slate-700 bg-slate-950/50 text-slate-300',
                        ].join(' ')}
                      >
                        {item.tone === 'positive' ? 'Ready' : item.tone === 'warning' ? 'Pending' : 'Next'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="flex flex-col gap-6">
              <section className={cardClass}>
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">What&apos;s left to complete</div>
                <div className="mt-2 text-sm text-slate-400">Finish these items and we&apos;ll guide you to the next step.</div>
                <div className="mt-4">
                  {statusSummary?.blockingItems?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {statusSummary.blockingItems.map((item) => (
                        <span
                          key={item.key}
                          className="rounded-full border border-amber-500/30 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-amber-100"
                        >
                          {item.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-100">
                      Nothing else is needed right now.
                    </div>
                  )}
                </div>
              </section>

              <section className={cardClass}>
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Progress so far</div>
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between gap-3">
                    <span>Business details complete</span>
                    <span className={progress?.profileReady ? 'text-emerald-300' : 'text-amber-300'}>
                      {progress?.profileReady ? 'Complete' : 'In progress'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Documents complete</span>
                    <span className={progress?.documentsReady ? 'text-emerald-300' : 'text-amber-300'}>
                      {progress?.documentsReady ? 'Complete' : 'In progress'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Ready for account setup</span>
                    <span className={progress?.approvedForProvisioning ? 'text-emerald-300' : 'text-amber-300'}>
                      {progress?.approvedForProvisioning ? 'Ready' : 'Not yet'}
                    </span>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default BusinessDashboard
