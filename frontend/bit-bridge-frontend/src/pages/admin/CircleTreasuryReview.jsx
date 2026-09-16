import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { toast } from 'react-toastify'
import {
  approveAdminCircleTreasuryRequest,
  assignAdminCircleTreasuryAccountDetails,
  getAdminCircleTreasuryRequest,
  getAdminCircleTreasuryRequests,
  rejectAdminCircleTreasuryRequest,
} from '../../api/adminCircleTreasury'
import { getStatistics } from '../../redux/actions/statistics'
import { useDispatch } from 'react-redux'
import nairaFormat from '../../utils/nairaFormat'
import dateFormater from '../../utils/dateFormat'

const FILTER_OPTIONS = [
  { value: 'all', label: 'All requests' },
  { value: 'pending', label: 'Pending review' },
  { value: 'pending_assignment', label: 'Pending assignment' },
  { value: 'active', label: 'Active' },
  { value: 'rejected', label: 'Rejected' },
]

const DEFAULT_ASSIGNMENT_FORM = {
  provider: 'anchor',
  account_name: '',
  account_number: '',
  bank_name: '',
  bank_code: '',
  provider_reference: '',
}

const formatMoney = (cents) => nairaFormat(Number(cents || 0) / 100)

const toneForStatus = (status) => {
  switch (String(status || '').toLowerCase()) {
    case 'active':
      return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
    case 'pending':
    case 'pending_review':
      return 'border-amber-400/30 bg-amber-400/10 text-amber-200'
    case 'pending_assignment':
      return 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200'
    case 'approved':
      return 'border-sky-400/30 bg-sky-400/10 text-sky-200'
    case 'rejected':
      return 'border-rose-400/30 bg-rose-400/10 text-rose-200'
    case 'suspended':
      return 'border-rose-400/30 bg-rose-400/10 text-rose-200'
    default:
      return 'border-slate-700 bg-slate-800 text-slate-200'
  }
}

const requestQueueStatus = (request) => {
  if (request?.treasury_account?.status) return String(request.treasury_account.status)
  if (request?.status === 'pending') return 'pending_review'
  return String(request?.status || 'unknown')
}

const buildAssignmentForm = (account) => ({
  provider: account?.provider || 'anchor',
  account_name: account?.account_name || '',
  account_number: account?.account_number || '',
  bank_name: account?.bank_name || '',
  bank_code: account?.bank_code || '',
  provider_reference: account?.provider_reference || '',
})

const CircleTreasuryReview = () => {
  const dispatch = useDispatch()
  const [requests, setRequests] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeFilter, setActiveFilter] = useState('pending')
  const [selectedRequestId, setSelectedRequestId] = useState('')
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [decisionNote, setDecisionNote] = useState('')
  const [assignmentForm, setAssignmentForm] = useState(DEFAULT_ASSIGNMENT_FORM)

  const loadRequests = useCallback(async (preferredRequestId = null) => {
    try {
      setLoading(true)
      setError('')
      const response = await getAdminCircleTreasuryRequests()
      const rows = Array.isArray(response?.data?.data) ? response.data.data : []
      setRequests(rows)

      const nextRequestId =
        preferredRequestId ||
        selectedRequestId ||
        rows.find((row) => requestQueueStatus(row) === 'pending_review')?.id ||
        rows[0]?.id ||
        ''
      setSelectedRequestId(nextRequestId ? String(nextRequestId) : '')
    } catch (loadError) {
      setError(
        loadError?.response?.data?.message ||
          'Unable to load Circle Treasury requests right now.'
      )
      setRequests([])
      setSelectedRequestId('')
    } finally {
      setLoading(false)
    }
  }, [selectedRequestId])

  const loadStats = useCallback(async () => {
    try {
      const response = await dispatch(getStatistics()).unwrap()
      setStats(response?.data || null)
    } catch {
      setStats(null)
    }
  }, [dispatch])

  const loadRequestDetail = async (requestId) => {
    if (!requestId) {
      setSelectedRequest(null)
      setDecisionNote('')
      setAssignmentForm(DEFAULT_ASSIGNMENT_FORM)
      return
    }

    try {
      setDetailLoading(true)
      const response = await getAdminCircleTreasuryRequest(requestId)
      const data = response?.data?.data || null
      setSelectedRequest(data)
      setDecisionNote(data?.decision_note || '')
      setAssignmentForm(buildAssignmentForm(data?.treasury_account))
    } catch (loadError) {
      toast.error(
        loadError?.response?.data?.message ||
          'Unable to load the selected Circle Treasury request.'
      )
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  useEffect(() => {
    loadRequestDetail(selectedRequestId)
  }, [selectedRequestId])

  const filteredRequests = useMemo(() => {
    if (activeFilter === 'all') return requests
    return requests.filter((request) => requestQueueStatus(request) === activeFilter)
  }, [activeFilter, requests])

  const summary = useMemo(
    () =>
      requests.reduce(
        (acc, request) => {
          const status = requestQueueStatus(request)
          if (status === 'pending_review') acc.pending += 1
          if (status === 'pending_assignment') acc.pendingAssignment += 1
          if (status === 'active') acc.active += 1
          if (status === 'rejected') acc.rejected += 1
          return acc
        },
        { pending: 0, pendingAssignment: 0, active: 0, rejected: 0 }
      ),
    [requests]
  )

  const handleApprove = async () => {
    if (!selectedRequest?.id) return
    try {
      setActionLoading(true)
      const payload = {
        decision_note: decisionNote,
        provisioning_details: {
          provider_reference: assignmentForm.provider_reference,
          account_name: assignmentForm.account_name,
          account_number: assignmentForm.account_number,
          bank_name: assignmentForm.bank_name,
          bank_code: assignmentForm.bank_code,
        },
      }
      const response = await approveAdminCircleTreasuryRequest(selectedRequest.id, payload)
      const updated = response?.data?.data || null
      setSelectedRequest(updated)
      setAssignmentForm(buildAssignmentForm(response?.data?.treasury_account))
      toast.success(response?.data?.message || 'Circle Treasury request approved.')
      await loadRequests(String(selectedRequest.id))
      await loadRequestDetail(String(selectedRequest.id))
    } catch (actionError) {
      toast.error(
        actionError?.response?.data?.message ||
          'Unable to approve the Circle Treasury request.'
      )
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!selectedRequest?.id) return
    try {
      setActionLoading(true)
      const response = await rejectAdminCircleTreasuryRequest(selectedRequest.id, {
        decision_note: decisionNote,
      })
      toast.success(response?.data?.message || 'Circle Treasury request rejected.')
      await loadRequests(String(selectedRequest.id))
      await loadRequestDetail(String(selectedRequest.id))
    } catch (actionError) {
      toast.error(
        actionError?.response?.data?.message ||
          'Unable to reject the Circle Treasury request.'
      )
    } finally {
      setActionLoading(false)
    }
  }

  const handleAssignDetails = async () => {
    if (!selectedRequest?.treasury_account?.id) return
    try {
      setActionLoading(true)
      const response = await assignAdminCircleTreasuryAccountDetails(
        selectedRequest.treasury_account.id,
        assignmentForm
      )
      toast.success(response?.data?.message || 'Treasury account details updated.')
      await loadRequests(String(selectedRequest.id))
      await loadRequestDetail(String(selectedRequest.id))
    } catch (actionError) {
      toast.error(
        actionError?.response?.data?.message ||
          'Unable to update the Circle Treasury account details.'
      )
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Admin</p>
            <h1 className="text-2xl font-semibold md:text-3xl">Circle Treasury review</h1>
            <p className="mt-1 text-sm text-slate-400">
              Review Circle Treasury requests, approve or reject them, and manually assign account details.
            </p>
          </div>
          <NavLink
            to="/admin/dashboard"
            className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-800"
          >
            Back to dashboard
          </NavLink>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Circle treasury deposited</p>
            <p className="mt-3 text-3xl font-semibold">{nairaFormat(stats?.circle_treasury_deposits)}</p>
            <p className="mt-2 text-[11px] text-slate-500">
              Credited circle inflows recorded separately from platform deposits.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Pending review</p>
            <p className="mt-3 text-3xl font-semibold">{summary.pending}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Pending assignment</p>
            <p className="mt-3 text-3xl font-semibold">{summary.pendingAssignment}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Active</p>
            <p className="mt-3 text-3xl font-semibold">{summary.active}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Rejected</p>
            <p className="mt-3 text-3xl font-semibold">{summary.rejected}</p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.45fr)]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-sm">
            <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Request queue</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Review new requests first, then finish manual assignment for approved circles.
                </p>
              </div>
              <select
                value={activeFilter}
                onChange={(event) => setActiveFilter(event.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
              >
                {FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {error ? (
              <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">
                {error}
              </div>
            ) : null}

            <div className="space-y-3">
              {loading ? (
                <div className="rounded-xl border border-dashed border-slate-700 px-4 py-6 text-center text-sm text-slate-400">
                  Loading Circle Treasury requests...
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 px-4 py-6 text-center text-sm text-slate-400">
                  No Circle Treasury requests match this filter.
                </div>
              ) : (
                filteredRequests.map((request) => {
                  const queueStatus = requestQueueStatus(request)
                  const active = String(request.id) === String(selectedRequestId)
                  return (
                    <button
                      key={request.id}
                      type="button"
                      onClick={() => setSelectedRequestId(String(request.id))}
                      className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                        active
                          ? 'border-sky-400/60 bg-sky-400/10'
                          : 'border-slate-800 bg-slate-950 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-100">
                            {request.circle?.name || `Circle #${request.circle_id}`}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            Requested by {request.requester_name || `User ${request.requester_id}`}
                          </p>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${toneForStatus(queueStatus)}`}>
                          {queueStatus.replaceAll('_', ' ')}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                        <span>{formatMoney(request.expected_monthly_volume_cents)}</span>
                        <span>{request.created_at ? dateFormater(request.created_at) : 'Unknown date'}</span>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-sm">
            {detailLoading ? (
              <div className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-400">
                Loading request detail...
              </div>
            ) : !selectedRequest ? (
              <div className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-400">
                Select a Circle Treasury request to review it.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {selectedRequest.circle?.name || `Circle #${selectedRequest.circle_id}`}
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Requested by {selectedRequest.requester_name || `User ${selectedRequest.requester_id}`}
                    </p>
                  </div>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${toneForStatus(requestQueueStatus(selectedRequest))}`}>
                    {requestQueueStatus(selectedRequest).replaceAll('_', ' ')}
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Purpose</p>
                    <p className="mt-2 text-sm text-slate-100">{selectedRequest.requested_purpose || 'Not provided'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Category</p>
                    <p className="mt-2 text-sm capitalize text-slate-100">{selectedRequest.circle_category || 'other'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Expected monthly volume</p>
                    <p className="mt-2 text-sm text-slate-100">{formatMoney(selectedRequest.expected_monthly_volume_cents)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Members / external senders</p>
                    <p className="mt-2 text-sm text-slate-100">
                      {selectedRequest.expected_member_count || 0} / {selectedRequest.expected_external_sender_count || 0}
                    </p>
                  </div>
                </div>

                <label className="block">
                  <span className="text-xs text-slate-300">Decision note</span>
                  <textarea
                    value={decisionNote}
                    onChange={(event) => setDecisionNote(event.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                    placeholder="Add an internal review note or rejection reason."
                  />
                </label>

                {selectedRequest.status === 'pending' ? (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                    <div className="mb-4">
                      <h3 className="text-base font-semibold">Approve request</h3>
                      <p className="mt-1 text-xs text-slate-400">
                        You can approve now and leave the account pending assignment, or supply manual bank details immediately.
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="text-xs text-slate-300">Account name</span>
                        <input
                          value={assignmentForm.account_name}
                          onChange={(event) => setAssignmentForm((prev) => ({ ...prev, account_name: event.target.value }))}
                          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-300">Account number</span>
                        <input
                          value={assignmentForm.account_number}
                          onChange={(event) => setAssignmentForm((prev) => ({ ...prev, account_number: event.target.value }))}
                          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-300">Bank name</span>
                        <input
                          value={assignmentForm.bank_name}
                          onChange={(event) => setAssignmentForm((prev) => ({ ...prev, bank_name: event.target.value }))}
                          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-300">Bank code</span>
                        <input
                          value={assignmentForm.bank_code}
                          onChange={(event) => setAssignmentForm((prev) => ({ ...prev, bank_code: event.target.value }))}
                          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                        />
                      </label>
                      <label className="block md:col-span-2">
                        <span className="text-xs text-slate-300">Provider reference</span>
                        <input
                          value={assignmentForm.provider_reference}
                          onChange={(event) => setAssignmentForm((prev) => ({ ...prev, provider_reference: event.target.value }))}
                          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                        />
                      </label>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleApprove}
                        disabled={actionLoading}
                        className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-400 disabled:opacity-60"
                      >
                        {actionLoading ? 'Processing...' : 'Approve request'}
                      </button>
                      <button
                        type="button"
                        onClick={handleReject}
                        disabled={actionLoading}
                        className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-5 py-2.5 text-sm font-semibold text-rose-100 transition-colors hover:bg-rose-500/20 disabled:opacity-60"
                      >
                        Reject request
                      </button>
                    </div>
                  </div>
                ) : null}

                {selectedRequest.treasury_account ? (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                    <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-base font-semibold">Manual account assignment</h3>
                        <p className="mt-1 text-xs text-slate-400">
                          Update the assigned Circle Treasury details. The account becomes active when the required manual details are present.
                        </p>
                      </div>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${toneForStatus(selectedRequest.treasury_account.status)}`}>
                        {String(selectedRequest.treasury_account.status || 'pending_assignment').replaceAll('_', ' ')}
                      </span>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="text-xs text-slate-300">Provider</span>
                        <input
                          value={assignmentForm.provider}
                          onChange={(event) => setAssignmentForm((prev) => ({ ...prev, provider: event.target.value }))}
                          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-300">Provider reference</span>
                        <input
                          value={assignmentForm.provider_reference}
                          onChange={(event) => setAssignmentForm((prev) => ({ ...prev, provider_reference: event.target.value }))}
                          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-300">Account name</span>
                        <input
                          value={assignmentForm.account_name}
                          onChange={(event) => setAssignmentForm((prev) => ({ ...prev, account_name: event.target.value }))}
                          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-300">Account number</span>
                        <input
                          value={assignmentForm.account_number}
                          onChange={(event) => setAssignmentForm((prev) => ({ ...prev, account_number: event.target.value }))}
                          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-300">Bank name</span>
                        <input
                          value={assignmentForm.bank_name}
                          onChange={(event) => setAssignmentForm((prev) => ({ ...prev, bank_name: event.target.value }))}
                          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-300">Bank code</span>
                        <input
                          value={assignmentForm.bank_code}
                          onChange={(event) => setAssignmentForm((prev) => ({ ...prev, bank_code: event.target.value }))}
                          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                        />
                      </label>
                    </div>
                    <div className="mt-5">
                      <button
                        type="button"
                        onClick={handleAssignDetails}
                        disabled={actionLoading}
                        className="rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-300 disabled:opacity-60"
                      >
                        {actionLoading ? 'Saving...' : 'Save account details'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

export default CircleTreasuryReview
