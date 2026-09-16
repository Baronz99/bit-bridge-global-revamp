import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { PiArrowRightBold, PiGameControllerBold } from 'react-icons/pi'

import {
  createMonnifyBettingIntent,
  executeMonnifyBettingIntent,
  getMonnifyBettingCatalog,
} from '../../../../api/monnify'
import nairaFormat from '../../../../utils/nairaFormat'

const fmtAmount = (value) => {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount) || amount <= 0) return 'Open amount'
  return nairaFormat(amount, 'ngn')
}

const BettingPage = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [restrictionReason, setRestrictionReason] = useState('')
  const [catalogItems, setCatalogItems] = useState([])
  const [form, setForm] = useState({
    biller_code: '',
    product_code: '',
    customer_identifier: '',
    customer_name: '',
    amount: '',
  })

  useEffect(() => {
    let active = true

    const loadCatalog = async () => {
      setLoading(true)
      try {
        const response = await getMonnifyBettingCatalog()
        if (!active) return

        const data = response?.data?.data || {}
        const items = Array.isArray(data?.items) ? data.items : []
        setCatalogItems(items)
        setRestrictionReason(data?.restriction_reason || '')

        if (items[0]) {
          setForm((prev) => ({
            ...prev,
            biller_code: items[0].biller_code || '',
            product_code: items[0].product_code || '',
            amount: items[0].amount ? String(items[0].amount) : prev.amount,
          }))
        }
      } catch (error) {
        if (!active) return
        setCatalogItems([])
        setRestrictionReason('')
        toast.error(error?.response?.data?.message || 'Unable to load Monnify betting services.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadCatalog()

    return () => {
      active = false
    }
  }, [])

  const billers = useMemo(() => {
    const map = new Map()
    catalogItems.forEach((item) => {
      const key = String(item?.biller_code || '').trim()
      if (!key || map.has(key)) return
      map.set(key, {
        biller_code: key,
        biller_name: item?.biller_name || key,
      })
    })
    return Array.from(map.values())
  }, [catalogItems])

  const products = useMemo(() => {
    return catalogItems.filter(
      (item) =>
        String(item?.biller_code || '').trim().toUpperCase() ===
        String(form.biller_code || '').trim().toUpperCase()
    )
  }, [catalogItems, form.biller_code])

  const selectedProduct = useMemo(() => {
    return (
      products.find(
        (item) =>
          String(item?.product_code || '').trim().toUpperCase() ===
          String(form.product_code || '').trim().toUpperCase()
      ) || null
    )
  }, [products, form.product_code])

  useEffect(() => {
    if (!products.length) return

    const stillValid = products.some(
      (item) =>
        String(item?.product_code || '').trim().toUpperCase() ===
        String(form.product_code || '').trim().toUpperCase()
    )

    if (!stillValid) {
      setForm((prev) => ({
        ...prev,
        product_code: products[0].product_code || '',
        amount: products[0].amount ? String(products[0].amount) : prev.amount,
      }))
    }
  }, [products, form.product_code])

  useEffect(() => {
    if (!selectedProduct?.amount) return
    setForm((prev) => ({ ...prev, amount: String(selectedProduct.amount) }))
  }, [selectedProduct?.amount])

  const onChange = (key) => (event) => {
    const value = event.target.value
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const submit = async (event) => {
    event.preventDefault()
    setSubmitting(true)

    try {
      const createResponse = await createMonnifyBettingIntent({
        biller_code: form.biller_code,
        product_code: form.product_code,
        customer_identifier: form.customer_identifier,
        customer_name: form.customer_name,
        amount: form.amount,
      })

      const createData = createResponse?.data || {}
      const intentId = createData?.data?.bill_payment_intent?.id
      const billOrderId = createData?.data?.bill_order?.id

      if (!intentId || !billOrderId) {
        throw new Error('Betting intent was created without the required references.')
      }

      const executeResponse = await executeMonnifyBettingIntent(intentId)
      const executeData = executeResponse?.data || {}
      const resolvedBillOrderId = executeData?.bill_order_id || billOrderId

      toast.success(
        executeData?.message ||
          createData?.message ||
          'Betting payment submitted. Tracking receipt opened.'
      )
      navigate(`/dashboard/receipt/${encodeURIComponent(`bill-${resolvedBillOrderId}`)}`)
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Unable to submit betting payment.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full px-4 md:px-6 py-4 space-y-6 text-slate-100">
      <section className="rounded-3xl border border-slate-800 bg-slate-900/85 p-5 md:p-6 shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
        <div className="max-w-3xl">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
            <PiGameControllerBold className="text-xl" />
          </div>
          <h1 className="mt-4 text-2xl md:text-3xl font-semibold text-white">Monnify betting payments</h1>
          <p className="mt-2 text-sm text-slate-400">
            Pick a supported betting biller, enter the player identifier, and submit the payment from your wallet.
          </p>
        </div>
      </section>

      {loading ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-400">
          Loading betting services...
        </div>
      ) : null}

      {!loading && catalogItems.length === 0 ? (
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-amber-100">
          {restrictionReason
            ? `Betting services are currently unavailable: ${restrictionReason}.`
            : 'No Monnify betting services are currently available.'}
        </div>
      ) : null}

      {!loading && catalogItems.length > 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)] gap-5">
          <form
            onSubmit={submit}
            className="rounded-3xl border border-slate-800 bg-slate-900/85 p-5 md:p-6 space-y-5 shadow-[0_16px_32px_rgba(15,23,42,0.18)]"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="space-y-2">
                <span className="text-sm text-slate-300">Biller</span>
                <select
                  value={form.biller_code}
                  onChange={onChange('biller_code')}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
                  required
                >
                  {billers.map((item) => (
                    <option key={item.biller_code} value={item.biller_code}>
                      {item.biller_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm text-slate-300">Product</span>
                <select
                  value={form.product_code}
                  onChange={onChange('product_code')}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
                  required
                >
                  {products.map((item) => (
                    <option key={item.product_code} value={item.product_code}>
                      {item.product_name || item.product_code}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm text-slate-300">Player ID / account reference</span>
                <input
                  value={form.customer_identifier}
                  onChange={onChange('customer_identifier')}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
                  placeholder="e.g. player-123"
                  required
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm text-slate-300">Customer name</span>
                <input
                  value={form.customer_name}
                  onChange={onChange('customer_name')}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
                  placeholder="Optional display name"
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm text-slate-300">Amount</span>
                <input
                  value={form.amount}
                  onChange={onChange('amount')}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
                  placeholder="Enter amount"
                  inputMode="decimal"
                  required
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? 'Submitting...' : 'Pay with wallet'}
              <PiArrowRightBold />
            </button>
          </form>

          <aside className="rounded-3xl border border-slate-800 bg-slate-900/75 p-5 md:p-6 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Selection</p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                {selectedProduct?.product_name || 'Choose a product'}
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                {selectedProduct?.biller_name || 'A supported Monnify betting biller'}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">Suggested amount</span>
                <span className="text-white">{fmtAmount(selectedProduct?.amount)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">Minimum</span>
                <span className="text-white">{fmtAmount(selectedProduct?.min_amount)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">Maximum</span>
                <span className="text-white">{fmtAmount(selectedProduct?.max_amount)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">Provider</span>
                <span className="text-white">Monnify</span>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              After submission, the app opens the canonical receipt/tracking screen using your generated bill order reference.
            </p>
          </aside>
        </div>
      ) : null}
    </div>
  )
}

export default BettingPage
