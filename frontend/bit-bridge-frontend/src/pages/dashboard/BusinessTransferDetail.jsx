import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import ShadowValue from '../../components/ShadowValue'
import useSelectedBusiness from '../../hooks/useSelectedBusiness'
import BusinessWorkspaceRequired from '../../components/business/BusinessWorkspaceRequired'
import { getBusinessApprovalSummary, getBusinessTransfer } from '../../api/business'
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
  if (['failed', 'rejected', 'reversed'].includes(normalized)) return 'border-rose-500/40 bg-rose-500/10 text-rose-200'
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

const BusinessTransferDetail = () => {
  const navigate = useNavigate()
  const { reference } = useParams()
  const { ownerMode, selectedBusiness } = useSelectedBusiness()
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [transfer, setTransfer] = useState(null)
  const [approvalSummary, setApprovalSummary] = useState(null)

  useEffect(() => {
    let active = true

    const loadTransfer = async () => {
      if (!selectedBusiness?.id || !reference) {
        setLoading(false)
        return
      }

      setLoading(true)
      setErrorMessage('')
      try {
        const [response, summaryRes] = await Promise.all([
          getBusinessTransfer(selectedBusiness.id, reference),
          getBusinessApprovalSummary(selectedBusiness.id).catch(() => null),
        ])
        if (!active) return
        setTransfer(response?.data?.data?.transfer || null)
        setApprovalSummary(summaryRes?.data?.data || null)
      } catch (error) {
        if (!active) return
        const message = error?.response?.data?.message || 'Unable to load the transfer details.'
        setErrorMessage(message)
        toast.error(message)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadTransfer()
    return () => {
      active = false
    }
  }, [reference, selectedBusiness?.id])

  if (ownerMode !== 'business') {
    return <Navigate to="/dashboard/home" replace />
  }

  if (!selectedBusiness) {
    return <BusinessWorkspaceRequired message="Select a business workspace from the switcher or return to the setup hub to review transfer details." />
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <section className="rounded-[28px] border border-slate-800 bg-[linear-gradient(135deg,rgba(2,6,23,0.96),rgba(15,23,42,0.94))] p-5 md:p-7">
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Business Transfer</p>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-white">{selectedBusiness.name}</h1>
              <p className="mt-2 text-sm text-slate-400 max-w-2xl">
                Review the current state, destination, and receipt trail for this business transfer.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white"
            >
              Back
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
        ) : transfer ? (
          <>
            <section className={cardClass}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Transfer amount</div>
                  <div className="mt-3 text-4xl font-semibold text-white">
                    <ShadowValue>{formatNgn(transfer.amount || 0)}</ShadowValue>
                  </div>
                  <div className="mt-3 text-sm text-slate-400">{transfer.reference}</div>
                </div>
                <div className={`inline-flex rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusTone(transfer.status)}`}>
                  {transfer.status}
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
              <section className={cardClass}>
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Transfer details</p>
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between gap-3">
                    <span>Narration</span>
                    <span className="text-white">{transfer.narration || 'Not available'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Lifecycle state</span>
                    <span className="text-white">{transfer.lifecycle_state || 'Not available'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Created</span>
                    <span className="text-white">{formatDate(transfer.created_at)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Updated</span>
                    <span className="text-white">{formatDate(transfer.updated_at)}</span>
                  </div>
                </div>
              </section>

              <section className={cardClass}>
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Destination</p>
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between gap-3">
                    <span>Account name</span>
                    <span className="text-white">{transfer?.destination?.account_name || 'Not available'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Account number</span>
                    <span className="text-white">{transfer?.destination?.account_number || 'Not available'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Bank</span>
                    <span className="text-white">{transfer?.destination?.bank_name || 'Not available'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Provider</span>
                    <span className="text-white uppercase">{transfer?.provider?.name || 'anchor'}</span>
                  </div>
                </div>
              </section>
            </div>

            <section className={cardClass}>
              <div className="flex flex-wrap gap-3">
                <Link
                  to={`/dashboard/business/receipts/${encodeURIComponent(transfer.receipt_reference || transfer.reference)}`}
                  className="rounded-xl bg-[#FFB05A] px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-[#ffc27d] transition"
                >
                  Open receipt
                </Link>
                <Link
                  to="/dashboard/business/approvals"
                  className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white"
                >
                  Open approval inbox
                </Link>
              </div>
            </section>
          </>
        ) : (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 text-sm text-slate-400">
            Transfer not found.
          </div>
        )}
      </div>
    </div>
  )
}

export default BusinessTransferDetail

