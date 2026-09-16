import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { fundCircle, quoteCircleDuePlan } from '../../../api/circles'
import {
  formatCadenceLabel,
  formatDateLabel,
  formatMoney,
  formatPeriodCountLabel,
  getPaymentItemAmountLabel,
  getPaymentItemCallToAction,
  getPaymentItemCheckoutMode,
  getPaymentItemTypeLabel,
  getPaymentItemTitleLabel,
  getPaymentPurposeLabel,
  getReceiptRoute,
} from './shared'

const PaymentCheckout = ({ circleId, item }) => {
  const wallet = useSelector((state) => state.wallet?.data?.bridge || null)
  const walletLoading = useSelector((state) => Boolean(state.wallet?.loading))
  const checkoutMode = getPaymentItemCheckoutMode(item)
  const isDueItem =
    item?.linked_reference_type === 'CircleDuePlan' ||
    String(item?.type || '').toLowerCase() === 'dues' ||
    checkoutMode === 'recurring'
  const isQuantityItem = checkoutMode === 'quantity'
  const recurringPeriods = [1, 3, 6, 12].filter((value) => value <= Math.max(Number(item?.payable_periods_count || 1), value))
  const [periods, setPeriods] = useState(1)
  const [quantity, setQuantity] = useState(1)
  const [amount, setAmount] = useState(item?.amount_cents ? String(Number(item.amount_cents) / 100) : '')
  const [note, setNote] = useState('')
  const [selectedSource, setSelectedSource] = useState('personal_wallet')
  const [transactionPin, setTransactionPin] = useState('')
  const [pinStepOpen, setPinStepOpen] = useState(false)
  const [quote, setQuote] = useState(null)
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    if (!item) return
    setError('')
    setSuccess(null)
    setTransactionPin('')
    setNote('')
    setSelectedSource('personal_wallet')
    setPinStepOpen(false)
    setPeriods(1)
    setQuantity(1)
    if (item?.amount_cents) {
      setAmount(String(Number(item.amount_cents) / 100))
    } else if (item?.unit_price_cents && isQuantityItem) {
      setAmount(String(Number(item.unit_price_cents) / 100))
    } else {
      setAmount('')
    }
  }, [item, isQuantityItem])

  useEffect(() => {
    if (!circleId || !item || !isDueItem || item?.is_payable_now === false) {
      setQuote(null)
      return
    }
    let cancelled = false
    setLoadingQuote(true)
    quoteCircleDuePlan(circleId, { periods_count: periods })
      .then((response) => {
        if (cancelled) return
        const payload = response?.data ?? response
        setQuote(payload?.data ?? payload)
      })
      .catch(() => {
        if (!cancelled) setQuote(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingQuote(false)
      })
    return () => {
      cancelled = true
    }
  }, [circleId, item, periods, isDueItem])

  const amountCents = useMemo(() => {
    if (isDueItem && quote?.total_amount_cents) return Number(quote.total_amount_cents)
    if (isQuantityItem) {
      const unitPriceCents = Number(item?.unit_price_cents || item?.amount_cents || item?.suggested_amount_cents || 0)
      return Math.max(unitPriceCents, 0) * Math.max(Number(quantity || 1), 1)
    }
    const normalized = Number(String(amount).replace(/,/g, '').trim())
    return Number.isFinite(normalized) ? Math.round(normalized * 100) : 0
  }, [amount, isDueItem, isQuantityItem, item, quantity, quote])

  const payable = item?.is_payable_now !== false
  const receiptRoute = success ? getReceiptRoute(success) : null
  const walletBalanceAmount = Number(wallet?.available_balance ?? wallet?.balance ?? 0)
  const walletBalanceLabel = walletLoading
    ? 'Loading...'
    : wallet
      ? formatMoney(Math.max(walletBalanceAmount, 0) * 100)
      : '--'
  const sourceOptions = [
    {
      value: 'personal_wallet',
      label: walletLoading
        ? 'Personal wallet'
        : wallet
          ? `Personal wallet · ${walletBalanceLabel} available`
          : 'Personal wallet',
    },
  ]
  const selectedSourceLabel = sourceOptions.find((option) => option.value === selectedSource)?.label || 'Personal wallet'
  const purposeLabel = getPaymentPurposeLabel(item)
  const typeLabel = getPaymentItemTypeLabel(item)
  const duePeriodsLabel = formatPeriodCountLabel(periods, item?.cadence)
  const cadenceLabel = formatCadenceLabel(item?.cadence)
  const ctaLabel = getPaymentItemCallToAction(item, {
    quantity: isDueItem ? periods : isQuantityItem ? quantity : 0,
  })

  const handleSubmit = async () => {
    if (!circleId || !item) return
    if (!payable) return
    if (!amountCents || amountCents <= 0) {
      setError('Enter a valid amount.')
      return
    }
    if (isQuantityItem && (!quantity || Number(quantity) <= 0)) {
      setError('Enter a valid quantity.')
      return
    }
    if (!transactionPin.trim()) {
      setError('Transaction PIN is required.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const payload = {
        amount_cents: amountCents,
        note: note.trim() || undefined,
        circle_due_obligation_ids: isDueItem ? quote?.obligation_ids || undefined : undefined,
        circle_activity_id:
          item?.linked_reference_type === 'CircleActivity' ? item?.linked_reference_id : undefined,
        payment_purpose:
          item?.type === 'activity_goal'
            ? 'activity_goal'
            : item?.type === 'treasury_topup'
              ? 'treasury_topup'
              : isDueItem
                ? 'dues'
                : undefined,
        payment_item_title: item?.title || undefined,
        payment_item_quantity: isQuantityItem ? Number(quantity) : undefined,
        payment_item_unit_price_cents:
          isQuantityItem ? Number(item?.unit_price_cents || item?.amount_cents || item?.suggested_amount_cents || 0) : undefined,
        transaction_pin: transactionPin.trim(),
      }
      const response = await fundCircle(circleId, payload)
      const root = response?.data ?? response
      setSuccess(root?.data || root)
      setAmount('')
      setTransactionPin('')
      setNote('')
    } catch (requestError) {
      const message =
        requestError?.response?.data?.message ||
        requestError?.message ||
        'Unable to complete this circle payment.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleStartPay = () => {
    if (!payable) return
    if (!selectedSource) {
      setError('Select a source account.')
      return
    }
    if (!amountCents || amountCents <= 0) {
      setError('Enter a valid amount.')
      return
    }
    if (isQuantityItem && (!quantity || Number(quantity) <= 0)) {
      setError('Enter a valid quantity.')
      return
    }
    setError('')
    setPinStepOpen(true)
  }

  if (!item) {
    return (
      <section className="rounded-[28px] border border-slate-900 bg-[#050b1b] px-5 py-5 text-sm text-slate-400">
        Choose a contribution option to continue.
      </section>
    )
  }

  return (
    <section className="rounded-[28px] border border-slate-900 bg-[#050b1b] px-5 py-5">
      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Contribution checkout</p>
      <h2 className="mt-2 text-xl font-semibold text-white">{getPaymentItemTitleLabel(item)}</h2>
      <p className="mt-2 text-sm text-slate-400">
        {isDueItem
          ? `${cadenceLabel} Dues plan`
          : `${typeLabel} for this circle`}
      </p>
      <div className="mt-4 space-y-4">
        <div className="rounded-2xl border border-slate-900 bg-slate-950/60 px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Contribution type</span>
            <span className="text-sm font-medium text-white">{typeLabel}</span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-slate-400">Amount</span>
            <span className="text-sm font-medium text-white">{getPaymentItemAmountLabel(item)}</span>
          </div>
          {item?.due_on ? (
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-slate-400">Due</span>
              <span className="text-sm font-medium text-white">{formatDateLabel(item.due_on)}</span>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-900 bg-slate-950/60 px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Pay from</p>
              <label className="mt-2 block text-sm font-medium text-white">
                Source account
                <select
                  value={selectedSource}
                  onChange={(event) => setSelectedSource(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none"
                >
                  {sourceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold text-white">{walletBalanceLabel}</p>
              <p className="mt-1 text-xs text-slate-500">Debited instantly</p>
            </div>
          </div>
        </div>

        {isDueItem ? (
          <div className="rounded-2xl border border-slate-900 bg-slate-950/60 px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Dues period</p>
                <p className="mt-2 text-sm text-slate-300">Choose how many {cadenceLabel.toLowerCase()}s to cover now.</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">{cadenceLabel} rate</p>
                <p className="text-sm font-medium text-white">{getPaymentItemAmountLabel(item)}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {recurringPeriods.map((value) => {
                const active = Number(periods) === Number(value)
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPeriods(value)}
                    disabled={!payable}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      active
                        ? 'border-cyan-400 bg-cyan-500/15 text-cyan-100'
                        : 'border-slate-800 bg-slate-950 text-slate-200 hover:border-slate-600'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {formatPeriodCountLabel(value, item?.cadence)}
                  </button>
                )
              })}
            </div>
            <label className="mt-4 block">
              <span className="mb-2 block text-sm text-slate-300">Or choose a custom number of {cadenceLabel.toLowerCase()}s</span>
              <select
                value={periods}
                onChange={(event) => setPeriods(Number(event.target.value))}
                className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none"
                disabled={!payable}
              >
                {Array.from({ length: Math.max(Number(item?.payable_periods_count || 1), 1) }, (_, index) => (
                  <option key={index + 1} value={index + 1}>
                    {formatPeriodCountLabel(index + 1, item?.cadence)}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-slate-400">Total</span>
              <span className="font-medium text-white">{loadingQuote ? 'Calculating...' : formatMoney(amountCents)}</span>
            </div>
          </div>
        ) : isQuantityItem ? (
          <div className="rounded-2xl border border-slate-900 bg-slate-950/60 px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="block text-sm text-slate-300">Quantity</span>
                <span className="mt-1 block text-xs text-slate-500">
                  {getPaymentItemAmountLabel(item)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                  className="h-10 w-10 rounded-full border border-slate-800 bg-slate-950 text-lg font-semibold text-white"
                >
                  -
                </button>
                <div className="min-w-[3rem] text-center text-2xl font-semibold text-white">{quantity}</div>
                <button
                  type="button"
                  onClick={() => setQuantity((current) => current + 1)}
                  className="h-10 w-10 rounded-full border border-slate-800 bg-slate-950 text-lg font-semibold text-white"
                >
                  +
                </button>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-slate-400">Unit price</span>
              <span className="font-medium text-white">
                {formatMoney(Number(item?.unit_price_cents || item?.amount_cents || item?.suggested_amount_cents || 0))}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-slate-400">Total</span>
              <span className="font-medium text-white">{formatMoney(amountCents)}</span>
            </div>
          </div>
        ) : checkoutMode === 'fixed' ? (
          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Amount</span>
            <input
              value={amount}
              readOnly
              className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none"
            />
          </label>
        ) : (
          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Amount</span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none"
              disabled={!payable}
            />
          </label>
        )}

        <label className="block">
          <span className="mb-2 block text-sm text-slate-300">Note</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none"
            disabled={!payable}
          />
        </label>

        <div className="rounded-2xl border border-slate-900 bg-slate-950/60 px-4 py-4">
          <p className="text-sm font-medium text-white">Review</p>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-slate-400">Contribution type</span>
            <span className="font-medium text-white">{typeLabel}</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-slate-400">Wallet debit</span>
            <span className="font-medium text-white">
              {loadingQuote ? 'Calculating...' : formatMoney(amountCents)}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-slate-400">Circle credit</span>
            <span className="font-medium text-white">
              {loadingQuote ? 'Calculating...' : formatMoney(amountCents)}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-slate-400">Source</span>
            <span className="font-medium text-white">{selectedSourceLabel}</span>
          </div>
          {isDueItem ? (
            <>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-slate-400">Frequency</span>
                <span className="font-medium text-white">{cadenceLabel}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-slate-400">Periods</span>
                <span className="font-medium text-white">{duePeriodsLabel}</span>
              </div>
            </>
          ) : null}
          {isQuantityItem ? (
            <>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-slate-400">Quantity</span>
                <span className="font-medium text-white">{quantity}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-slate-400">Unit price</span>
                <span className="font-medium text-white">
                  {formatMoney(Number(item?.unit_price_cents || item?.amount_cents || item?.suggested_amount_cents || 0))}
                </span>
              </div>
            </>
          ) : null}
          {isDueItem && quote?.paid_through_label ? (
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-slate-400">Paid through</span>
              <span className="font-medium text-white">{quote.paid_through_label}</span>
            </div>
          ) : null}
          {purposeLabel === 'treasury contribution' ? (
            <p className="mt-3 text-xs text-slate-500">This adds money to the shared circle treasury.</p>
          ) : null}
        </div>

        {payable ? (
          <label className={pinStepOpen ? 'block' : 'hidden'}>
            <span className="mb-2 block text-sm text-slate-300">Confirm with PIN</span>
            <input
              type="password"
              value={transactionPin}
              onChange={(event) => setTransactionPin(event.target.value)}
              className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none"
            />
          </label>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4 text-sm text-slate-400">
            This item is configured, but there is nothing payable for you right now.
          </div>
        )}

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {success ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-200">
            Contribution complete.
            {receiptRoute ? (
              <Link to={receiptRoute} className="ml-2 font-semibold text-emerald-100 underline">
                View proof
              </Link>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          onClick={pinStepOpen ? handleSubmit : handleStartPay}
          disabled={!payable || submitting}
          className="w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
        >
          {submitting ? 'Processing...' : pinStepOpen ? ctaLabel : ctaLabel}
        </button>
      </div>
    </section>
  )
}

export default PaymentCheckout
