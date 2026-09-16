import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import useSelectedBusiness from '../../hooks/useSelectedBusiness'
import BusinessWorkspaceRequired from '../../components/business/BusinessWorkspaceRequired'
import { getBusinessApprovalSummary, getBusinessTransactions } from '../../api/business'
import BusinessWorkspaceNav from '../../components/business/BusinessWorkspaceNav'

const cardClass =
  'rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.22)]'

const formatDate = (value) => {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return date.toLocaleString()
}

const BusinessReceiptsHub = () => {
  const navigate = useNavigate()
  const { ownerMode, selectedBusiness } = useSelectedBusiness()
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [approvalSummary, setApprovalSummary] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [reference, setReference] = useState('')

  useEffect(() => {
    let active = true

    const loadReceiptsHub = async () => {
      if (!selectedBusiness?.id) {
        setLoading(false)
        return
      }

      setLoading(true)
      setErrorMessage('')
      try {
        const [transactionsRes, summaryRes] = await Promise.all([
          getBusinessTransactions(selectedBusiness.id, { limit: 20 }).catch(() => null),
          getBusinessApprovalSummary(selectedBusiness.id).catch(() => null),
        ])
        if (!active) return
        setTransactions(Array.isArray(transactionsRes?.data?.items) ? transactionsRes.data.items : [])
        setApprovalSummary(summaryRes?.data?.data || null)
      } catch (error) {
        if (!active) return
        const message = error?.response?.data?.message || 'Unable to load business receipts.'
        setErrorMessage(message)
        toast.error(message)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadReceiptsHub()
    return () => {
      active = false
    }
  }, [selectedBusiness?.id])

  const receiptReferences = transactions
    .map((item) => item?.meta?.transfer_reference)
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index)

  if (ownerMode !== 'business') return <Navigate to="/dashboard/home" replace />

  if (!selectedBusiness) {
    return <BusinessWorkspaceRequired message="Select a business workspace from the switcher or return to the setup hub to open receipts." />
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <section className="rounded-[28px] border border-slate-800 bg-[linear-gradient(135deg,rgba(2,6,23,0.96),rgba(15,23,42,0.94))] p-5 md:p-7">
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Business Receipts</p>
          <div className="mt-3">
            <h1 className="text-2xl md:text-3xl font-semibold text-white">{selectedBusiness.name}</h1>
            <p className="mt-2 text-sm text-slate-400 max-w-2xl">
              Open business receipts by reference and review recent transfer receipts from this workspace.
            </p>
          </div>
        </section>

        <BusinessWorkspaceNav pendingCount={approvalSummary?.total_pending || 0} />

        <section className={cardClass}>
          <form
            className="flex flex-col gap-3 md:flex-row"
            onSubmit={(event) => {
              event.preventDefault()
              const trimmed = reference.trim()
              if (!trimmed) return
              navigate(`/dashboard/business/receipts/${encodeURIComponent(trimmed)}`)
            }}
          >
            <input
              type="text"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Enter business receipt reference"
              className="flex-1 rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/60"
            />
            <button
              type="submit"
              className="rounded-2xl bg-[#FFB05A] px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-[#ffc27d] transition"
            >
              Open receipt
            </button>
          </form>
        </section>

        <section className={cardClass}>
          {errorMessage ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
              {errorMessage}
            </div>
          ) : loading ? (
            <div className="text-sm text-slate-400">Loading receipts...</div>
          ) : receiptReferences.length ? (
            <div className="space-y-3">
              {receiptReferences.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => navigate(`/dashboard/business/receipts/${encodeURIComponent(item)}`)}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4 text-left hover:border-slate-600 hover:bg-slate-950/60 transition"
                >
                  <div className="text-sm font-semibold text-white">{item}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    Recent business receipt
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    Last seen {formatDate(transactions.find((tx) => tx?.meta?.transfer_reference === item)?.occurred_at)}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-5">
              <div className="text-sm font-medium text-slate-200">No business receipts yet.</div>
              <div className="mt-2 text-sm text-slate-400">
                Receipts will appear here once this workspace has transfer-linked activity.
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default BusinessReceiptsHub

