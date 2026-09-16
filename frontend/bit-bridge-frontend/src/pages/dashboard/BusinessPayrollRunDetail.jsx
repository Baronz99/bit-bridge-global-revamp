import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import ShadowValue from '../../components/ShadowValue'
import useSelectedBusiness from '../../hooks/useSelectedBusiness'
import BusinessWorkspaceRequired from '../../components/business/BusinessWorkspaceRequired'
import { exportBusinessPayoutRun, getBusinessApprovalSummary, getBusinessPayoutRun } from '../../api/business'
import BusinessWorkspaceNav from '../../components/business/BusinessWorkspaceNav'

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
  if (['successful', 'approved', 'completed'].includes(normalized)) return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
  if (['failed', 'rejected'].includes(normalized)) return 'border-rose-500/40 bg-rose-500/10 text-rose-200'
  if (['partially_completed'].includes(normalized)) return 'border-blue-500/40 bg-blue-500/10 text-blue-200'
  return 'border-amber-500/40 bg-amber-500/10 text-amber-200'
}

const DetailSkeleton = () => (
  <div className="space-y-6">
    <section className={cardClass}>
      <div className={`h-5 w-48 ${skeletonClass}`} />
      <div className={`mt-4 h-10 w-40 ${skeletonClass}`} />
      <div className={`mt-3 h-4 w-56 ${skeletonClass}`} />
    </section>
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <section className={cardClass}>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className={`h-4 w-full ${skeletonClass}`} />
          ))}
        </div>
      </section>
      <section className={cardClass}>
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className={`h-4 w-full ${skeletonClass}`} />
          ))}
        </div>
      </section>
    </div>
  </div>
)

const BusinessPayrollRunDetail = () => {
  const navigate = useNavigate()
  const { payoutRunId } = useParams()
  const { ownerMode, selectedBusiness } = useSelectedBusiness()
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [run, setRun] = useState(null)
  const [approvalSummary, setApprovalSummary] = useState(null)

  useEffect(() => {
    let active = true

    const loadRun = async () => {
      if (!selectedBusiness?.id || !payoutRunId) {
        setLoading(false)
        return
      }

      setLoading(true)
      setErrorMessage('')
      try {
        const [response, summaryRes] = await Promise.all([
          getBusinessPayoutRun(selectedBusiness.id, payoutRunId),
          getBusinessApprovalSummary(selectedBusiness.id).catch(() => null),
        ])
        if (!active) return
        setRun(response?.data?.data || null)
        setApprovalSummary(summaryRes?.data?.data || null)
      } catch (error) {
        if (!active) return
        const message = error?.response?.data?.message || 'Unable to load the payroll run.'
        setErrorMessage(message)
        toast.error(message)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadRun()
    return () => {
      active = false
    }
  }, [payoutRunId, selectedBusiness?.id])

  const handleExport = async () => {
    if (!selectedBusiness?.id || !payoutRunId) return
    setExporting(true)
    try {
      const response = await exportBusinessPayoutRun(selectedBusiness.id, payoutRunId)
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `bitbridge-payroll-run-${run?.reference || payoutRunId}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Unable to export this payroll run.')
    } finally {
      setExporting(false)
    }
  }

  if (ownerMode !== 'business') return <Navigate to="/dashboard/home" replace />

  if (!selectedBusiness) {
    return <BusinessWorkspaceRequired message="Select a business workspace from the switcher or return to the setup hub to review payroll history." />
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <section className="rounded-[28px] border border-slate-800 bg-[linear-gradient(135deg,rgba(2,6,23,0.96),rgba(15,23,42,0.94))] p-5 md:p-7">
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Payroll Run</p>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-white">{selectedBusiness.name}</h1>
              <p className="mt-2 text-sm text-slate-400 max-w-2xl">
                Review payroll period, approval state, and item-level outcomes for this run.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="rounded-xl bg-[#FFB05A] px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-[#ffc27d] disabled:opacity-60"
            >
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        </section>

        <BusinessWorkspaceNav pendingCount={approvalSummary?.total_pending || 0} />

        {errorMessage ? (
          <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 px-5 py-5 text-sm text-rose-100">
            {errorMessage}
          </div>
        ) : loading ? (
          <DetailSkeleton />
        ) : run ? (
          <>
            <section className={cardClass}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Payroll total</div>
                  <div className="mt-3 text-4xl font-semibold text-white">
                    <ShadowValue>{formatNgn(run.total_amount || 0)}</ShadowValue>
                  </div>
                  <div className="mt-3 text-sm text-slate-400">{run.reference}</div>
                </div>
                <div className={`inline-flex rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusTone(run.status)}`}>
                  {String(run.status || 'draft').replace(/_/g, ' ')}
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
              <section className={cardClass}>
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Cycle details</p>
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between gap-3">
                    <span>Payroll period</span>
                    <span className="text-white">{run.period_label || 'Manual run'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Period range</span>
                    <span className="text-white">
                      {run.period_starts_on || 'Not set'} {run.period_ends_on ? `to ${run.period_ends_on}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Cycle key</span>
                    <span className="text-white">{run.cycle_key || 'Not set'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Review status</span>
                    <span className="text-white">{run.review_ready ? 'Locked for review' : 'Draft editing'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Approval</span>
                    <span className="text-white">{run.approval_status || 'Not requested'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Reviewed at</span>
                    <span className="text-white">{formatDate(run.reviewed_at)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Submitted at</span>
                    <span className="text-white">{formatDate(run.submitted_at)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Executed at</span>
                    <span className="text-white">{formatDate(run.executed_at)}</span>
                  </div>
                </div>
              </section>

              <section className={cardClass}>
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Run summary</p>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Items</div>
                    <div className="mt-2 text-xl font-semibold text-white">{run.total_items || 0}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Successful</div>
                    <div className="mt-2 text-xl font-semibold text-white">{run.successful_items_count || 0}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Failed</div>
                    <div className="mt-2 text-xl font-semibold text-white">{run.failed_items_count || 0}</div>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/45 p-4 text-sm text-slate-300">
                  {run.approval_request_id ? (
                    <>Approval request <span className="font-mono text-xs text-white">{run.approval_request_id}</span> is linked to this payroll run.</>
                  ) : (
                    'This payroll run does not currently have an approval request linked.'
                  )}
                </div>
              </section>
            </div>

            <section className={cardClass}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Payroll items</p>
                <span className="text-xs text-slate-500">{run.items?.length || 0} entries</span>
              </div>
              <div className="mt-4 space-y-3">
                {Array.isArray(run.items) && run.items.length ? run.items.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white">{item.payee_name || item.account_name || 'Recipient'}</div>
                        <div className="mt-1 text-xs text-slate-400">
                          {item.payee_kind ? `${item.payee_kind} • ` : ''}{item.employee_code ? `${item.employee_code} • ` : ''}{item.bank_code} • {item.account_number}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {item.narration || 'No narration'}{item.external_reference ? ` • ${item.external_reference}` : ''}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-white">{formatNgn(item.amount || 0)}</div>
                        <div className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${statusTone(item.status)}`}>
                          {String(item.status || 'draft').replace(/_/g, ' ')}
                        </div>
                        {item.receipt_reference ? (
                          <div className="mt-3">
                            <Link
                              to={`/dashboard/business/receipts/${encodeURIComponent(item.receipt_reference)}`}
                              className="text-xs text-[#FFB05A] hover:text-[#ffd2a0]"
                            >
                              Open receipt
                            </Link>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-5 text-sm text-slate-400">
                    No payroll items found.
                  </div>
                )}
              </div>
            </section>
          </>
        ) : (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 text-sm text-slate-400">
            Payroll run not found.
          </div>
        )}
      </div>
    </div>
  )
}

export default BusinessPayrollRunDetail

