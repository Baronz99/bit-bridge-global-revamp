import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import ShadowValue from '../../components/ShadowValue'
import logoIcon from '../../assets/logos/bitbridge-logo-clear.png'
import useSelectedBusiness from '../../hooks/useSelectedBusiness'
import BusinessWorkspaceRequired from '../../components/business/BusinessWorkspaceRequired'
import { getBusinessApprovalSummary, getBusinessReceipt } from '../../api/business'
import BusinessWorkspaceNav from '../../components/business/BusinessWorkspaceNav'
import {
  contextChipClassName,
  fallbackValue,
  normalizeReceiptPayload,
  resolveReceiptPresentation,
} from '../../utils/receiptContract'

const toCurrency = (amount, currency) => {
  if (amount === null || amount === undefined) return 'Not available'
  return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'en-NG', {
    style: 'currency',
    currency: currency || 'NGN',
    minimumFractionDigits: 2,
  }).format(Number(amount || 0))
}

const statusTone = (status) => {
  const normalized = String(status || '').toLowerCase()
  if (['approved', 'completed', 'success', 'paid', 'successful'].includes(normalized)) return 'bg-emerald-500/15 text-emerald-300'
  if (['failed', 'declined', 'cancelled', 'reversed', 'rejected'].includes(normalized)) return 'bg-rose-500/15 text-rose-300'
  return 'bg-amber-500/15 text-amber-300'
}

const BusinessReceipt = () => {
  const { reference } = useParams()
  const navigate = useNavigate()
  const { ownerMode, selectedBusiness } = useSelectedBusiness()
  const [loading, setLoading] = useState(true)
  const [receipt, setReceipt] = useState(null)
  const [approvalSummary, setApprovalSummary] = useState(null)

  useEffect(() => {
    let active = true

    const load = async () => {
      setLoading(true)
      if (!selectedBusiness?.id || !reference) {
        setReceipt(null)
        setLoading(false)
        return
      }

      try {
        const [res, summaryRes] = await Promise.all([
          getBusinessReceipt(selectedBusiness.id, reference),
          getBusinessApprovalSummary(selectedBusiness.id).catch(() => null),
        ])
        if (!active) return
        setReceipt(normalizeReceiptPayload(res?.data?.data || null, reference, 'Business receipt'))
        setApprovalSummary(summaryRes?.data?.data || null)
      } catch (error) {
        if (!active) return
        toast.error(error?.response?.data?.message || 'Unable to load receipt.')
        setReceipt(null)
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [reference, selectedBusiness?.id])

  const presentation = useMemo(() => resolveReceiptPresentation(receipt), [receipt])
  const provider = useMemo(() => receipt?.provider || {}, [receipt])
  const timeline = useMemo(() => receipt?.timeline || [], [receipt])
  const generatedAt = useMemo(() => new Date().toLocaleString(), [])

  if (ownerMode !== 'business') {
    return <Navigate to="/dashboard/home" replace />
  }

  if (!selectedBusiness) {
    return <BusinessWorkspaceRequired message="Select a business workspace from the switcher or return to the setup hub to open business receipts." />
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6">
        <div className="max-w-2xl mx-auto bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
          <div className="text-sm text-slate-400">Loading receipt...</div>
        </div>
      </div>
    )
  }

  if (!receipt) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6">
        <div className="max-w-2xl mx-auto bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
          <p className="text-sm text-slate-300">Receipt not found.</p>
          <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-200">
            Go back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={logoIcon} alt="BitBridge Global logo" className="h-10 w-10 object-contain" />
            <div>
              <h1 className="text-2xl font-semibold">{presentation.headerTitle}</h1>
              <p className="text-xs text-slate-400 mt-1">Auditable summary for business receipts.</p>
            </div>
          </div>
          <div className="text-xs text-slate-400">Generated at {generatedAt}</div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-semibold">{receipt.title || presentation.headerTitle}</p>
                <span className={`text-[11px] uppercase tracking-[0.18em] px-3 py-1 rounded-full ${contextChipClassName(receipt)}`}>
                  {presentation.contextLabel}
                </span>
              </div>
              <p className="text-xs text-slate-500">{receipt.created_at ? new Date(receipt.created_at).toLocaleString() : '--'}</p>
              {receipt.subtitle ? <p className="text-sm text-slate-400">{receipt.subtitle}</p> : null}
            </div>
            <span className={`text-[11px] uppercase tracking-widest px-3 py-1 rounded-full ${statusTone(receipt.status || receipt.lifecycle_state)}`}>
              {receipt.status || receipt.lifecycle_state || 'pending'}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 p-4 bg-slate-900/80">
              <p className="text-xs text-slate-400">Amount</p>
              <p className="text-xl font-semibold mt-1">
                <ShadowValue>{toCurrency(receipt.amount, receipt.currency || 'NGN')}</ShadowValue>
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 p-4 bg-slate-900/80">
              <p className="text-xs text-slate-400">Fee</p>
              <p className="text-base font-semibold mt-1">{toCurrency(receipt.fee, receipt.currency || 'NGN')}</p>
            </div>
            <div className="rounded-xl border border-slate-800 p-4 bg-slate-900/80">
              <p className="text-xs text-slate-400">Total</p>
              <p className="text-base font-semibold mt-1">{toCurrency(receipt.total, receipt.currency || 'NGN')}</p>
            </div>
          </div>

          <div className="grid gap-3 text-sm text-slate-300">
            <div className="flex items-center justify-between">
              <span>Reference</span>
              <span className="text-slate-100">{fallbackValue(receipt.reference || reference)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Provider</span>
              <span className="text-slate-100 capitalize">{fallbackValue(provider.name)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Provider reference</span>
              <span className="text-slate-100">{fallbackValue(provider.reference || receipt.external_reference || receipt.session_id)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Business</span>
              <span className="text-slate-100">{fallbackValue(selectedBusiness.name)}</span>
            </div>
          </div>
        </div>

        <BusinessWorkspaceNav pendingCount={approvalSummary?.total_pending || 0} />

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-slate-100">Timeline</h2>
          <div className="mt-4 space-y-3">
            {timeline.length === 0 && <p className="text-xs text-slate-400">No events recorded.</p>}
            {timeline.map((event, idx) => (
              <div key={`${event.label || 'event'}-${idx}`} className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-100">{event.label}</p>
                  {event.description ? <p className="text-xs text-slate-400 mt-1">{event.description}</p> : null}
                  <p className="text-xs text-slate-500">{event.occurred_at ? new Date(event.occurred_at).toLocaleString() : 'Not available'}</p>
                </div>
                <span className="text-[11px] uppercase text-slate-400">{event.status || 'pending'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 rounded-xl border border-slate-700 text-xs text-slate-300">
            Back
          </button>
          <button type="button" onClick={() => window.print()} className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-200">
            Print receipt
          </button>
        </div>
      </div>
    </div>
  )
}

export default BusinessReceipt
