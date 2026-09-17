import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getCirclePeople, getCircleWorkspace } from '../../../api/circles'
import { isInvestorSandbox } from '../../../config/sandbox'
import CircleShell from './CircleShell'
import { SandboxContextCard } from '../../../components/investorSandbox/SandboxInvestorTour'
import { getCircleBucketLabel, getCircleRoleLabel, getCircleTitle } from './shared'
import { getPersonDisplayName, getPersonSourceLabel, getPersonStatus, isPersonLinked, normalizeCirclePeopleResponse } from '../../../utils/circlePeople'

const CirclePeoplePage = () => {
  const { id } = useParams()
  const [workspace, setWorkspace] = useState(null)
  const [registry, setRegistry] = useState({ people: [], participantCount: 0, activeParticipantCount: null })
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return undefined
    let cancelled = false
    setLoading(true)
    Promise.all([getCircleWorkspace(id), getCirclePeople(id)])
      .then(([workspaceResponse, peopleResponse]) => {
        if (cancelled) return
        setWorkspace(workspaceResponse?.data || {})
        setRegistry(normalizeCirclePeopleResponse(peopleResponse?.data))
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load this Circle registry right now.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [id])

  const statuses = useMemo(() => [...new Set(registry.people.map((person) => getPersonStatus(person)))].sort(), [registry.people])
  const sources = useMemo(() => [...new Set(registry.people.map((person) => getPersonSourceLabel(person)))].sort(), [registry.people])
  const filteredPeople = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return registry.people.filter((person) => {
      const name = getPersonDisplayName(person).toLowerCase()
      const status = getPersonStatus(person)
      const source = getPersonSourceLabel(person)
      return (!normalizedQuery || name.includes(normalizedQuery)) &&
        (statusFilter === 'all' || status === statusFilter) &&
        (sourceFilter === 'all' || source === sourceFilter)
    })
  }, [query, registry.people, sourceFilter, statusFilter])

  if (loading) return <div className="px-6 py-10 text-sm text-slate-400">Loading People registry...</div>
  if (error || !workspace) return <div className="px-6 py-10 text-sm text-rose-300">{error || 'Circle not found.'}</div>

  const participantCount = registry.participantCount || Number(workspace.participant_count || 0)
  const activeCount = registry.activeParticipantCount == null
    ? registry.people.filter((person) => getPersonStatus(person) === 'active').length
    : registry.activeParticipantCount
  const workspaceMemberCount = Number(workspace.workspace_member_count || workspace.member_count || 0)

  return <CircleShell circleId={id} title={getCircleTitle(workspace)} roleLabel={getCircleRoleLabel(workspace)} bucketLabel={getCircleBucketLabel(workspace)}>
    {isInvestorSandbox ? <SandboxContextCard eyebrow="People registry" title="The people and households represented in this Circle.">
      Organizations can bring their existing participant registry into BitBridge Global without requiring every participant to create an app account first. Financial obligations and collections can then be coordinated around the organization.
    </SandboxContextCard> : null}

    <section className="rounded-[28px] border border-slate-900 bg-[#050b1b] px-5 py-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div><p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">People</p><h2 className="mt-2 text-2xl font-semibold text-white">Participant registry</h2><p className="mt-2 text-sm text-slate-400">The operational roster behind recurring obligations and collections.</p></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-3"><p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Participants</p><p className="mt-1 text-lg font-semibold text-white">{participantCount}</p></div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-3"><p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Active participants</p><p className="mt-1 text-lg font-semibold text-white">{activeCount}</p></div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-3"><p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Workspace access</p><p className="mt-1 text-lg font-semibold text-white">{workspaceMemberCount}</p></div>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-3 md:flex-row">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search participants" className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-white placeholder:text-slate-600" />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-white"><option value="all">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select>
        <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-white"><option value="all">All sources</option>{sources.map((source) => <option key={source} value={source}>{source}</option>)}</select>
      </div>
      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-900">
        {filteredPeople.length ? filteredPeople.map((person, index) => <div key={String(person.id || person.reference || `${getPersonDisplayName(person)}-${index}`)} className="flex flex-col gap-3 border-b border-slate-900 bg-slate-950/40 px-4 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{getPersonDisplayName(person)}</p><p className="mt-1 text-xs capitalize text-slate-400">{getPersonSourceLabel(person)}{isPersonLinked(person) && getPersonSourceLabel(person) !== 'Linked app user' ? ' · Linked app user' : ''}</p></div>
          <span className="self-start rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-slate-300 sm:self-auto">{getPersonStatus(person)}</span>
        </div>) : <div className="px-4 py-8 text-center text-sm text-slate-400">No participants match these filters.</div>}
      </div>
    </section>
  </CircleShell>
}

export default CirclePeoplePage
