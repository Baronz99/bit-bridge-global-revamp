import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { toast } from 'react-toastify'
import { createCircle, getCircles } from '../../api/circles'
import { getAdminCircleContributors } from '../../api/adminCircles'
import nairaFormat from '../../utils/nairaFormat'

const DEFAULT_FORM = {
  name: 'BitBridge Founders Circle',
  purpose: 'Founders campaign',
  description:
    'Early supporters contributing to the BitBridge Founders Circle pilot campaign.',
  badge_label: 'Founders Circle',
  visibility: 'official_featured',
  kyc_mode: 'flexible',
  max_contribution_cents: '5000000',
}

const formatCapPreview = (value) => {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount) || amount <= 0) return 'No Tier 1 cap'
  return nairaFormat(amount / 100)
}

const formatDateTime = (value) => {
  if (!value) return 'N/A'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'N/A'
  return parsed.toLocaleString()
}

const OfficialCircles = () => {
  const [officialCircles, setOfficialCircles] = useState([])
  const [selectedCircleId, setSelectedCircleId] = useState('')
  const [contributors, setContributors] = useState([])
  const [contributorsMeta, setContributorsMeta] = useState(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [contributorsLoading, setContributorsLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [contributorsError, setContributorsError] = useState('')
  const [form, setForm] = useState(DEFAULT_FORM)

  const selectedCircle = useMemo(
    () => officialCircles.find((circle) => String(circle.id) === String(selectedCircleId)) || null,
    [officialCircles, selectedCircleId]
  )

  const loadOfficialCircles = async (preferredCircleId = null) => {
    setPageLoading(true)
    setLoadError('')

    try {
      const res = await getCircles()
      const data = Array.isArray(res?.data) ? res.data : []
      const circles = data.filter((circle) => circle?.circle_type === 'official')

      setOfficialCircles(circles)

      const foundersCircle =
        circles.find((circle) => circle?.name === DEFAULT_FORM.name) ||
        circles.find((circle) => circle?.badge_label === DEFAULT_FORM.badge_label) ||
        circles[0] ||
        null

      const nextCircleId =
        preferredCircleId ||
        selectedCircleId ||
        foundersCircle?.id ||
        ''

      setSelectedCircleId(nextCircleId ? String(nextCircleId) : '')
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        'Unable to load official circles.'
      setLoadError(message)
      setOfficialCircles([])
      setSelectedCircleId('')
    } finally {
      setPageLoading(false)
    }
  }

  useEffect(() => {
    loadOfficialCircles()
  }, [])

  useEffect(() => {
    if (!selectedCircleId) {
      setContributors([])
      setContributorsMeta(null)
      setContributorsError('')
      return
    }

    let active = true

    const loadContributors = async () => {
      setContributorsLoading(true)
      setContributorsError('')

      try {
        const res = await getAdminCircleContributors(selectedCircleId)
        if (!active) return
        const data = res?.data?.data || {}
        setContributors(Array.isArray(data?.contributors) ? data.contributors : [])
        setContributorsMeta({
          circle: data?.circle || null,
          contributors_count: data?.contributors_count || 0,
        })
      } catch (error) {
        if (!active) return
        const message =
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          'Unable to load contributors report.'
        setContributorsError(message)
        setContributors([])
        setContributorsMeta(null)
      } finally {
        if (active) {
          setContributorsLoading(false)
        }
      }
    }

    loadContributors()

    return () => {
      active = false
    }
  }, [selectedCircleId])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    setCreating(true)
    setLoadError('')

    try {
      const payload = {
        circle: {
          name: form.name.trim(),
          purpose: form.purpose.trim(),
          description: form.description.trim(),
          circle_type: 'official',
          badge_label: form.badge_label.trim() || null,
          visibility: form.visibility,
          kyc_mode: form.kyc_mode,
          max_contribution_cents: form.max_contribution_cents
            ? String(Number(form.max_contribution_cents))
            : null,
        },
      }

      const res = await createCircle(payload)
      const created = res?.data
      toast.success('Official circle created successfully.')
      await loadOfficialCircles(created?.id)
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        (Array.isArray(error?.response?.data?.errors)
          ? error.response.data.errors.join(', ')
          : null) ||
        error?.response?.data?.error ||
        'Unable to create official circle.'

      setLoadError(message)
      toast.error(message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Admin</p>
            <h1 className="text-2xl font-semibold md:text-3xl">Official circles</h1>
            <p className="mt-1 text-sm text-slate-400">
              Create the BitBridge Founders Circle and review private contributor records.
            </p>
          </div>
          <NavLink
            to="/admin/dashboard"
            className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-800"
          >
            Back to dashboard
          </NavLink>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Create Founders Circle</h2>
                <p className="mt-1 text-xs text-slate-400">
                  This uses the existing official-circle backend rules. Regular users still cannot self-create official circles.
                </p>
              </div>
              <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-amber-200">
                Admin only
              </span>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs text-slate-300">Circle name</span>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-300">Badge label</span>
                  <input
                    name="badge_label"
                    value={form.badge_label}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs text-slate-300">Purpose</span>
                  <input
                    name="purpose"
                    value={form.purpose}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-300">Tier 1 cap (kobo)</span>
                  <input
                    name="max_contribution_cents"
                    type="number"
                    min="0"
                    value={form.max_contribution_cents}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Preview: {formatCapPreview(form.max_contribution_cents)}
                  </p>
                </label>
              </div>

              <label className="block">
                <span className="text-xs text-slate-300">Description</span>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={4}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs text-slate-300">Visibility</span>
                  <select
                    name="visibility"
                    value={form.visibility}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                  >
                    <option value="private">private</option>
                    <option value="official_featured">official_featured</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs text-slate-300">KYC mode</span>
                  <select
                    name="kyc_mode"
                    value={form.kyc_mode}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                  >
                    <option value="strict">strict</option>
                    <option value="flexible">flexible</option>
                  </select>
                </label>
              </div>

              {loadError ? <p className="text-sm text-red-400">{loadError}</p> : null}

              <button
                type="submit"
                disabled={creating}
                className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-400 disabled:opacity-60"
              >
                {creating ? 'Creating...' : 'Create official circle'}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Contributors report</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Private admin view of contributor totals for official circles.
                </p>
              </div>
              <button
                type="button"
                onClick={() => loadOfficialCircles(selectedCircleId)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800"
              >
                Refresh circles
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <label className="block">
                <span className="text-xs text-slate-300">Official circle</span>
                <select
                  value={selectedCircleId}
                  onChange={(event) => setSelectedCircleId(event.target.value)}
                  disabled={pageLoading || officialCircles.length === 0}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                >
                  {officialCircles.length === 0 ? (
                    <option value="">No official circles found</option>
                  ) : (
                    officialCircles.map((circle) => (
                      <option key={circle.id} value={circle.id}>
                        {circle.name}
                      </option>
                    ))
                  )}
                </select>
              </label>

              {selectedCircle ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-slate-300">
                  <p className="font-semibold text-slate-100">{selectedCircle.badge_label || 'Official circle'}</p>
                  <p className="mt-1 capitalize">
                    {selectedCircle.visibility} • {selectedCircle.kyc_mode} KYC
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Official circles</p>
                <p className="mt-2 text-2xl font-semibold text-slate-100">{officialCircles.length}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Contributors</p>
                <p className="mt-2 text-2xl font-semibold text-slate-100">
                  {contributorsMeta?.contributors_count ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Selected cap</p>
                <p className="mt-2 text-2xl font-semibold text-slate-100">
                  {selectedCircle ? formatCapPreview(selectedCircle.max_contribution_cents) : 'N/A'}
                </p>
              </div>
            </div>

            {contributorsError ? (
              <p className="mt-4 text-sm text-red-400">{contributorsError}</p>
            ) : null}

            {pageLoading ? (
              <p className="mt-6 text-sm text-slate-400">Loading official circles...</p>
            ) : contributorsLoading ? (
              <p className="mt-6 text-sm text-slate-400">Loading contributors report...</p>
            ) : contributors.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-slate-700 px-4 py-6 text-center text-sm text-slate-400">
                No contributors recorded yet for the selected circle.
              </div>
            ) : (
              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="px-3 py-2">Contributor</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Total contributed</th>
                      <th className="px-3 py-2">Count</th>
                      <th className="px-3 py-2">First contribution</th>
                      <th className="px-3 py-2">Latest contribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contributors.map((item) => (
                      <tr key={item.user_id} className="border-b border-slate-800/70 text-slate-200">
                        <td className="px-3 py-3">
                          <p className="font-medium">{item.display_name || item.username || item.user_id}</p>
                          <p className="text-xs text-slate-500">{item.username ? `@${item.username}` : `User ${item.user_id}`}</p>
                        </td>
                        <td className="px-3 py-3 text-slate-300">{item.email || 'N/A'}</td>
                        <td className="px-3 py-3 font-medium">
                          {nairaFormat((item.total_contributed_cents || 0) / 100)}
                        </td>
                        <td className="px-3 py-3">{item.contribution_count || 0}</td>
                        <td className="px-3 py-3 text-slate-300">{formatDateTime(item.first_contributed_at)}</td>
                        <td className="px-3 py-3 text-slate-300">{formatDateTime(item.last_contributed_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

export default OfficialCircles

