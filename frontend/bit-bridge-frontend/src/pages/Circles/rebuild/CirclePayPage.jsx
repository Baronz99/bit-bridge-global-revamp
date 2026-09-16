import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getCirclePaymentItems, getCircleWorkspace } from '../../../api/circles'
import CircleShell from './CircleShell'
import PaymentCheckout from './PaymentCheckout'
import PaymentItemList from './PaymentItemList'
import {
  getCircleBucketLabel,
  getCircleRoleLabel,
  getCircleTitle,
  normalizePaymentItems,
} from './shared'

const CirclePayPage = () => {
  const { id } = useParams()
  const [workspace, setWorkspace] = useState(null)
  const [paymentItems, setPaymentItems] = useState([])
  const [selectedKey, setSelectedKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    Promise.all([getCircleWorkspace(id), getCirclePaymentItems(id)])
      .then(([workspaceResponse, itemResponse]) => {
        if (cancelled) return
        const items = normalizePaymentItems(itemResponse)
        setWorkspace(workspaceResponse?.data || {})
        setPaymentItems(items)
        setSelectedKey(String(items[0]?.key || items[0]?.id || ''))
      })
      .catch(() => {
        if (cancelled) return
        setError('Unable to load circle contribution options right now.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const selectedItem = useMemo(
    () => paymentItems.find((item) => String(item.key || item.id) === String(selectedKey || '')) || null,
    [paymentItems, selectedKey]
  )

  if (loading) {
    return <div className="px-6 py-10 text-sm text-slate-400">Loading contribution options...</div>
  }

  if (error || !workspace) {
    return <div className="px-6 py-10 text-sm text-rose-300">{error || 'Circle not found.'}</div>
  }

  return (
    <CircleShell
      circleId={id}
      title={getCircleTitle(workspace)}
      roleLabel={getCircleRoleLabel(workspace)}
      bucketLabel={getCircleBucketLabel(workspace)}
      active="pay"
    >
      <div className="rounded-[28px] border border-slate-900 bg-[#050b1b] px-5 py-5">
        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Contributions</p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          Select one contribution option and pay from your personal wallet.
        </h2>
      </div>
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <PaymentItemList
          items={paymentItems}
          selectedKey={selectedKey}
          onSelect={(item) => setSelectedKey(String(item.key || item.id || ''))}
        />
        <PaymentCheckout circleId={id} item={selectedItem} />
      </div>
    </CircleShell>
  )
}

export default CirclePayPage
