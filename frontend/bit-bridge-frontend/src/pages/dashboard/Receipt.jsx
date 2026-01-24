import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import ShadowValue from '../../components/ShadowValue'
import nairaFormat from '../../utils/nairaFormat'
import { getReceipt } from '../../api/receipts'

const usdFormat = (n) => {
  const value = Number(n || 0)
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatAmount = (amount, currency) => {
  if (!currency || currency.toUpperCase() === 'NGN') return nairaFormat(amount, 'ngn')
  if (currency.toUpperCase() === 'USD') return `USD ${usdFormat(amount)}`
  return `${currency.toUpperCase()} ${usdFormat(amount)}`
}

const Receipt = () => {
  const { reference } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [receipt, setReceipt] = useState(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      try {
        const res = await getReceipt(reference)
        if (!active) return
        setReceipt(res?.data?.data || null)
      } catch (error) {
        if (!active) return
        toast.error(error?.response?.data?.message || 'Unable to load receipt.')
        setReceipt(null)
      } finally {
        if (!active) return
        setLoading(false)
      }
    }
    if (reference) load()
    return () => {
      active = false
    }
  }, [reference])

  const title = receipt?.description || 'Transaction receipt'
  const createdAt = receipt?.created_at ? new Date(receipt.created_at).toLocaleString() : '--'
  const currency = receipt?.currency || 'NGN'
  const amount = receipt?.amount || 0

  const breakdown = useMemo(() => receipt?.breakdown || {}, [receipt])
  const fx = useMemo(() => receipt?.fx || null, [receipt])

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(String(receipt?.reference || reference))
      toast.success('Reference copied.')
    } catch {
      toast.info(receipt?.reference || reference || '')
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
      <div className="max-w-2xl mx-auto">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold">Receipt</h1>
          <p className="text-xs text-slate-400 mt-1">Transaction summary</p>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-semibold">{title}</p>
              <p className="text-xs text-slate-500 mt-1">{createdAt}</p>
            </div>
            <span className="text-[11px] uppercase tracking-widest text-slate-400">
              {receipt?.status || 'pending'}
            </span>
          </div>

          <div className="mt-6 text-3xl font-semibold">
            <ShadowValue>{formatAmount(amount, currency)}</ShadowValue>
          </div>

          <div className="mt-6 space-y-3 text-sm text-slate-300">
            <div className="flex items-center justify-between">
              <span>Reference</span>
              <span className="text-slate-100">{receipt?.reference || reference}</span>
            </div>
            {receipt?.provider && (
              <div className="flex items-center justify-between">
                <span>Provider</span>
                <span className="text-slate-100 capitalize">{receipt.provider}</span>
              </div>
            )}
            {receipt?.transfer_reference && (
              <div className="flex items-center justify-between">
                <span>Transfer ref</span>
                <span className="text-slate-100">{receipt.transfer_reference}</span>
              </div>
            )}
            {receipt?.transaction_reference && (
              <div className="flex items-center justify-between">
                <span>Payment ref</span>
                <span className="text-slate-100">{receipt.transaction_reference}</span>
              </div>
            )}
            {receipt?.recipient && (
              <div className="flex items-center justify-between">
                <span>Recipient</span>
                <span className="text-slate-100">{receipt.recipient}</span>
              </div>
            )}
          </div>

          {Object.keys(breakdown).length > 0 && (
            <div className="mt-6 border-t border-slate-800 pt-4 space-y-2 text-xs text-slate-400">
              {breakdown.principal_usd !== undefined && (
                <div className="flex items-center justify-between">
                  <span>Principal</span>
                  <span className="text-slate-200">USD {usdFormat(breakdown.principal_usd)}</span>
                </div>
              )}
              {breakdown.provider_fee_usd !== undefined && (
                <div className="flex items-center justify-between">
                  <span>Provider fee</span>
                  <span className="text-slate-200">USD {usdFormat(breakdown.provider_fee_usd)}</span>
                </div>
              )}
              {breakdown.bitbridge_fee_usd !== undefined && (
                <div className="flex items-center justify-between">
                  <span>BitBridge fee</span>
                  <span className="text-slate-200">USD {usdFormat(breakdown.bitbridge_fee_usd)}</span>
                </div>
              )}
              {breakdown.fx_markup_usd !== undefined && (
                <div className="flex items-center justify-between">
                  <span>FX markup</span>
                  <span className="text-slate-200">USD {usdFormat(breakdown.fx_markup_usd)}</span>
                </div>
              )}
              {breakdown.total_debit_usd !== undefined && (
                <div className="flex items-center justify-between text-slate-200 font-semibold">
                  <span>Total debit</span>
                  <span>USD {usdFormat(breakdown.total_debit_usd)}</span>
                </div>
              )}
              {breakdown.total_credit_usd !== undefined && (
                <div className="flex items-center justify-between text-slate-200 font-semibold">
                  <span>Total credit</span>
                  <span>USD {usdFormat(breakdown.total_credit_usd)}</span>
                </div>
              )}
            </div>
          )}

          {fx && (
            <div className="mt-6 border-t border-slate-800 pt-4 space-y-2 text-xs text-slate-400">
              {fx.merchant_currency && fx.merchant_amount && (
                <div className="flex items-center justify-between">
                  <span>Merchant amount</span>
                  <span className="text-slate-200">
                    {fx.merchant_amount} {fx.merchant_currency}
                  </span>
                </div>
              )}
              {fx.billing_currency && fx.billing_amount && (
                <div className="flex items-center justify-between">
                  <span>Billing amount</span>
                  <span className="text-slate-200">
                    {fx.billing_amount} {fx.billing_currency}
                  </span>
                </div>
              )}
              {fx.fx_implied_rate && (
                <div className="flex items-center justify-between">
                  <span>Implied FX rate</span>
                  <span className="text-slate-200">{Number(fx.fx_implied_rate).toFixed(4)}</span>
                </div>
              )}
              {fx.fx_reference_rate && (
                <div className="flex items-center justify-between">
                  <span>Reference FX rate</span>
                  <span className="text-slate-200">{Number(fx.fx_reference_rate).toFixed(4)}</span>
                </div>
              )}
              {fx.fx_margin_usd !== undefined && (
                <div className="flex items-center justify-between">
                  <span>FX margin (USD)</span>
                  <span className="text-slate-200">USD {usdFormat(fx.fx_margin_usd)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={copyReference}
            className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-200"
          >
            Copy reference
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 rounded-xl border border-slate-700 text-xs text-slate-300"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  )
}

export default Receipt
