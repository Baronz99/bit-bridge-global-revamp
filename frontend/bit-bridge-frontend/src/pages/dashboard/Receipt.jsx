import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import ShadowValue from '../../components/ShadowValue'
import nairaFormat from '../../utils/nairaFormat'
import { getReceipt, getTransactionReceipt } from '../../api/receipts'
import logoIcon from '../../assets/logos/bitbridge-logo-clear.png'

const usdFormat = (n) => {
  const value = Number(n || 0)
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatAmount = (amount, currency) => {
  if (amount === null || amount === undefined) return 'Not available'
  if (!currency || currency.toUpperCase() === 'NGN') return nairaFormat(amount, 'ngn')
  if (currency.toUpperCase() === 'USD') return `USD ${usdFormat(amount)}`
  return `${currency.toUpperCase()} ${usdFormat(amount)}`
}

const fallbackValue = (value) => (value === null || value === undefined || value === '' ? 'Not available' : value)
const toNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const sumFees = (fees) =>
  Array.isArray(fees)
    ? fees.reduce((sum, fee) => sum + (toNumber(fee?.amount) || 0), 0)
    : null

const normalizeTimelineItem = (item) => {
  if (!item || typeof item !== 'object') return null
  const state = String(item.state || item.status || 'pending').toLowerCase()
  return {
    label: item.label || item.event_type || item.step_key || 'Update',
    description: item.description || '',
    status: state,
    occurred_at: item.occurred_at || item.created_at || null,
  }
}

const normalizeReceiptPayload = (raw, fallbackReference = '') => {
  const payload = raw && typeof raw === 'object' ? raw : {}
  const financials = payload.financials && typeof payload.financials === 'object' ? payload.financials : null
  const fees = Array.isArray(financials?.fees) ? financials.fees : Array.isArray(payload.fees) ? payload.fees : []
  const computedFee = financials?.total_fees ?? payload.fee ?? sumFees(fees)
  const amount =
    toNumber(financials?.value_amount) ??
    toNumber(payload.value_amount) ??
    toNumber(payload.amount) ??
    toNumber(payload.wallet_amount_charged) ??
    toNumber(payload.total_display)
  const fee = toNumber(computedFee)
  const total =
    toNumber(financials?.total_debit) ??
    toNumber(payload.total) ??
    toNumber(payload.total_display) ??
    toNumber(payload.wallet_amount_charged) ??
    (amount !== null && fee !== null ? amount + fee : null)

  const providerRaw = payload.provider
  const provider =
    typeof providerRaw === 'string'
      ? { name: providerRaw }
      : providerRaw && typeof providerRaw === 'object'
        ? {
            ...providerRaw,
            reference: providerRaw.reference || providerRaw.transaction_reference || null,
          }
        : {}

  const timeline = Array.isArray(payload.timeline)
    ? payload.timeline.map(normalizeTimelineItem).filter(Boolean)
    : []

  const hasUnifiedFields = Boolean(
    payload.kind ||
      payload.event ||
      payload.occurred_at ||
      payload.title ||
      payload.subtitle ||
      payload.value_amount !== undefined ||
      payload.total_display !== undefined ||
      Array.isArray(payload.fees)
  )
  const hasLegacyMarkers = Boolean(payload.type || payload.source || payload.transaction_reference)

  return {
    ...payload,
    reference: payload.reference || fallbackReference,
    title: payload.title || payload.description || payload.kind || payload.type || 'Transaction receipt',
    subtitle: payload.subtitle || '',
    created_at: payload.created_at || payload.occurred_at || payload.updated_at || null,
    amount,
    fee,
    total,
    fees,
    financials,
    provider,
    timeline,
    __isLegacy: !hasUnifiedFields && hasLegacyMarkers,
  }
}

const statusTone = (status) => {
  const normalized = String(status || '').toLowerCase()
  if (['approved', 'completed', 'success', 'paid'].includes(normalized)) return 'bg-emerald-500/15 text-emerald-300'
  if (['failed', 'declined', 'cancelled', 'reversed', 'provider_unavailable', 'timedout', 'timeout'].includes(normalized))
    return 'bg-rose-500/15 text-rose-300'
  return 'bg-amber-500/15 text-amber-300'
}

const Receipt = () => {
  const { reference } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [receipt, setReceipt] = useState(null)
  const [isLegacy, setIsLegacy] = useState(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      if (!reference) {
        setReceipt(null)
        setIsLegacy(false)
        setLoading(false)
        return
      }
      try {
        const res = await getTransactionReceipt(reference)
        if (!active) return
        setReceipt(normalizeReceiptPayload(res?.data?.data || null, reference))
        setIsLegacy(false)
      } catch (error) {
        if (!active) return
        if (error?.response?.status === 404) {
          try {
            const legacy = await getReceipt(reference)
            if (!active) return
            const normalized = normalizeReceiptPayload(legacy?.data?.data || null, reference)
            setReceipt(normalized)
            setIsLegacy(Boolean(normalized?.__isLegacy))
            if (normalized?.__isLegacy) console.warn('[receipt] legacy receipt format in use')
          } catch (fallbackError) {
            if (!active) return
            toast.error(fallbackError?.response?.data?.message || 'Unable to load receipt.')
            setReceipt(null)
            setIsLegacy(false)
          }
        } else {
          toast.error(error?.response?.data?.message || 'Unable to load receipt.')
          setReceipt(null)
          setIsLegacy(false)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }
    if (reference) load()
    return () => {
      active = false
    }
  }, [reference])

  const title = receipt?.title || receipt?.description || receipt?.kind || 'Transaction receipt'
  const createdAt = receipt?.created_at ? new Date(receipt.created_at).toLocaleString() : '--'
  const currency = receipt?.currency || 'NGN'
  const amount = receipt?.amount
  const fee = receipt?.fee
  const total = receipt?.total
  const statusValue = String(receipt?.lifecycle_state || receipt?.status || '').toLowerCase()
  const isPending = ['pending', 'processing', 'initialized', 'reserved', 'pending_provider'].includes(statusValue)
  const isFailed = ['failed', 'declined', 'cancelled', 'reversed', 'expired', 'provider_unavailable', 'timedout', 'timeout', 'failed_unrecovered', 'failed_reversal_pending', 'failed_refunded'].includes(statusValue)
  const isSuccess = ['approved', 'completed', 'success', 'paid'].includes(statusValue)
  const provider = useMemo(() => receipt?.provider || {}, [receipt])
  const financials = useMemo(() => receipt?.financials || null, [receipt])
  const generatedAt = useMemo(() => new Date().toLocaleString(), [])
  const timeline = useMemo(() => receipt?.timeline || [], [receipt])
  const fx = useMemo(() => receipt?.fx || null, [receipt])
  const linked = useMemo(() => receipt?.linked || {}, [receipt])

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(String(receipt?.reference || reference))
      toast.success('Reference copied.')
    } catch {
      toast.info(receipt?.reference || reference || '')
    }
  }

  const copyProviderReference = async () => {
    if (!provider?.reference) return
    try {
      await navigator.clipboard.writeText(String(provider.reference))
      toast.success('Provider reference copied.')
    } catch {
      toast.info(provider?.reference || '')
    }
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
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-200"
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <style>{`
        @media print {
          body { background: #ffffff !important; color: #0f172a !important; }
          .print-hidden { display: none !important; }
          .print-surface { background: #ffffff !important; border-color: #e2e8f0 !important; color: #0f172a !important; }
          .print-text { color: #0f172a !important; }
          .print-muted { color: #475569 !important; }
        }
      `}</style>
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between gap-4 print-text">
          <div className="flex items-center gap-3">
            {logoIcon ? (
              <img src={logoIcon} alt="BitBridge Global logo" className="h-10 w-10 object-contain" />
            ) : (
              <div className="text-lg font-semibold">BitBridge Global</div>
            )}
            <div>
              <h1 className="text-2xl font-semibold">Transaction receipt</h1>
              <p className="text-xs text-slate-400 mt-1 print-muted">Auditable summary for your records.</p>
            </div>
          </div>
          <div className="text-xs text-slate-400 print-muted">Generated at {generatedAt}</div>
        </div>

        {isLegacy && (
          <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2">
            Legacy receipt format in use. Details may be limited.
          </div>
        )}
        {financials?.reconciliation_status === 'mismatch' && (
          <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-2">
            Receipt totals are being reconciled. Contact support with your reference if this persists.
          </div>
        )}

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-6 print-surface">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-lg font-semibold print-text">{title}</p>
              <p className="text-xs text-slate-500 mt-1 print-muted">{createdAt}</p>
            </div>
            <span className={`text-[11px] uppercase tracking-widest px-3 py-1 rounded-full ${statusTone(statusValue)}`}>
              {statusValue || 'pending'}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 p-4 bg-slate-900/80 print-surface">
              <p className="text-xs text-slate-400 print-muted">Amount</p>
              <p className="text-xl font-semibold mt-1">
                <ShadowValue>{formatAmount(amount, currency)}</ShadowValue>
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 p-4 bg-slate-900/80 print-surface">
              <p className="text-xs text-slate-400 print-muted">Fee</p>
              <p className="text-base font-semibold mt-1 print-text">{formatAmount(fee, currency)}</p>
            </div>
            <div className="rounded-xl border border-slate-800 p-4 bg-slate-900/80 print-surface">
              <p className="text-xs text-slate-400 print-muted">Total</p>
              <p className="text-base font-semibold mt-1 print-text">{formatAmount(total, currency)}</p>
            </div>
          </div>

          <div className="grid gap-3 text-sm text-slate-300 print-text">
            <div className="flex items-center justify-between">
              <span>Reference</span>
              <span className="text-slate-100">{fallbackValue(receipt?.reference || reference)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Provider</span>
              <span className="text-slate-100 capitalize">{fallbackValue(provider?.name)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Provider reference</span>
              <span className="text-slate-100">{fallbackValue(provider?.reference)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Provider status</span>
              <span className="text-slate-100">{fallbackValue(provider?.status)}</span>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4 text-xs text-slate-400 print-muted">
            {isPending && (
              <p>
                Processing. If this takes longer than 24 hours, please contact support with your receipt reference.
              </p>
            )}
            {isFailed && (
              <div className="space-y-1">
                <p>
                  {statusValue === 'failed_refunded'
                    ? 'This transaction failed but funds were returned to your wallet.'
                    : statusValue === 'failed_reversal_pending' || statusValue === 'failed_unrecovered'
                    ? 'This transaction failed and reversal is in progress. Contact support if this persists.'
                    : 'This transaction failed. You can retry the action or contact support with your receipt reference.'}
                </p>
                {provider?.status && <p>Provider status: {provider.status}</p>}
                {receipt?.display_message && <p>{receipt.display_message}</p>}
              </div>
            )}
            {isSuccess && (
              <div className="space-y-1">
                <p>Completed at {fallbackValue(receipt?.updated_at ? new Date(receipt.updated_at).toLocaleString() : '')}</p>
                <p>Provider reference: {fallbackValue(provider?.reference)}</p>
              </div>
            )}
            {!isPending && !isFailed && !isSuccess && (
              <p>Check your timeline for the latest state or contact support if you need help.</p>
            )}
          </div>

          {fx && (
            <div className="border-t border-slate-800 pt-4 space-y-2 text-xs text-slate-400 print-muted">
              <div className="flex items-center justify-between">
                <span>Base rate</span>
                <span className="text-slate-200">{fallbackValue(fx.base_rate)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Execution rate</span>
                <span className="text-slate-200">{fallbackValue(fx.execution_rate)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Markup</span>
                <span className="text-slate-200">{fallbackValue(fx.markup)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Fee amount</span>
                <span className="text-slate-200">
                  {fx.fee_currency ? `${fx.fee_currency} ` : ''}
                  {fallbackValue(fx.fee_amount)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Amount after fee</span>
                <span className="text-slate-200">{fallbackValue(fx.amount_after_fee)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 print-surface">
          <h2 className="text-sm font-semibold text-slate-100 print-text">Timeline</h2>
          <div className="mt-4 space-y-3">
            {timeline.length === 0 && <p className="text-xs text-slate-400">No events recorded.</p>}
            {timeline.map((event, idx) => (
              <div key={`${event.label || 'event'}-${idx}`} className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-100 print-text">{event.label}</p>
                  {event.description ? <p className="text-xs text-slate-400 mt-1">{event.description}</p> : null}
                  <p className="text-xs text-slate-500 print-muted">
                    {event.occurred_at ? new Date(event.occurred_at).toLocaleString() : 'Not available'}
                  </p>
                </div>
                <span className="text-[11px] uppercase text-slate-400 print-muted">{event.status || 'pending'}</span>
              </div>
            ))}
          </div>
        </div>

        <details className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 text-sm text-slate-300 print-surface print-hidden">
          <summary className="cursor-pointer text-slate-100 font-semibold">Technical details</summary>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <span>Transaction ID</span>
              <span>{fallbackValue(receipt?.id)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Reference</span>
              <span>{fallbackValue(receipt?.reference || reference)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Idempotency key</span>
              <span>{fallbackValue(receipt?.idempotency_key)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Bill order</span>
              <span>{fallbackValue(linked?.bill_order_id)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Circle</span>
              <span>{fallbackValue(linked?.circle_id)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Circle transaction</span>
              <span>{fallbackValue(linked?.circle_transaction_id)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>FX quote token</span>
              <span>{fallbackValue(linked?.fx_quote_token)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Provider reference</span>
              <span>{fallbackValue(provider?.reference)}</span>
            </div>
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-3 print-hidden">
          <button
            type="button"
            onClick={copyReference}
            className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-200"
          >
            Copy reference
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl border border-slate-700 text-xs text-slate-300"
          >
            Print receipt
          </button>
          <button
            type="button"
            onClick={copyProviderReference}
            className="px-4 py-2 rounded-xl border border-slate-700 text-xs text-slate-300"
          >
            Copy provider ref
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 rounded-xl border border-slate-700 text-xs text-slate-300"
          >
            Back
          </button>
        </div>

        <div className="text-xs text-slate-500 text-center print-muted">
          System-generated receipt. No signature required.
        </div>
      </div>
    </div>
  )
}

export default Receipt

