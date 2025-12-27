// src/pages/Circles/CirclesPage.jsx

import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import ClassicBtn from '../../components/button/ClassicButton'
import client from '../../api/client'
import { toast } from 'react-toastify'

// Rough categorisation for the filter pills (purely UI)
const detectCategory = (group) => {
  const text = `${group?.purpose || ''} ${group?.name || ''}`.toLowerCase()

  if (/(light|power|phcn|bill|rent|estate|service|subscription)/.test(text)) return 'bills'
  if (/(trip|travel|vacation|holiday|flight|airbnb)/.test(text)) return 'trips'
  if (/(project|goal|support|savings|target|contribution)/.test(text)) return 'projects'
  return 'all'
}

const CirclesPage = () => {
  const navigate = useNavigate()
  const { user } = useSelector((state) => state.auth)

  const userKyc = (user?.kyc_level || 'nil').toString().toLowerCase()
  const needsTier1 = ['nil', '', 'tier_0'].includes(userKyc)

  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', purpose: '', description: '' })

  const [activeFilter, setActiveFilter] = useState('all')
  const [activities, setActivities] = useState([]) // simple client-side activity feed

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleOpenGroup = (id) => {
    if (!id) return
    navigate(`/dashboard/shared-groups/${id}`)
  }

  const pushActivity = (item) => {
    setActivities((prev) => [item, ...prev].slice(0, 10))
  }

  // ---------- load groups from backend ----------
  useEffect(() => {
    if (needsTier1) {
      toast.info('Complete Tier 1 verification to use shared groups.', {
        position: 'top-right',
        autoClose: 4000,
        pauseOnHover: true,
      })
      navigate('/dashboard/kyc')
      return
    }

    const loadGroups = async () => {
      try {
        setLoading(true)
        setError(null)

        // client will attach token + Accept JSON automatically.
        // If token is missing, client may 401; we show a helpful message.
        const res = await client.get('/circles')
        const data = res?.data

        setGroups(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error('[Circles] loadGroups error:', err)

        const status = err?.response?.status
        const apiMsg =
          err?.response?.data?.errors?.join(', ') ||
          err?.response?.data?.error ||
          err?.message ||
          'Something went wrong while loading your shared groups.'

        if (status === 401) {
          setError('Unable to load shared groups – your session may have expired. Please log out and log in again.')
        } else if (status === 404) {
          // If this happens after our fix, your backend route is missing/mismatched.
          setError('Circles endpoint not found (404). Please confirm /api/v1/circles exists on the backend.')
        } else {
          setError(apiMsg)
        }

        setGroups([])
      } finally {
        setLoading(false)
      }
    }

    loadGroups()
  }, [navigate, needsTier1])

  // ---------- create group ----------
  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return

    try {
      setCreating(true)
      setError(null)

      // Rails typically expects { circle: {...} } – keep this payload shape.
      const res = await client.post('/circles', {
        circle: {
          name: form.name.trim(),
          purpose: form.purpose.trim(),
          description: form.description.trim(),
        },
      })

      const newGroup = res?.data
      if (!newGroup) throw new Error('Group created but server returned no data.')

      setGroups((prev) => [newGroup, ...(prev || [])])
      setForm({ name: '', purpose: '', description: '' })
      setShowCreate(false)

      // 🔔 Add a social-style activity item
      pushActivity({
        id: newGroup.id || `local-${Date.now()}`,
        initials: (newGroup.name || 'BB')
          .split(' ')
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase(),
        title: `You created ${newGroup.name || 'a shared group'}`,
        body:
          newGroup.purpose ||
          'New shared group created. Invite people and set up your first contribution.',
        meta: 'Just now • Group created',
        tone: 'success',
      })
    } catch (err) {
      console.error('[Circles] handleCreate error:', err)

      const status = err?.response?.status
      const msg =
        err?.response?.data?.errors?.join(', ') ||
        err?.response?.data?.error ||
        err?.message ||
        'Unable to create group.'

      if (status === 401) {
        setError('Unable to create group – your session may have expired. Please log out and log in again.')
      } else {
        setError(msg)
      }
    } finally {
      setCreating(false)
    }
  }

  // ---------- derived data ----------
  const filteredGroups = useMemo(() => {
    if (activeFilter === 'all') return groups
    return (groups || []).filter((g) => detectCategory(g) === activeFilter)
  }, [groups, activeFilter])

  const totalGroups = groups.length

  // ---------- render ----------
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-6 md:py-8">
      <div className="max-w-6xl mx-auto space-y-5 md:space-y-7">
        {/* HERO – more social feel */}
        <section className="rounded-3xl bg-gradient-to-r from-[#020617] via-slate-950 to-[#020617] border border-slate-800/70 px-4 md:px-7 py-5 md:py-7 shadow-[0_0_40px_rgba(15,23,42,0.8)]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-3">
              <p className="text-[11px] tracking-[0.26em] uppercase text-sky-300/80">SHARED GROUPS</p>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-semibold">Money that moves with your people.</h1>
              <p className="text-sm md:text-base text-slate-300 max-w-xl">
                Create shared balances for homes, trips and projects. One person can pay, but everyone sees what&apos;s happening in real-time.
              </p>

              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                <span className="px-3 py-1 rounded-full border border-slate-700/80 bg-slate-900/70">
                  Split electricity, rent &amp; internet
                </span>
                <span className="px-3 py-1 rounded-full border border-slate-700/80 bg-slate-900/70">
                  Vacation &amp; event pots
                </span>
                <span className="px-3 py-1 rounded-full border border-slate-700/80 bg-slate-900/70">
                  Transparent activity timeline
                </span>
              </div>
            </div>

            <div className="flex flex-col items-start md:items-end gap-4">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 border border-slate-900 flex items-center justify-center text-[11px] font-semibold">
                    BB
                  </div>
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 border border-slate-900 flex items-center justify-center text-[11px] font-semibold">
                    HR
                  </div>
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-fuchsia-400 to-purple-500 border border-slate-900 flex items-center justify-center text-[11px] font-semibold">
                    PS
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  People are already using shared groups for monthly bills, trips and family support.
                </p>
              </div>

              <ClassicBtn onclick={() => setShowCreate(true)} className="h-11 px-6 text-sm">
                Create a new group
              </ClassicBtn>

              <p className="text-[11px] text-slate-400 max-w-xs text-left md:text-right">
                You&apos;ll be able to invite members, choose who can approve payments and see a shared timeline of every transaction.
              </p>
            </div>
          </div>
        </section>

        <div className="grid lg:grid-cols-3 gap-6 items-start">
          {/* LEFT + MIDDLE: create form + groups list */}
          <div className="lg:col-span-2 space-y-5">
            {/* CREATE PANEL */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 md:p-5 shadow-[0_0_30px_rgba(15,23,42,0.7)]">
              {showCreate ? (
                <form onSubmit={handleCreate} className="space-y-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div>
                      <h2 className="text-sm md:text-base font-semibold">Create a shared group</h2>
                      <p className="text-[11px] text-slate-400">
                        Give it a name people will recognise and a short purpose.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCreate(false)}
                      className="text-[11px] text-slate-400 hover:text-slate-100"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-1">
                        Group name
                      </label>
                      <input
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Home Power, December Trip, Parents Support..."
                        className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-alt/80"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-1">
                        Purpose
                      </label>
                      <input
                        name="purpose"
                        value={form.purpose}
                        onChange={handleChange}
                        placeholder="Bills, vacation, rent, savings..."
                        className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-alt/80"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-1">
                      Description (optional)
                    </label>
                    <textarea
                      name="description"
                      value={form.description}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Who is in this group and what is the money used for?"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-alt/80 resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <p className="text-[11px] text-slate-400 max-w-xs">
                      You&apos;ll start as an admin. Later you can add rules like multiple approvers and &quot;disagree&quot; controls for safety.
                    </p>
                    <ClassicBtn htmlType="submit" className="h-10 px-5 text-sm" disabled={creating}>
                      {creating ? 'Creating…' : 'Create group'}
                    </ClassicBtn>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <h2 className="text-sm md:text-base font-semibold mb-1">Start a shared balance with people you trust</h2>
                    <p className="text-xs md:text-[13px] text-slate-300 max-w-md">
                      Use shared groups for power bills, rent, trips, savings targets or community projects where everyone contributes.
                    </p>
                    <p className="mt-2 text-[11px] text-slate-500">
                      {totalGroups === 0
                        ? 'No shared groups yet — create your first one in a few seconds.'
                        : `You currently have ${totalGroups} shared group${totalGroups === 1 ? '' : 's'}.`}
                    </p>
                  </div>
                  <ClassicBtn onclick={() => setShowCreate(true)} className="h-10 px-5 text-sm whitespace-nowrap">
                    Create new group
                  </ClassicBtn>
                </div>
              )}

              {error && <p className="mt-3 text-[11px] text-red-400">{error}</p>}
            </section>

            {/* GROUPS LIST / FILTERS */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 md:p-5">
              <div className="flex items-center justify-between mb-4 gap-3">
                <div className="space-y-1">
                  <h3 className="text-sm md:text-base font-semibold">Your shared groups</h3>
                  <p className="text-[11px] text-slate-400">Tap a chip to filter by use case.</p>
                </div>

                <div className="inline-flex items-center gap-1 rounded-full bg-slate-900/90 border border-slate-700 px-3 py-1 text-[11px]">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-slate-300">
                    {totalGroups} active group{totalGroups === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              {/* Filter chips */}
              <div className="flex flex-wrap gap-2 mb-4 text-[11px]">
                {[
                  { id: 'all', label: 'All groups' },
                  { id: 'bills', label: 'House & bills' },
                  { id: 'trips', label: 'Trips & events' },
                  { id: 'projects', label: 'Projects & goals' },
                ].map((f) => {
                  const isActive = activeFilter === f.id
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setActiveFilter(f.id)}
                      className={`px-3 py-1 rounded-full border text-xs transition ${
                        isActive
                          ? 'border-alt bg-alt/10 text-alt'
                          : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-alt/60 hover:text-alt'
                      }`}
                    >
                      {f.label}
                    </button>
                  )
                })}
              </div>

              {loading ? (
                <p className="text-xs text-slate-400">Loading groups…</p>
              ) : filteredGroups.length === 0 ? (
                <div className="border border-dashed border-slate-700 rounded-xl px-4 py-6 text-center text-xs md:text-[13px] text-slate-300">
                  <p className="font-medium mb-1">
                    {totalGroups === 0 ? 'No shared groups yet.' : 'No groups match this filter yet.'}
                  </p>
                  <p>Create a group or switch filters to see all your shared balances with friends, family or your community.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {filteredGroups.map((group) => {
                    const memberCount = group.members_count ?? 1
                    const roleLabel = group.role || 'Admin'
                    const category = detectCategory(group)

                    const categoryBadge = {
                      bills: {
                        label: 'House & bills',
                        color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
                      },
                      trips: {
                        label: 'Trips & events',
                        color: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
                      },
                      projects: {
                        label: 'Projects & goals',
                        color: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
                      },
                      all: {
                        label: 'Shared',
                        color: 'bg-slate-500/20 text-slate-200 border-slate-500/40',
                      },
                    }[category]

                    const initials = (group.name || 'BB')
                      .split(' ')
                      .map((w) => w[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()

                    return (
                      <li
                        key={group.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-950/90 to-slate-900 px-3 py-3 md:px-4 md:py-4 text-xs md:text-[13px]"
                      >
                        <div className="flex gap-3">
                          <div className="mt-[2px] h-9 w-9 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-[11px] font-semibold border border-slate-950/80">
                            {initials}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-sm md:text-[15px]">{group.name}</h4>
                              {group.purpose && (
                                <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-2 py-[2px] text-[10px] uppercase tracking-[0.16em] text-slate-300">
                                  {group.purpose}
                                </span>
                              )}
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-[2px] text-[10px] uppercase tracking-[0.16em] ${categoryBadge.color}`}
                              >
                                {categoryBadge.label}
                              </span>
                            </div>

                            {group.description && <p className="text-slate-300">{group.description}</p>}

                            <p className="mt-1 text-[11px] text-slate-400">
                              {memberCount} member{memberCount === 1 ? '' : 's'} • Your role:{' '}
                              <span className="capitalize">{roleLabel}</span>
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenGroup(group.id)}
                          className="mt-1 text-[11px] text-sky-300 hover:text-sky-100 underline underline-offset-4"
                        >
                          Open group
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>

          {/* RIGHT: activity panel – social timeline */}
          <aside className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 md:p-5 flex flex-col min-h-[260px] shadow-[0_0_30px_rgba(15,23,42,0.7)]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm md:text-base font-semibold">Activity timeline</h3>
                <p className="text-[11px] text-slate-400">See what&apos;s happening across all your groups.</p>
              </div>
              <span className="text-[11px] text-slate-500">Live feed (per group)</span>
            </div>

            {activities.length === 0 ? (
              <div className="mt-4 flex-1 flex items-center justify-center">
                <div className="text-center text-xs md:text-[13px] text-slate-300">
                  <p className="font-medium mb-1">No activity yet.</p>
                  <p className="text-slate-400">
                    Create a group, invite people and start paying bills or saving together. Every new action will appear here in a clean, social-style timeline.
                  </p>
                </div>
              </div>
            ) : (
              <ul className="mt-3 space-y-3 text-xs md:text-[13px]">
                {activities.map((a) => (
                  <li
                    key={a.id}
                    className="flex gap-3 items-start rounded-xl border border-slate-800 bg-slate-950/90 px-3 py-3"
                  >
                    <div
                      className={`mt-[2px] h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-semibold border border-slate-900 ${
                        a.tone === 'success'
                          ? 'bg-gradient-to-br from-emerald-400 to-teal-500'
                          : 'bg-gradient-to-br from-sky-400 to-blue-500'
                      }`}
                    >
                      {a.initials || 'BB'}
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-slate-100">{a.title}</p>
                      <p className="text-slate-300">{a.body}</p>
                      <p className="text-[11px] text-slate-500">{a.meta}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}

export default CirclesPage
