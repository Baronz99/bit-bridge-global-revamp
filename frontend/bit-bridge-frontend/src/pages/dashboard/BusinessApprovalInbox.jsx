import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import AppModal from '../../components/modal/Modal'
import useSelectedBusiness from '../../hooks/useSelectedBusiness'
import useBusinessDashboardPresentation from '../../hooks/useBusinessDashboardPresentation'
import BusinessWorkspaceRequired from '../../components/business/BusinessWorkspaceRequired'
import BusinessWorkspaceNav from '../../components/business/BusinessWorkspaceNav'
import {
  approveBusinessApprovalRequest,
  getBusinessApprovalRequests,
  rejectBusinessApprovalRequest,
} from '../../api/business'
import { useSelector } from 'react-redux'

const cardClass =
  'rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.22)]'
const skeletonClass = 'animate-pulse rounded-2xl bg-slate-800/70'

const formatNgn = (value = 0) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

const formatDate = (value) => {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return date.toLocaleString()
}

const ApprovalInboxSkeleton = () => (
  <div className="space-y-4">
    {[1, 2, 3].map((item) => (
      <div key={item} className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="w-full max-w-[26rem] space-y-3">
            <div className={`h-4 w-32 ${skeletonClass}`} />
            <div className={`h-3 w-48 ${skeletonClass}`} />
            <div className={`h-3 w-28 ${skeletonClass}`} />
            <div className="flex gap-2">
              <div className={`h-7 w-20 ${skeletonClass}`} />
              <div className={`h-7 w-24 ${skeletonClass}`} />
            </div>
          </div>
          <div className="w-full max-w-[14rem] space-y-3 xl:text-right">
            <div className={`h-3 w-full ${skeletonClass}`} />
            <div className="flex gap-3 xl:justify-end">
              <div className={`h-10 w-24 ${skeletonClass}`} />
              <div className={`h-10 w-24 ${skeletonClass}`} />
            </div>
          </div>
        </div>
      </div>
    ))}
  </div>
)

const BusinessApprovalInbox = () => {
  const { ownerMode, selectedBusiness } = useSelectedBusiness()
  const {
    loading: accountLoading,
    currentUserRole,
    isLive,
    permissions,
    hero,
    navigationItems,
  } = useBusinessDashboardPresentation(selectedBusiness?.id)
  const { user } = useSelector((state) => state.auth)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [requests, setRequests] = useState([])
  const [pendingActionId, setPendingActionId] = useState(null)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [decisionIntent, setDecisionIntent] = useState(null)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    let active = true

    const loadInbox = async () => {
      if (!selectedBusiness?.id) {
        setLoading(false)
        return
      }

      setLoading(true)
      setErrorMessage('')
      try {
        const requestsRes = await getBusinessApprovalRequests(selectedBusiness.id, { status: 'pending' }).catch(() => null)

        if (!active) return
        setRequests(Array.isArray(requestsRes?.data?.data) ? requestsRes.data.data : [])
      } catch (error) {
        if (!active) return
        const message = error?.response?.data?.message || 'Unable to load pending approvals right now.'
        setErrorMessage(message)
        toast.error(message)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadInbox()
    return () => {
      active = false
    }
  }, [selectedBusiness?.id, reloadTick])

  const currentRole = currentUserRole || null
  const canReviewApprovals = Boolean(permissions?.canReviewApprovals)

  const canActOnRequest = (request) => {
    if (!request) return false
    if (request.status !== 'pending') return false
    if (!request.eligible_for_current_user) return false
    if (Number(request?.initiator?.id) === Number(user?.id)) return false
    return ['owner', 'admin', 'approver'].includes(String(currentRole || '').toLowerCase())
  }

  const sortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [requests])

  const retryLoad = () => {
    if (!selectedBusiness?.id) return
    setReloadTick((tick) => tick + 1)
  }

  const applyDecision = async (request, decision) => {
    if (!selectedBusiness?.id || !request?.id) return

    const previous = requests
    setPendingActionId(request.id)
    setRequests((current) =>
      current.map((item) =>
        item.id === request.id
          ? {
              ...item,
              status: decision === 'approve' ? 'approved' : 'rejected',
            }
          : item
      )
    )

    try {
      const response =
        decision === 'approve'
          ? await approveBusinessApprovalRequest(selectedBusiness.id, request.id)
          : await rejectBusinessApprovalRequest(selectedBusiness.id, request.id)

      const updated = response?.data?.data
      if (updated) {
        setRequests((current) =>
          current.map((item) => (item.id === request.id ? { ...item, ...updated } : item))
        )
      }
      setSelectedRequest(null)
      setDecisionIntent(null)
      toast.success(decision === 'approve' ? 'Approval recorded.' : 'Rejection recorded.')
    } catch (error) {
      setRequests(previous)
      const message = error?.response?.data?.message || 'Unable to update approval request.'
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setPendingActionId(null)
    }
  }

  if (ownerMode !== 'business') {
    return <Navigate to="/dashboard/home" replace />
  }

  if (!selectedBusiness) {
    return <BusinessWorkspaceRequired message="Select a business workspace from the switcher or return to the setup hub to review approvals." />
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <section className="rounded-[28px] border border-slate-800 bg-[linear-gradient(135deg,rgba(2,6,23,0.96),rgba(15,23,42,0.94))] p-5 md:p-7">
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Approval Inbox</p>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-white">{selectedBusiness.name}</h1>
              <p className="mt-2 text-sm text-slate-400 max-w-2xl">
                Review pending business transfer approvals. Only eligible actors can approve or reject.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-950/45 px-4 py-3 text-sm text-slate-300">
              Current role: <span className="font-semibold text-white">{currentRole || 'member'}</span>
            </div>
          </div>
        </section>

        <BusinessWorkspaceNav pendingCount={requests.length} visibleNavigationItems={navigationItems} />

        <section className={cardClass}>
          {errorMessage ? (
            <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-rose-100">Approval inbox unavailable</div>
                  <div className="mt-1 text-sm text-rose-200/90">{errorMessage}</div>
                </div>
                <button
                  type="button"
                  onClick={retryLoad}
                  className="rounded-xl border border-rose-300/30 px-4 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-500/10 transition"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : null}

          {accountLoading || loading ? (
            <ApprovalInboxSkeleton />
          ) : !isLive ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-5">
              <div className="text-sm font-semibold text-amber-100">Approvals are not available yet.</div>
              <div className="mt-2 text-sm text-amber-50/90">
                Approval workflows unlock after the business account becomes operational.
              </div>
              {hero?.primaryAction ? (
                <div className="mt-4">
                  <Link
                    to={hero.primaryAction.route}
                    className="inline-flex rounded-2xl bg-[#FFB05A] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#ffc27d]"
                  >
                    {hero.primaryAction.label}
                  </Link>
                </div>
              ) : null}
            </div>
          ) : sortedRequests.length ? (
            <div className="space-y-4">
              {sortedRequests.map((request) => {
                const busy = pendingActionId === request.id
                const canAct = canActOnRequest(request)
                return (
                  <div
                    key={request.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-white">{formatNgn(request.amount)}</div>
                          <span className="rounded-full border border-slate-700 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300">
                            {request.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">
                          Initiated by {request?.initiator?.email || 'Unknown user'}
                        </div>
                        <div className="text-xs text-slate-500">Created {formatDate(request.created_at)}</div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {Array.isArray(request.required_roles) &&
                            request.required_roles.map((role) => (
                              <span
                                key={role}
                                className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-slate-200"
                              >
                                {role}
                              </span>
                            ))}
                        </div>
                      </div>

                      <div className="flex flex-col items-start gap-3 xl:items-end">
                        <div className="text-xs text-slate-500">Reference: {request.reference}</div>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRequest(request)
                              setDecisionIntent(null)
                            }}
                            className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white"
                          >
                            Review
                          </button>
                          {canAct ? (
                            <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                setSelectedRequest(request)
                                setDecisionIntent('approve')
                              }}
                              className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {busy ? 'Applying...' : 'Approve'}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                setSelectedRequest(request)
                                setDecisionIntent('reject')
                              }}
                              className="rounded-xl border border-rose-500/40 px-4 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Reject
                            </button>
                            </>
                          ) : null}
                        </div>
                        {!canReviewApprovals ? (
                          <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-2 text-xs text-slate-400">
                            Your role can view requests but can’t approve or reject them.
                          </div>
                        ) : !canAct ? (
                          <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-2 text-xs text-slate-400">
                            Read-only for your role or initiator context.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-5">
              <div className="text-sm font-medium text-slate-200">No pending approvals right now.</div>
              <div className="mt-2 text-sm text-slate-400">
                New business transfer approvals will appear here when the active policy requires review.
              </div>
            </div>
          )}
        </section>
      </div>

      <AppModal
        title={decisionIntent ? `${decisionIntent === 'approve' ? 'Approve' : 'Reject'} transfer request` : 'Approval details'}
        isModalOpen={Boolean(selectedRequest)}
        handleCancel={() => {
          if (pendingActionId) return
          setSelectedRequest(null)
          setDecisionIntent(null)
        }}
      >
        {selectedRequest ? (
          <div className="space-y-5 text-slate-200">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Amount</div>
              <div className="mt-2 text-2xl font-semibold text-white">{formatNgn(selectedRequest.amount)}</div>
            </div>

            <div className="grid gap-3 text-sm md:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Initiator</div>
                <div className="mt-2 text-white">{selectedRequest?.initiator?.email || 'Unknown user'}</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Created</div>
                <div className="mt-2 text-white">{formatDate(selectedRequest.created_at)}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4 text-sm">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Narration</div>
              <div className="mt-2 text-white">
                {selectedRequest?.metadata?.transfer_payload?.description ||
                  selectedRequest?.metadata?.transfer_payload?.narration ||
                  'No narration provided'}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4 text-sm">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Destination</div>
              <div className="mt-2 space-y-2 text-slate-300">
                <div className="flex items-center justify-between gap-3">
                  <span>Account name</span>
                  <span className="text-white">{selectedRequest?.metadata?.transfer_payload?.account_name || 'Not available'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Account number</span>
                  <span className="text-white">{selectedRequest?.metadata?.transfer_payload?.account_number || 'Not available'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Bank</span>
                  <span className="text-white">{selectedRequest?.metadata?.transfer_payload?.bank || 'Not available'}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4 text-sm">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Required roles</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {Array.isArray(selectedRequest.required_roles) && selectedRequest.required_roles.length ? (
                  selectedRequest.required_roles.map((role) => (
                    <span
                      key={role}
                      className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-slate-200"
                    >
                      {role}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400">No role restrictions recorded.</span>
                )}
              </div>
            </div>

            {decisionIntent ? (
              <div className={`rounded-2xl border px-4 py-4 text-sm ${
                decisionIntent === 'approve'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-100'
              }`}>
                {decisionIntent === 'approve'
                  ? 'Confirm approval to let the transfer continue through the business control flow.'
                  : 'Confirm rejection to stop this transfer before funds move.'}
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-3">
              <Link
                to={`/dashboard/business/transfers/${encodeURIComponent(selectedRequest.reference)}`}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white"
              >
                View transfer
              </Link>
              <Link
                to={`/dashboard/business/receipts/${encodeURIComponent(selectedRequest.reference)}`}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white"
              >
                View receipt
              </Link>
              <button
                type="button"
                onClick={() => {
                  if (pendingActionId) return
                  setSelectedRequest(null)
                  setDecisionIntent(null)
                }}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white"
              >
                Close
              </button>
              {decisionIntent ? (
                <button
                  type="button"
                  disabled={pendingActionId === selectedRequest.id}
                  onClick={() => applyDecision(selectedRequest, decisionIntent)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
                    decisionIntent === 'approve'
                      ? 'bg-emerald-400 text-black hover:bg-emerald-300'
                      : 'border border-rose-500/40 text-rose-200 hover:bg-rose-500/10'
                  }`}
                >
                  {pendingActionId === selectedRequest.id
                    ? decisionIntent === 'approve'
                      ? 'Approving...'
                      : 'Rejecting...'
                    : decisionIntent === 'approve'
                    ? 'Confirm approval'
                    : 'Confirm rejection'}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </AppModal>
    </div>
  )
}

export default BusinessApprovalInbox

