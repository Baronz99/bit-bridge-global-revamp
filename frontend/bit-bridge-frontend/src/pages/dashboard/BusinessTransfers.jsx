import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import useSelectedBusiness from '../../hooks/useSelectedBusiness'
import BusinessWorkspaceRequired from '../../components/business/BusinessWorkspaceRequired'
import { getBusinessApprovalSummary, getBusinessTransactions } from '../../api/business'
import BusinessWorkspaceNav from '../../components/business/BusinessWorkspaceNav'

const cardClass =
  'rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.22)]'

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

const BusinessTransfers = () => {
  const { ownerMode, selectedBusiness } = useSelectedBusiness()
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [transactions, setTransactions] = useState([])
  const [approvalSummary, setApprovalSummary] = useState(null)

  useEffect(() => {
    let active = true

    const loadTransfers = async () => {
      if (!selectedBusiness?.id) {
        setLoading(false)
        return
      }

      setLoading(true)
      setErrorMessage('')
      try {
        const [transactionsRes, summaryRes] = await Promise.all([
          getBusinessTransactions(selectedBusiness.id, { limit: 40 }).catch(() => null),
          getBusinessApprovalSummary(selectedBusiness.id).catch(() => null),
        ])
        if (!active) return
        setTransactions(Array.isArray(transactionsRes?.data?.items) ? transactionsRes.data.items : [])
        setApprovalSummary(summaryRes?.data?.data || null)
      } catch (error) {
        if (!active) return
        const message = error?.response?.data?.message || 'Unable to load business transfers.'
        setErrorMessage(message)
        toast.error(message)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadTransfers()
    return () => {
      active = false
    }
  }, [selectedBusiness?.id])

  const transferItems = useMemo(
    () => transactions.filter((item) => item?.meta?.transfer_reference),
    [transactions]
  )

  if (ownerMode !== 'business') return <Navigate to="/dashboard/home" replace />

  if (!selectedBusiness) {
    return <BusinessWorkspaceRequired message="Select a business workspace from the switcher or return to the setup hub to review transfers." />
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <section className="rounded-[28px] border border-slate-800 bg-[linear-gradient(135deg,rgba(2,6,23,0.96),rgba(15,23,42,0.94))] p-5 md:p-7">
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Business Transfers</p>
          <div className="mt-3">
            <h1 className="text-2xl md:text-3xl font-semibold text-white">{selectedBusiness.name}</h1>
            <p className="mt-2 text-sm text-slate-400 max-w-2xl">
              Review all transfer-linked activity in this business workspace, including pending and completed movements.
            </p>
          </div>
        </section>

        <BusinessWorkspaceNav
          pendingCount={approvalSummary?.total_pending || 0}
          action={
            <Link
              to="/dashboard/business/send"
              className="rounded-2xl bg-[#FFB05A] px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-[#ffc27d] transition"
            >
              New transfer
            </Link>
          }
        />

        <section className={cardClass}>
          {errorMessage ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
              {errorMessage}
            </div>
          ) : loading ? (
            <div className="text-sm text-slate-400">Loading transfers...</div>
          ) : transferItems.length ? (
            <div className="space-y-3">
              {transferItems.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white">{item.label || 'Business transfer'}</div>
                      <div className="mt-1 text-xs text-slate-400">{formatDate(item.occurred_at)}</div>
                      <div className="mt-2 text-xs text-slate-500">
                        {item?.meta?.narration || item?.meta?.beneficiary_name || item?.meta?.transfer_reference}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-white">
                        {formatNgn((Number(item?.amount_cents || 0) || 0) / 100)}
                      </div>
                      <div className={`mt-1 text-[11px] uppercase tracking-[0.16em] ${statusTone(item?.meta?.status_label || item?.status)}`}>
                        {item?.meta?.status_label || item?.status || 'posted'}
                      </div>
                      <div className="mt-3 flex justify-end gap-2">
                        <Link
                          to={`/dashboard/business/transfers/${encodeURIComponent(item.meta.transfer_reference)}`}
                          className="text-xs text-[#FFB05A] hover:text-[#ffd2a0] transition"
                        >
                          Details
                        </Link>
                        <Link
                          to={`/dashboard/business/receipts/${encodeURIComponent(item.meta.transfer_reference)}`}
                          className="text-xs text-slate-300 hover:text-white transition"
                        >
                          Receipt
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-5">
              <div className="text-sm font-medium text-slate-200">No business transfers yet.</div>
              <div className="mt-2 text-sm text-slate-400">
                Transfer-linked activity will appear here once this business sends or reviews outbound payments.
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default BusinessTransfers

