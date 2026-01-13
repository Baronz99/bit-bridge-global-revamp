import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { toast } from 'react-toastify'
import client from '../../api/client'

const FxSettings = () => {
  const { user } = useSelector((state) => state.auth)
  const isSuperAdmin = user?.admin_role === 'super_admin' || user?.role === 'super_admin'
  const [baseRate, setBaseRate] = useState('')
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatedAt, setUpdatedAt] = useState('')
  const [bridgeProvider, setBridgeProvider] = useState(null)
  const [providerLoading, setProviderLoading] = useState(false)
  const [providerApplying, setProviderApplying] = useState(false)
  const [providerMessage, setProviderMessage] = useState('')
  const [providerError, setProviderError] = useState('')
  const [providerRetryAfter, setProviderRetryAfter] = useState(0)
  const [freeProvider, setFreeProvider] = useState(null)
  const [freeProviderLoading, setFreeProviderLoading] = useState(false)
  const [freeProviderApplying, setFreeProviderApplying] = useState(false)
  const [freeProviderMessage, setFreeProviderMessage] = useState('')
  const [freeProviderError, setFreeProviderError] = useState('')
  const [freeProviderRetryAfter, setFreeProviderRetryAfter] = useState(0)
  const [freeProviderCurrencies, setFreeProviderCurrencies] = useState(['EUR', 'GBP', 'CAD'])
  const [cardFees, setCardFees] = useState({
    creation_fee_usd: '',
    monthly_maintenance_fee_usd: '',
    funding_fee_bps: '',
    funding_fee_cap_usd: '',
    withdrawal_fee_bps: '',
    withdrawal_fee_cap_usd: '',
  })
  const [cardFeesSaving, setCardFeesSaving] = useState(false)

  const parsedRate = useMemo(() => Number(baseRate || 0), [baseRate])
  const canSave = Number.isFinite(parsedRate) && parsedRate >= 500 && parsedRate <= 5000

  const loadSettings = async () => {
    setLoading(true)
    try {
      const res = await client.get('/admin/fx-settings')
      const data = res?.data?.data || {}
      setBaseRate(String(data?.base_usd_ngn_rate ?? ''))
      setPreview(data?.previews || null)
      setUpdatedAt(data?.updated_at || '')
      setBridgeProvider(data?.bridgecard_provider || null)
      setFreeProvider(data?.provider || null)
      const fees = data?.card_fees || {}
      setCardFees({
        creation_fee_usd:
          fees?.creation_fee_usd !== undefined ? String(fees.creation_fee_usd) : '',
        monthly_maintenance_fee_usd:
          fees?.monthly_maintenance_fee_usd !== undefined
            ? String(fees.monthly_maintenance_fee_usd)
            : '',
        funding_fee_bps:
          fees?.funding_fee_bps !== undefined ? String(fees.funding_fee_bps) : '',
        funding_fee_cap_usd:
          fees?.funding_fee_cap_usd !== undefined ? String(fees.funding_fee_cap_usd) : '',
        withdrawal_fee_bps:
          fees?.withdrawal_fee_bps !== undefined ? String(fees.withdrawal_fee_bps) : '',
        withdrawal_fee_cap_usd:
          fees?.withdrawal_fee_cap_usd !== undefined ? String(fees.withdrawal_fee_cap_usd) : '',
      })
      setProviderRetryAfter(0)
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to load FX settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const res = await client.patch('/admin/fx-settings', {
        base_usd_ngn_rate: parsedRate,
      })
      const data = res?.data?.data || {}
      setBaseRate(String(data?.base_usd_ngn_rate ?? parsedRate))
      setPreview(data?.previews || null)
      setUpdatedAt(data?.updated_at || '')
      toast.success(res?.data?.message || 'FX settings updated')
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Unable to update FX settings')
    } finally {
      setSaving(false)
    }
  }

  const handleRefreshProvider = async () => {
    setProviderLoading(true)
    setProviderMessage('')
    setProviderError('')
    try {
      const res = await client.post('/admin/fx-settings/refresh-provider')
      const payload = res?.data || {}
      setBridgeProvider(payload?.data?.provider || null)
      setProviderMessage('Provider FX updated.')
      setProviderRetryAfter(0)
      toast.success('Provider FX updated.')
    } catch (error) {
      const message =
        error?.response?.data?.message || 'Unable to refresh provider FX'
      const retryAfter = Number(error?.response?.data?.retry_after_seconds || 0)
      setProviderError(message)
      if (error?.response?.status === 429) {
        const data = error?.response?.data?.data || {}
        setBridgeProvider(data?.provider || bridgeProvider || null)
        setProviderRetryAfter(retryAfter)
        const retryNote = retryAfter > 0 ? ` Try again in ${retryAfter}s.` : ''
        setProviderError(`${message}${retryNote}`)
        toast.info(`${message}${retryNote}`)
        setProviderLoading(false)
        return
      }
      toast.error(message)
    } finally {
      setProviderLoading(false)
    }
  }

  const handleApplyProvider = async () => {
    setProviderApplying(true)
    setProviderMessage('')
    setProviderError('')
    try {
      const res = await client.post('/admin/fx-settings/apply-provider')
      const payload = res?.data || {}
      const data = payload?.data || {}
      if (data?.base_usd_ngn_rate !== undefined) {
        setBaseRate(String(data.base_usd_ngn_rate))
      }
      setBridgeProvider(data?.provider || bridgeProvider || null)
      setProviderMessage('Provider rate applied to base.')
      setProviderRetryAfter(0)
      toast.success(payload?.message || 'Provider rate applied')
      await loadSettings()
    } catch (error) {
      const message =
        error?.response?.data?.message || 'Unable to apply provider FX'
      setProviderError(message)
      toast.error(message)
    } finally {
      setProviderApplying(false)
    }
  }

  const handleRefreshFreeProvider = async () => {
    setFreeProviderLoading(true)
    setFreeProviderMessage('')
    setFreeProviderError('')
    try {
      const res = await client.post('/admin/fx-settings/provider/refresh')
      const payload = res?.data || {}
      setFreeProvider(payload?.data?.provider || null)
      setFreeProviderMessage('Provider FX updated.')
      setFreeProviderRetryAfter(0)
      toast.success('Provider FX updated.')
    } catch (error) {
      const message =
        error?.response?.data?.message || 'Unable to refresh provider FX'
      const retryAfter = Number(error?.response?.data?.retry_after_seconds || 0)
      setFreeProviderError(message)
      if (error?.response?.status === 429) {
        const data = error?.response?.data?.data || {}
        setFreeProvider(data?.provider || freeProvider || null)
        setFreeProviderRetryAfter(retryAfter)
        const retryNote = retryAfter > 0 ? ` Try again in ${retryAfter}s.` : ''
        setFreeProviderError(`${message}${retryNote}`)
        toast.info(`${message}${retryNote}`)
        setFreeProviderLoading(false)
        return
      }
      toast.error(message)
    } finally {
      setFreeProviderLoading(false)
    }
  }

  const handleApplyFreeProvider = async (payload) => {
    setFreeProviderApplying(true)
    setFreeProviderMessage('')
    setFreeProviderError('')
    try {
      const res = await client.post('/admin/fx-settings/provider/apply', payload)
      const data = res?.data?.data || {}
      if (data?.base?.base_usd_ngn_rate !== undefined) {
        setBaseRate(String(data.base.base_usd_ngn_rate))
      }
      setFreeProvider(data?.provider || freeProvider || null)
      setFreeProviderMessage('Provider rate applied.')
      toast.success(res?.data?.message || 'Provider rate applied')
      await loadSettings()
    } catch (error) {
      const message =
        error?.response?.data?.message || 'Unable to apply provider FX'
      setFreeProviderError(message)
      toast.error(message)
    } finally {
      setFreeProviderApplying(false)
    }
  }

  const toggleFreeProviderCurrency = (code) => {
    setFreeProviderCurrencies((prev) => {
      if (prev.includes(code)) return prev.filter((item) => item !== code)
      return [...prev, code]
    })
  }

  const handleSaveCardFees = async () => {
    if (!isSuperAdmin) {
      toast.error('Only super admins can update card fees.')
      return
    }

    setCardFeesSaving(true)
    try {
      const payload = {
        card_creation_fee_usd_cents: Math.round(
          Number(cardFees.creation_fee_usd || 0) * 100
        ),
        card_monthly_maintenance_fee_usd_cents: Math.round(
          Number(cardFees.monthly_maintenance_fee_usd || 0) * 100
        ),
        card_funding_fee_bps: Number(cardFees.funding_fee_bps || 0),
        card_funding_fee_cap_usd_cents: Math.round(
          Number(cardFees.funding_fee_cap_usd || 0) * 100
        ),
        card_withdrawal_fee_bps: Number(cardFees.withdrawal_fee_bps || 0),
        card_withdrawal_fee_cap_usd_cents: Math.round(
          Number(cardFees.withdrawal_fee_cap_usd || 0) * 100
        ),
      }

      const res = await client.patch('/admin/fx-settings', payload)
      const data = res?.data?.data || {}
      const fees = data?.card_fees || {}
      setCardFees({
        creation_fee_usd:
          fees?.creation_fee_usd !== undefined ? String(fees.creation_fee_usd) : '',
        monthly_maintenance_fee_usd:
          fees?.monthly_maintenance_fee_usd !== undefined
            ? String(fees.monthly_maintenance_fee_usd)
            : '',
        funding_fee_bps:
          fees?.funding_fee_bps !== undefined ? String(fees.funding_fee_bps) : '',
        funding_fee_cap_usd:
          fees?.funding_fee_cap_usd !== undefined ? String(fees.funding_fee_cap_usd) : '',
        withdrawal_fee_bps:
          fees?.withdrawal_fee_bps !== undefined ? String(fees.withdrawal_fee_bps) : '',
        withdrawal_fee_cap_usd:
          fees?.withdrawal_fee_cap_usd !== undefined ? String(fees.withdrawal_fee_cap_usd) : '',
      })
      toast.success(res?.data?.message || 'Card fees updated')
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Unable to update card fees')
    } finally {
      setCardFeesSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Admin</p>
          <h1 className="text-2xl md:text-3xl font-semibold">FX settings</h1>
          <p className="text-sm text-slate-400 mt-1">
            Control the base USD/NGN rate used for Tunnel conversions.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Base USD/NGN rate</h2>
              <p className="text-xs text-slate-400 mt-1">
                Range 500-5000. Tiered markup + fee are applied automatically.
              </p>
            </div>
            <div className="text-xs text-slate-500">
              {updatedAt ? `Updated ${new Date(updatedAt).toLocaleString()}` : 'Updated recently'}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-4 items-end">
            <label className="block">
              <span className="text-xs text-slate-300">Base rate (NGN per USD)</span>
              <input
                type="number"
                min="500"
                max="5000"
                step="0.01"
                value={baseRate}
                onChange={(e) => setBaseRate(e.target.value)}
                disabled={loading}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                placeholder="1490.00"
              />
            </label>

            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave || saving || loading}
              className="rounded-xl bg-emerald-400 px-5 py-2 text-sm font-semibold text-black hover:bg-emerald-300 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save rate'}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Live pricing preview</h2>
          <p className="text-xs text-slate-400 mt-1">
            Preview for $25, $100, and $500 notional conversions (markup + ask/bid).
          </p>

          {loading ? (
            <p className="text-sm text-slate-500 mt-4">Loading preview...</p>
          ) : Array.isArray(preview) && preview.length ? (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              {preview.map((item) => (
                <div key={item.usd_notional} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                    ${Number(item.usd_notional || 0).toFixed(0)} notional
                  </p>
                  <p className="text-sm text-slate-400 mt-2">
                    Markup: NGN {Number(item.markup || 0).toFixed(2)}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    Ask: {Number(item.ask_rate || 0).toFixed(2)}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    Bid: {Number(item.bid_rate || 0).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 mt-4">No preview available.</p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Card fee settings</h2>
              <p className="text-xs text-slate-400 mt-1">
                Configure monthly maintenance, funding, and withdrawal fees (USD).
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs text-slate-300">Card creation fee (USD)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={cardFees.creation_fee_usd}
                onChange={(e) =>
                  setCardFees((prev) => ({
                    ...prev,
                    creation_fee_usd: e.target.value,
                  }))
                }
                disabled={!isSuperAdmin || loading}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-300">Monthly maintenance fee (USD)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={cardFees.monthly_maintenance_fee_usd}
                onChange={(e) =>
                  setCardFees((prev) => ({
                    ...prev,
                    monthly_maintenance_fee_usd: e.target.value,
                  }))
                }
                disabled={!isSuperAdmin || loading}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-300">Funding fee (bps)</span>
              <input
                type="number"
                min="0"
                step="1"
                value={cardFees.funding_fee_bps}
                onChange={(e) =>
                  setCardFees((prev) => ({ ...prev, funding_fee_bps: e.target.value }))
                }
                disabled={!isSuperAdmin || loading}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-300">Funding fee cap (USD)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={cardFees.funding_fee_cap_usd}
                onChange={(e) =>
                  setCardFees((prev) => ({ ...prev, funding_fee_cap_usd: e.target.value }))
                }
                disabled={!isSuperAdmin || loading}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-300">Withdrawal fee (bps)</span>
              <input
                type="number"
                min="0"
                step="1"
                value={cardFees.withdrawal_fee_bps}
                onChange={(e) =>
                  setCardFees((prev) => ({ ...prev, withdrawal_fee_bps: e.target.value }))
                }
                disabled={!isSuperAdmin || loading}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-300">Withdrawal fee cap (USD)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={cardFees.withdrawal_fee_cap_usd}
                onChange={(e) =>
                  setCardFees((prev) => ({ ...prev, withdrawal_fee_cap_usd: e.target.value }))
                }
                disabled={!isSuperAdmin || loading}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleSaveCardFees}
              disabled={!isSuperAdmin || cardFeesSaving || loading}
              className="rounded-xl bg-emerald-400 px-5 py-2 text-sm font-semibold text-black hover:bg-emerald-300 disabled:opacity-60"
            >
              {cardFeesSaving ? 'Saving...' : 'Save card fees'}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Provider FX feed</h2>
                {bridgeProvider?.computed_rate ? (
                  <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-200">
                    Live
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Bridgecard feed for USD/NGN. Preview only until applied.
              </p>
            </div>
            <div className="text-xs text-slate-500">
              {bridgeProvider?.as_of ? `As of ${new Date(bridgeProvider.as_of).toLocaleString()}` : 'Not refreshed yet'}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Computed rate</p>
              <p className="mt-2 text-lg font-semibold text-slate-100">
                {bridgeProvider?.computed_rate ? `${Number(bridgeProvider.computed_rate).toFixed(2)} per $1` : '--'}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Provider raw: {bridgeProvider?.raw ?? '--'}. We divide by {bridgeProvider?.divisor ?? '--'} to compute NGN per USD.
              </p>
              <p className="mt-1 text-xs text-slate-500">Source: {bridgeProvider?.source || 'bridgecard'}</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Actions</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleRefreshProvider}
                  disabled={providerLoading || loading || providerRetryAfter > 0}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-60"
                >
                  {providerLoading ? 'Refreshing...' : 'Refresh'}
                </button>
                <button
                  type="button"
                  onClick={handleApplyProvider}
                  disabled={!bridgeProvider?.computed_rate || providerApplying || loading}
                  className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-black hover:bg-emerald-300 disabled:opacity-60"
                >
                  {providerApplying ? 'Applying...' : 'Apply to Base Rate'}
                </button>
              </div>
              {providerMessage ? (
                <p className="mt-3 text-xs text-emerald-300">{providerMessage}</p>
              ) : null}
              {providerError ? (
                <p className="mt-3 text-xs text-red-400">{providerError}</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Provider FX feed (Free)</h2>
                {freeProvider?.updated_at && !freeProvider?.error ? (
                  <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-200">
                    Live
                  </span>
                ) : null}
                {freeProvider?.stale ? (
                  <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-amber-200">
                    Stale
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                ExchangeRate-API (USD base) - public feed. Apply copies values into BitBridge base rates.
              </p>
            </div>
            <div className="text-xs text-slate-500">
              {freeProvider?.updated_at
                ? `Updated ${new Date(freeProvider.updated_at).toLocaleString()}`
                : 'Not refreshed yet'}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Computed NGN per $1</p>
              <p className="mt-2 text-lg font-semibold text-slate-100">
                {freeProvider?.computed_ngn_per_usd
                  ? `${Number(freeProvider.computed_ngn_per_usd).toFixed(2)} per $1`
                  : '--'}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Provider raw: {freeProvider?.rates_preview?.NGN ?? '--'}. We use it as NGN per USD.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Base: {freeProvider?.base || 'USD'} | Source: {freeProvider?.source || 'exchangerate_api'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Actions</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleRefreshFreeProvider}
                  disabled={freeProviderLoading || loading || freeProviderRetryAfter > 0}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-60"
                >
                  {freeProviderLoading ? 'Refreshing...' : 'Refresh'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleApplyFreeProvider({ apply: { ngn_to_usd_base: true, currencies: [] } })
                  }
                  disabled={!freeProvider?.computed_ngn_per_usd || freeProviderApplying || loading || freeProvider?.stale}
                  className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-black hover:bg-emerald-300 disabled:opacity-60"
                >
                  {freeProviderApplying ? 'Applying...' : 'Apply NGN to Base'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleApplyFreeProvider({
                      apply: { ngn_to_usd_base: false, currencies: freeProviderCurrencies },
                    })
                  }
                  disabled={!freeProvider?.rates_preview || freeProviderApplying || loading || freeProvider?.stale}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-60"
                >
                  Apply Major FX
                </button>
              </div>
              {freeProvider?.stale ? (
                <p className="mt-2 text-[11px] text-amber-200">Refresh to enable apply.</p>
              ) : null}
              {freeProviderMessage ? (
                <p className="mt-3 text-xs text-emerald-300">{freeProviderMessage}</p>
              ) : null}
              {freeProviderError ? (
                <p className="mt-3 text-xs text-red-400">{freeProviderError}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300">
            {freeProvider?.rates_preview
              ? Object.entries(freeProvider.rates_preview).map(([code, value]) => {
                  const derived =
                    value && Number(value) > 0 ? (1 / Number(value)).toFixed(4) : null
                  return (
                    <span
                      key={code}
                      className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1"
                    >
                      1 USD = {Number(value).toFixed(4)} {code}
                      {derived ? ` | 1 ${code} = ${derived} USD` : ''}
                    </span>
                  )
                })
              : (
                <span className="text-slate-500">No rates preview yet.</span>
              )}
          </div>

          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Apply currencies</p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-300">
              {['EUR', 'GBP', 'CAD', 'GHS', 'KES', 'ZAR', 'JPY'].map((code) => (
                <label key={code} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={freeProviderCurrencies.includes(code)}
                    onChange={() => toggleFreeProviderCurrency(code)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-400"
                  />
                  <span>{code}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FxSettings
