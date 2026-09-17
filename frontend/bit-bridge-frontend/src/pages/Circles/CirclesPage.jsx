import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import ClassicBtn from '../../components/button/ClassicButton'
import { createCircle, getCircles } from '../../api/circles'
import { setOwnerMode } from '../../redux/app'
import { formatCircleRoleLabel } from './roleLabels'
import { canUseCircles, needsTier2Access, withCircleAccessMissingDetails } from '../../utils/kycGate'

const PROMOTED_BUCKETS = [
  {
    key: 'clubs_teams',
    archetype: 'sports_circle',
    title: 'Clubs & Teams',
    subtitle: 'Run monthly dues, fines, and jersey funds with clear operating control.',
    useCases: ['Monthly dues', 'Fines', 'Jersey funds'],
  },
  {
    key: 'estates_communities',
    archetype: 'estate_circle',
    title: 'Estates & Communities',
    subtitle: 'Collect levies, utilities, and maintenance funds with proper visibility.',
    useCases: ['Security levies', 'Utilities', 'Maintenance funds'],
  },
  {
    key: 'cooperatives',
    archetype: 'savings_circle',
    title: 'Cooperatives',
    subtitle: 'Track recurring savings contributions now and prepare for lending pools later.',
    useCases: ['Savings contributions', 'Contribution tracking', 'Governance'],
  },
  {
    key: 'families',
    archetype: 'family_circle',
    title: 'Families',
    subtitle: 'Coordinate support pools, event contributions, and shared family obligations properly.',
    useCases: ['Support pools', 'Event contributions', 'Emergency support'],
  },
  {
    key: 'associations',
    archetype: 'association_treasury',
    title: 'Associations',
    subtitle: 'Collect membership dues, event collections, and treasury contributions with accountability.',
    useCases: ['Membership dues', 'Event collections', 'Treasury reporting'],
  },
]

const BUCKET_STYLES = {
  clubs_teams: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  estates_communities: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  cooperatives: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  families: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  associations: 'bg-slate-500/20 text-slate-200 border-slate-500/40',
}

const bucketMeta = (key) =>
  PROMOTED_BUCKETS.find((option) => option.key === key) || PROMOTED_BUCKETS[PROMOTED_BUCKETS.length - 1]

const bucketMetaFromGroup = (group) => {
  const profileKey = group?.circle_type_profile?.product_bucket_key
  if (profileKey) return bucketMeta(profileKey)

  const archetype = group?.circle_archetype
  return (
    PROMOTED_BUCKETS.find((option) => option.archetype === archetype) ||
    PROMOTED_BUCKETS[PROMOTED_BUCKETS.length - 1]
  )
}

const featuredRank = (group) => {
  if (group?.circle_type === 'official' && group?.visibility === 'official_featured') return 0
  if (group?.circle_type === 'official') return 1
  return 2
}

const CirclesPage = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const { ownerMode, selectedCircleId } = useSelector((state) => state.app || {})

  const canAccessCircles = canUseCircles(user)
  const canCreateCircle = !needsTier2Access(user)

  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    name: '',
    purpose: '',
    description: '',
    circle_archetype: 'sports_circle',
  })
  const [activeFilter, setActiveFilter] = useState('all')
  const [activities, setActivities] = useState([])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleOpenGroup = (id) => {
    if (!id) return
    dispatch(setOwnerMode({ mode: 'circle', circleId: id }))
    navigate(`/dashboard/shared-groups/${id}`)
  }

  const pushActivity = (item) => {
    setActivities((prev) => [item, ...prev].slice(0, 10))
  }

  useEffect(() => {
    if (!canAccessCircles) {
      toast.info(withCircleAccessMissingDetails(user, 'Verify your phone and complete Tier 1 to use shared groups.'), {
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
        const res = await getCircles()
        setGroups(Array.isArray(res?.data) ? res.data : [])
      } catch (err) {
        const status = err?.response?.status
        const apiMsg =
          err?.response?.data?.errors?.join(', ') ||
          err?.response?.data?.error ||
          err?.message ||
          'Something went wrong while loading your circles.'

        if (status === 401) {
          setError('Unable to load circles. Your session may have expired.')
        } else if (status === 404) {
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
  }, [canAccessCircles, navigate, user])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return

    try {
      setCreating(true)
      setError(null)

      const res = await createCircle({
        circle: {
          name: form.name.trim(),
          purpose: form.purpose.trim(),
          description: form.description.trim(),
          circle_archetype: form.circle_archetype,
        },
      })

      const newGroup = res?.data
      if (!newGroup) throw new Error('Circle created but server returned no data.')

      setGroups((prev) => [newGroup, ...(prev || [])])
      setForm({ name: '', purpose: '', description: '', circle_archetype: 'sports_circle' })
      setShowCreate(false)

      pushActivity({
        id: newGroup.id || `local-${Date.now()}`,
        initials: (newGroup.name || 'BB')
          .split(' ')
          .map((word) => word[0])
          .join('')
          .slice(0, 2)
          .toUpperCase(),
        title: `You created ${newGroup.name || 'a circle'}`,
        body: newGroup.purpose || 'New circle created. Add members, set the dues plan, and start collections.',
        meta: 'Just now • Circle created',
        tone: 'success',
      })
    } catch (err) {
      const status = err?.response?.status
      const msg =
        err?.response?.data?.errors?.join(', ') ||
        err?.response?.data?.error ||
        err?.message ||
        'Unable to create circle.'

      if (status === 401) {
        setError('Unable to create circle. Your session may have expired.')
      } else {
        setError(msg)
      }
    } finally {
      setCreating(false)
    }
  }

  const filteredGroups = useMemo(() => {
    const filtered =
      activeFilter === 'all'
        ? [...(groups || [])]
        : (groups || []).filter((group) => bucketMetaFromGroup(group).key === activeFilter)

    return filtered.sort((a, b) => featuredRank(a) - featuredRank(b))
  }, [groups, activeFilter])

  const totalGroups = groups.length

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-6 md:py-8">
      <div className="max-w-6xl mx-auto space-y-5 md:space-y-7">
        <section className="rounded-3xl bg-gradient-to-r from-[#020617] via-slate-950 to-[#020617] border border-slate-800/70 px-4 md:px-7 py-5 md:py-7 shadow-[0_0_40px_rgba(15,23,42,0.8)]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-3">
              <p className="text-[11px] tracking-[0.26em] uppercase text-sky-300/80">BITBRIDGE CIRCLES</p>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-semibold">Run your group finances properly.</h1>
              <p className="text-sm md:text-base text-slate-300 max-w-xl">
                Collect dues, track payments, and stay accountable. Built for clubs, estates, cooperatives, families, and associations.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                <span className="px-3 py-1 rounded-full border border-slate-700/80 bg-slate-900/70">Clubs &amp; teams</span>
                <span className="px-3 py-1 rounded-full border border-slate-700/80 bg-slate-900/70">Estates &amp; communities</span>
                <span className="px-3 py-1 rounded-full border border-slate-700/80 bg-slate-900/70">Cooperatives, families, associations</span>
              </div>
            </div>

            <div className="flex flex-col items-start md:items-end gap-4">
              <p className="text-[11px] text-slate-400 max-w-xs text-left md:text-right">
                Wallet is the feature. Circles are the ecosystem that can onboard and retain whole communities.
              </p>
              <ClassicBtn onclick={() => setShowCreate(true)} className="h-11 px-6 text-sm" disabled={!canCreateCircle}>
                Create a circle
              </ClassicBtn>
              <p className="text-[11px] text-slate-400 max-w-xs text-left md:text-right">
                Use one operating circle for dues, levies, contributions, and controlled disbursements.
              </p>
            </div>
          </div>
        </section>

        <div className="grid lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 space-y-5">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 md:p-5 shadow-[0_0_30px_rgba(15,23,42,0.7)]">
              {showCreate ? (
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm md:text-base font-semibold">Create a circle</h2>
                      <p className="text-[11px] text-slate-400">Select the circle bucket first, then define the working identity for the group.</p>
                    </div>
                    <button type="button" onClick={() => setShowCreate(false)} className="text-[11px] text-slate-400 hover:text-slate-100">
                      Cancel
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Circle bucket</label>
                    <div className="grid md:grid-cols-2 gap-3">
                      {PROMOTED_BUCKETS.map((bucket) => {
                        const active = form.circle_archetype === bucket.archetype
                        return (
                          <button
                            key={bucket.key}
                            type="button"
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                circle_archetype: bucket.archetype,
                                purpose: prev.purpose || bucket.title,
                              }))
                            }
                            className={`rounded-xl border p-3 text-left transition ${
                              active ? 'border-alt bg-alt/10' : 'border-slate-700 bg-slate-950/70 hover:border-alt/50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-2">
                                <div className="text-sm font-semibold text-slate-100">{bucket.title}</div>
                                <p className="text-[11px] text-slate-300">{bucket.subtitle}</p>
                                <div className="flex flex-wrap gap-2">
                                  {bucket.useCases.map((item) => (
                                    <span key={item} className="rounded-full border border-slate-700 bg-slate-900 px-2 py-[2px] text-[10px] uppercase tracking-[0.16em] text-slate-300">
                                      {item}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <span className={`mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                                active ? 'border-alt bg-alt text-slate-950' : 'border-slate-600 text-slate-400'
                              }`}>
                                {active ? 'OK' : ''}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-1">Circle name</label>
                      <input
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Premier Supporters Fund, Greenfield Estate Levy..."
                        className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-alt/80"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-1">Purpose</label>
                      <input
                        name="purpose"
                        value={form.purpose}
                        onChange={handleChange}
                        placeholder="What the group collects and pays for"
                        className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-alt/80"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-1">Description (optional)</label>
                    <textarea
                      name="description"
                      value={form.description}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Who belongs here, what the circle funds, and how collections should operate."
                      className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-alt/80 resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <p className="text-[11px] text-slate-400 max-w-xs">
                      Dues setup is optional at creation. Create the circle now, then add members, assign a treasurer, and start collections properly.
                    </p>
                    <ClassicBtn htmlType="submit" className="h-10 px-5 text-sm" disabled={creating}>
                      {creating ? 'Creating…' : 'Create circle'}
                    </ClassicBtn>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <h2 className="text-sm md:text-base font-semibold mb-1">Launch a proper group finance workspace</h2>
                    <p className="text-xs md:text-[13px] text-slate-300 max-w-md">
                      Built for clubs, estates, cooperatives, families, and associations that need collections, controls, and shared records.
                    </p>
                    <p className="mt-2 text-[11px] text-slate-500">
                      {totalGroups === 0
                        ? 'No circles yet — create your first operating circle now.'
                        : `You currently have ${totalGroups} active circle${totalGroups === 1 ? '' : 's'}.`}
                    </p>
                  </div>
                  <ClassicBtn onclick={() => setShowCreate(true)} className="h-10 px-5 text-sm whitespace-nowrap">
                    Create circle
                  </ClassicBtn>
                </div>
              )}

              {error && <p className="mt-3 text-[11px] text-red-400">{error}</p>}
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 md:p-5">
              <div className="flex items-center justify-between mb-4 gap-3">
                <div className="space-y-1">
                  <h3 className="text-sm md:text-base font-semibold">Your circles</h3>
                  <p className="text-[11px] text-slate-400">Filter by the promoted group finance buckets.</p>
                </div>
                <div className="inline-flex items-center gap-1 rounded-full bg-slate-900/90 border border-slate-700 px-3 py-1 text-[11px]">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-slate-300">{totalGroups} active circle{totalGroups === 1 ? '' : 's'}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4 text-[11px]">
                {[{ id: 'all', label: 'All circles' }, ...PROMOTED_BUCKETS.map((bucket) => ({ id: bucket.key, label: bucket.title }))].map((filterOption) => {
                  const isActive = activeFilter === filterOption.id
                  return (
                    <button
                      key={filterOption.id}
                      type="button"
                      onClick={() => setActiveFilter(filterOption.id)}
                      className={`px-3 py-1 rounded-full border text-xs transition ${
                        isActive
                          ? 'border-alt bg-alt/10 text-alt'
                          : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-alt/60 hover:text-alt'
                      }`}
                    >
                      {filterOption.label}
                    </button>
                  )
                })}
              </div>

              {loading ? (
                <p className="text-xs text-slate-400">Loading circles…</p>
              ) : filteredGroups.length === 0 ? (
                <div className="border border-dashed border-slate-700 rounded-xl px-4 py-6 text-center text-xs md:text-[13px] text-slate-300">
                  <p className="font-medium mb-1">{totalGroups === 0 ? 'No circles yet.' : 'No circles match this bucket yet.'}</p>
                  <p>Create a circle or switch filters to review all your group finance workspaces.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {filteredGroups.map((group) => {
                    const hasParticipantCount = group.participant_count != null
                    const memberCount = group.participant_count ?? group.members_count ?? group.member_count ?? 0
                    const memberLabel = hasParticipantCount ? 'participant' : 'workspace member'
                    const roleLabel = formatCircleRoleLabel(group.role || group.current_user_role || 'member')
                    const workspaceActive = ownerMode === 'circle' && String(selectedCircleId || '') === String(group.id)
                    const bucket = bucketMetaFromGroup(group)
                    const isOfficialCircle = group.circle_type === 'official'
                    const isFeaturedOfficial = isOfficialCircle && group.visibility === 'official_featured'
                    const officialBadgeLabel = group.badge_label || 'Official'
                    const bucketStyle = BUCKET_STYLES[bucket.key] || BUCKET_STYLES.associations
                    const initials = (group.name || 'BB')
                      .split(' ')
                      .map((word) => word[0])
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
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h4 className="font-semibold text-sm md:text-[15px]">{group.name}</h4>
                              {isFeaturedOfficial && (
                                <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-[2px] text-[10px] uppercase tracking-[0.16em] text-amber-200">
                                  Featured
                                </span>
                              )}
                              {isOfficialCircle && (
                                <span className="inline-flex items-center rounded-full border border-sky-400/40 bg-sky-400/10 px-2 py-[2px] text-[10px] uppercase tracking-[0.16em] text-sky-200">
                                  {officialBadgeLabel}
                                </span>
                              )}
                              <span className={`inline-flex items-center rounded-full border px-2 py-[2px] text-[10px] uppercase tracking-[0.16em] ${bucketStyle}`}>
                                {group?.circle_type_profile?.product_bucket_label || bucket.title}
                              </span>
                              {group?.circle_type_profile?.type_label && (
                                <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950 px-2 py-[2px] text-[10px] uppercase tracking-[0.16em] text-slate-200">
                                  {group.circle_type_profile.type_label}
                                </span>
                              )}
                              {workspaceActive && (
                                <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-[2px] text-[10px] uppercase tracking-[0.16em] text-emerald-200">
                                  Active workspace
                                </span>
                              )}
                            </div>

                            <p className="text-slate-300">
                              {group?.circle_type_profile?.subtitle || group.description || bucket.subtitle}
                            </p>

                            <p className="mt-1 text-[11px] text-slate-400">
                              {memberCount} {memberLabel}{memberCount === 1 ? '' : 's'} • Your role: <span>{roleLabel}</span>
                            </p>
                          </div>
                        </div>

                        <div className="mt-1 flex flex-col items-end gap-2">
                          {!workspaceActive ? (
                            <button
                              type="button"
                              onClick={() => dispatch(setOwnerMode({ mode: 'circle', circleId: group.id }))}
                              className="text-[11px] text-emerald-300 hover:text-emerald-100 underline underline-offset-4"
                            >
                              Use workspace
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => handleOpenGroup(group.id)}
                            className="text-[11px] text-sky-300 hover:text-sky-100 underline underline-offset-4"
                          >
                            Open circle
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>

          <aside className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 md:p-5 flex flex-col min-h-[260px] shadow-[0_0_30px_rgba(15,23,42,0.7)]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm md:text-base font-semibold">Activity timeline</h3>
                <p className="text-[11px] text-slate-400">See what&apos;s happening across all your circles.</p>
              </div>
              <span className="text-[11px] text-slate-500">Live feed</span>
            </div>

            {activities.length === 0 ? (
              <div className="mt-4 flex-1 flex items-center justify-center">
                <div className="text-center text-xs md:text-[13px] text-slate-300">
                  <p className="font-medium mb-1">No activity yet.</p>
                  <p className="text-slate-400">
                    Create a circle, add members, and start collections. Real treasury activity will appear here as it happens.
                  </p>
                </div>
              </div>
            ) : (
              <ul className="mt-3 space-y-3 text-xs md:text-[13px]">
                {activities.map((activity) => (
                  <li
                    key={activity.id}
                    className="flex gap-3 items-start rounded-xl border border-slate-800 bg-slate-950/90 px-3 py-3"
                  >
                    <div
                      className={`mt-[2px] h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-semibold border border-slate-900 ${
                        activity.tone === 'success'
                          ? 'bg-gradient-to-br from-emerald-400 to-teal-500'
                          : 'bg-gradient-to-br from-sky-400 to-blue-500'
                      }`}
                    >
                      {activity.initials || 'BB'}
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-slate-100">{activity.title}</p>
                      <p className="text-slate-300">{activity.body}</p>
                      <p className="text-[11px] text-slate-500">{activity.meta}</p>
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
