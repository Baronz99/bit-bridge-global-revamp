import { useEffect, useMemo, useState } from 'react'
import client from '../../api/client'
import { toast } from 'react-toastify'

const PricingSpec = () => {
  const [spec, setSpec] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    client
      .get('/admin/pricing-spec')
      .then((res) => {
        if (!mounted) return
        setSpec(res?.data?.data || null)
      })
      .catch((error) => {
        if (!mounted) return
        toast(error?.response?.data?.message || 'Unable to load pricing spec', { type: 'error' })
      })
      .finally(() => {
        if (!mounted) return
        setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const jsonText = useMemo(() => JSON.stringify(spec || {}, null, 2), [spec])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonText)
      toast('Copied pricing spec', { type: 'success' })
    } catch {
      toast('Unable to copy', { type: 'error' })
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Admin</p>
          <h1 className="text-2xl md:text-3xl font-semibold">Fees & Pricing Spec</h1>
          <p className="text-sm text-slate-500 mt-2">
            Internal reference for live pricing configuration and formulas.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
          disabled={!spec}
        >
          Copy JSON
        </button>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
        {loading ? (
          <div className="text-slate-400 text-sm">Loading spec...</div>
        ) : spec ? (
          <pre className="text-xs text-slate-200 whitespace-pre-wrap">{jsonText}</pre>
        ) : (
          <div className="text-slate-400 text-sm">No pricing spec available.</div>
        )}
      </div>
    </div>
  )
}

export default PricingSpec
