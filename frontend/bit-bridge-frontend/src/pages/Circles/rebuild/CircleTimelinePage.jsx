import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { exportCircleCsv, getCircleWorkspace } from '../../../api/circles'
import CircleShell from './CircleShell'
import TimelineFeed from './TimelineFeed'
import {
  getCircleBucketLabel,
  getCircleRoleLabel,
  getCircleTitle,
  getRecentRecords,
} from './shared'

const CircleTimelinePage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [workspace, setWorkspace] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    getCircleWorkspace(id)
      .then((workspaceResponse) => {
        if (cancelled) return
        setWorkspace(workspaceResponse?.data || {})
      })
      .catch(() => {
        if (cancelled) return
        setError('Unable to load this circle activity right now.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  const records = useMemo(() => getRecentRecords(workspace), [workspace])

  const handleExport = async () => {
    if (!id) return
    try {
      setExporting(true)
      const res = await exportCircleCsv(id)
      const blob = res?.data
      if (!blob) throw new Error('Missing export data.')
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `circle-${id}-timeline.csv`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      setError('Unable to export this audit right now.')
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return <div className="px-6 py-10 text-sm text-slate-400">Loading activity...</div>
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
      active="timeline"
    >
      <div className="rounded-[28px] border border-slate-900 bg-[#050b1b] px-5 py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Activity</p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Every dues payment, treasury contribution, collection contribution, approval, and treasury update in one place.
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate(`/dashboard/shared-groups/${id}/pay`)}
              className="rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Open Contributions
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold text-white transition hover:border-slate-600 disabled:text-slate-500"
            >
              {exporting ? 'Exporting...' : 'Export audit'}
            </button>
          </div>
        </div>
      </div>
      <TimelineFeed records={records} />
    </CircleShell>
  )
}

export default CircleTimelinePage
