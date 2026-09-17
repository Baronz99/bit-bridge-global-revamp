import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getCircleDueObligations,
  getCircleDuePlanSummary,
  getCirclePaymentItems,
  createCircleTreasuryPayout,
  getCircleTreasuryPayouts,
  getCircleWorkspace,
} from '../../../api/circles'
import CircleShell from './CircleShell'
import PaymentItemPreviewList from './PaymentItemPreviewList'
import RecentRecords from './RecentRecords'
import TreasuryCard from './TreasuryCard'
import { formatCircleRoleLabel } from '../roleLabels'
import { nairaToCents } from '../../../utils/currency'
import { setOwnerMode } from '../../../redux/app'
import { isInvestorSandbox } from '../../../config/sandbox'
import { SandboxContextCard } from '../../../components/investorSandbox/SandboxInvestorTour'
import {
  buildMemberDuesLookup,
  formatDateTimeLabel,
  formatMoney,
  formatPeriodCountLabel,
  getCircleBucketLabel,
  getCircleRoleLabel,
  getCircleTitle,
  getContributionStatusMeta,
  getCurrentUserDueSummary,
  getPaymentItemAmountLabel,
  getPaymentItemTitleLabel,
  getRecentRecords,
  normalizePaymentItems,
} from './shared'

const duesBadgeClass = (statusKey) =>
  statusKey === 'paid'
    ? 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
    : 'border border-amber-400/20 bg-amber-400/10 text-amber-100'

const contributionBadgeClass = (tone) =>
  tone === 'emerald'
    ? 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
    : tone === 'amber'
      ? 'border border-amber-400/20 bg-amber-400/10 text-amber-100'
      : 'border border-slate-800 bg-slate-950/60 text-slate-300'

const treasuryStatusLabel = (workspace, pendingPayoutCount) => {
  const treasuryAccount = workspace?.treasury_account || {}
  const status = String(
    treasuryAccount?.status ||
      treasuryAccount?.lifecycle_state ||
      workspace?.treasury_account_status ||
      workspace?.treasury_status ||
      ''
  )
    .trim()
    .toLowerCase()

  if (status === 'active' || status === 'ready' || treasuryAccount?.account_number) {
    return pendingPayoutCount > 0
      ? `${pendingPayoutCount} payout${pendingPayoutCount === 1 ? '' : 's'} pending review`
      : 'Treasury account ready'
  }
  if (status === 'pending_review') return 'Treasury request pending review'
  if (status === 'pending_assignment') return 'Treasury request pending assignment'
  if (status === 'rejected') return 'Treasury request rejected'
  if (status === 'suspended') return 'Treasury is suspended'
  if (status === 'not_requested' || !status) return 'Treasury not requested yet'
  return 'Treasury setup in progress'
}

const treasuryHelperLabel = (workspace, pendingPayoutCount) => {
  const treasuryAccount = workspace?.treasury_account || {}
  const status = String(
    treasuryAccount?.status ||
      treasuryAccount?.lifecycle_state ||
      workspace?.treasury_account_status ||
      workspace?.treasury_status ||
      ''
  )
    .trim()
    .toLowerCase()

  if (status === 'active' || status === 'ready' || treasuryAccount?.account_number) {
    return pendingPayoutCount > 0
      ? 'Open Treasury to review outgoing requests and proof.'
      : 'Shared treasury balance is ready for contributions.'
  }
  if (status === 'pending_review') return 'The treasury request is being reviewed.'
  if (status === 'pending_assignment') return 'Treasury details are being assigned.'
  if (status === 'rejected') return 'Update the request and try again.'
  if (status === 'suspended') return 'Treasury activity is temporarily paused.'
  return 'Request treasury access before members can contribute through the shared balance.'
}

const pendingApprovalCount = (workspace) => {
  const approvals = workspace?.approvals || {}
  const items = Array.isArray(approvals?.items)
    ? approvals.items
    : Array.isArray(approvals?.requests)
      ? approvals.requests
      : []

  const counted = items.filter((item) => {
    const state = String(item?.lifecycle_state || item?.status || item?.approval_state || 'pending').toLowerCase()
    return !['approved', 'rejected', 'successful', 'failed', 'completed', 'cancelled', 'closed'].includes(state)
  }).length

  return Number(
    approvals?.pending_count ??
      approvals?.pending_approval_count ??
      approvals?.pending_requests_count ??
      counted
  ) || counted
}

const pendingPayoutCount = (workspace) => {
  const treasury = workspace?.treasury_account || {}
  return (
    Number(
      treasury?.pending_payout_count ??
        treasury?.pending_payouts_count ??
        workspace?.pending_treasury_payout_count ??
        workspace?.pending_payout_count ??
        0
    ) || 0
  )
}

const memberDisplayName = (member) =>
  String(member?.display_name || member?.user?.display_name || member?.user?.email || 'Member').trim()

const memberRoleLabel = (member) =>
  formatCircleRoleLabel(member?.role || member?.membership_role || member?.current_user_role || 'member')

const CircleHomePage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { businessEntities = [] } = useSelector((state) => state.app || {})
  const [workspace, setWorkspace] = useState(null)
  const [paymentItems, setPaymentItems] = useState([])
  const [dueObligations, setDueObligations] = useState([])
  const [dueSummary, setDueSummary] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payouts, setPayouts] = useState([])
  const [showPayout, setShowPayout] = useState(false)
  const [payout, setPayout] = useState({ amount: '', beneficiary_name: '', beneficiary_account_number: '', beneficiary_bank_name: '', beneficiary_bank_code: '', note: '', transaction_pin: '' })
  const [payoutError, setPayoutError] = useState('')
  const [payoutSubmitting, setPayoutSubmitting] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      getCircleWorkspace(id),
      getCirclePaymentItems(id),
      getCircleDueObligations(id).catch(() => null),
      getCircleDuePlanSummary(id).catch(() => null),
      getCircleTreasuryPayouts(id).catch(() => null),
    ])
      .then(([workspaceResponse, itemResponse, obligationsResponse, summaryResponse, payoutResponse]) => {
        if (cancelled) return
        setWorkspace(workspaceResponse?.data || {})
        setPaymentItems(normalizePaymentItems(itemResponse))
        setDueObligations(Array.isArray(obligationsResponse?.data) ? obligationsResponse.data : [])
        setDueSummary(summaryResponse?.data || {})
        setPayouts(Array.isArray(payoutResponse?.data?.data) ? payoutResponse.data.data : [])
      })
      .catch(() => {
        if (cancelled) return
        setError('Unable to load this circle right now.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const submitPayout = async (event) => {
    event.preventDefault()
    setPayoutError('')
    const amountCents = nairaToCents(payout.amount)
    if (amountCents == null) return setPayoutError('Enter a valid payout amount.')
    if (!payout.beneficiary_name || !payout.beneficiary_account_number || !payout.beneficiary_bank_name || !payout.beneficiary_bank_code) return setPayoutError('Complete the beneficiary bank details.')
    if (!/^\d{4}$/.test(payout.transaction_pin)) return setPayoutError('Enter your 4-digit transaction PIN.')
    setPayoutSubmitting(true)
    try {
      const response = await createCircleTreasuryPayout(id, { amount_cents: amountCents, beneficiary_name: payout.beneficiary_name, beneficiary_account_number: payout.beneficiary_account_number, beneficiary_bank_name: payout.beneficiary_bank_name, beneficiary_bank_code: payout.beneficiary_bank_code, note: payout.note, transaction_pin: payout.transaction_pin })
      const created = response?.data?.data
      if (created) setPayouts((items) => [created, ...items])
      setShowPayout(false)
      setPayout({ amount: '', beneficiary_name: '', beneficiary_account_number: '', beneficiary_bank_name: '', beneficiary_bank_code: '', note: '', transaction_pin: '' })
      const refreshed = await getCircleWorkspace(id)
      setWorkspace(refreshed?.data || workspace)
    } catch (err) {
      setPayoutError(err?.response?.data?.message || 'Unable to submit treasury payout.')
    } finally { setPayoutSubmitting(false) }
  }

  const records = useMemo(() => getRecentRecords(workspace), [workspace])
  const previewItems = useMemo(
    () => paymentItems.filter((item) => !item?.support_fallback).slice(0, 5),
    [paymentItems]
  )
  const collectionItems = useMemo(
    () =>
      paymentItems.filter(
        (item) => item?.linked_reference_type === 'CircleActivity' || String(item?.type || '').toLowerCase() === 'activity_goal'
      ),
    [paymentItems]
  )
  const memberItems = useMemo(() => (Array.isArray(workspace?.members) ? workspace.members.slice(0, 4) : []), [workspace])
  const dueStatusPreview = useMemo(() => {
    const members = Array.isArray(workspace?.members) ? workspace.members : []
    const lookup = buildMemberDuesLookup(members, dueObligations, workspace?.monthly_due_plan)
    return members
      .map((member) => ({
        member,
        dues: lookup[String(member?.id || member?.user?.id || '')],
      }))
      .filter((entry) => entry.dues)
      .slice(0, 5)
  }, [dueObligations, workspace])
  const currentUserSummary = useMemo(() => getCurrentUserDueSummary(dueSummary), [dueSummary])
  const duePlanConfigured = Boolean(workspace?.monthly_due_plan || dueSummary?.current_period)
  const contributionStatus = useMemo(
    () =>
      getContributionStatusMeta({
        status: currentUserSummary?.current_period_status,
        duePlanConfigured,
      }),
    [currentUserSummary?.current_period_status, duePlanConfigured]
  )
  const dueCadence = workspace?.monthly_due_plan?.cadence || dueSummary?.cadence || 'monthly'
  const duesOutstandingCents = Number(currentUserSummary?.total_outstanding_amount_cents || 0)
  const approvalsPending = pendingApprovalCount(workspace)
  const payoutsPending = pendingPayoutCount(workspace)
  const treasuryStatus = treasuryStatusLabel(workspace, payoutsPending)
  const treasuryHelp = treasuryHelperLabel(workspace, payoutsPending)
  const canPayDues = Boolean(workspace?.permissions?.can_pay_dues !== false)
  const canApproveWithdrawals = Boolean(workspace?.permissions?.can_approve_withdrawals)
  const canManageGovernance = Boolean(
    workspace?.permissions?.can_manage_governance ||
      workspace?.permissions?.can_manage_settings ||
      workspace?.permissions?.can_assign_admin
  )
  const canInviteMembers = Boolean(workspace?.permissions?.can_invite_members || workspace?.permissions?.can_manage_members)
  const governanceComplete = Boolean(
    workspace?.governance_summary?.governance_setup_completed ||
      workspace?.settings?.governance_setup_completed ||
      workspace?.governance_setup_completed
  )
  const memberCount = Number(
    workspace?.member_count || workspace?.members_count || (Array.isArray(workspace?.members) ? workspace.members.length : 0)
  )
  const participantCount = Number(workspace?.participant_count || 0)
  const workspaceMemberCount = Number(workspace?.workspace_member_count || memberCount || 0)
  const investorBusiness = businessEntities.find((business) => /greenfield services/i.test(String(business?.name || ''))) || businessEntities[0]
  const openInvestorBusiness = () => {
    if (!investorBusiness?.id) return navigate('/dashboard/business')
    dispatch(setOwnerMode({ mode: 'business', businessEntityId: investorBusiness.id }))
    navigate('/dashboard/business')
  }
  const dueCounts = dueSummary?.counts || {}
  const monthlyDuesCents = Number(
    workspace?.monthly_due_plan?.amount_cents ?? dueSummary?.amount_cents ?? dueSummary?.due_plan?.amount_cents ?? 0
  ) || 0

  const actionRequired = useMemo(() => {
    const dueLabel = duesOutstandingCents > 0 ? formatMoney(duesOutstandingCents) : ''
    if (duesOutstandingCents > 0 && canPayDues) {
      return {
        title: 'Pay Dues',
        helper: `You have ${dueLabel} outstanding for the current cycle.`,
        primaryLabel: 'Pay Dues',
        primaryAction: () => navigate(`/dashboard/shared-groups/${id}/pay`),
        secondaryLabel: 'Open Activity',
        secondaryAction: () => navigate(`/dashboard/shared-groups/${id}/timeline`),
        tone: 'amber',
      }
    }

    if (approvalsPending > 0 && canApproveWithdrawals) {
      return {
        title: 'Review Approval',
        helper: `${approvalsPending} approval${approvalsPending === 1 ? '' : 's'} are waiting for review.`,
        primaryLabel: 'Open Admin',
        primaryAction: () => navigate(`/dashboard/shared-groups/${id}/manage`),
        secondaryLabel: 'Open Activity',
        secondaryAction: () => navigate(`/dashboard/shared-groups/${id}/timeline`),
        tone: 'sky',
      }
    }

    if (payoutsPending > 0 && canApproveWithdrawals) {
      return {
        title: 'Review Treasury Payouts',
        helper: `${payoutsPending} treasury payout${payoutsPending === 1 ? '' : 's'} need review.`,
        primaryLabel: 'Open Admin',
        primaryAction: () => navigate(`/dashboard/shared-groups/${id}/manage`),
        secondaryLabel: 'Open Activity',
        secondaryAction: () => navigate(`/dashboard/shared-groups/${id}/timeline`),
        tone: 'sky',
      }
    }

    const treasuryAccount = workspace?.treasury_account || {}
    const treasuryState = String(
      treasuryAccount?.status ||
        treasuryAccount?.lifecycle_state ||
        workspace?.treasury_account_status ||
        workspace?.treasury_status ||
        ''
    )
      .trim()
      .toLowerCase()
    const treasuryNeedsSetup = !treasuryState || ['not_requested', 'pending_review', 'pending_assignment', 'rejected', 'suspended'].includes(treasuryState)

    if (treasuryNeedsSetup && canManageGovernance) {
      return {
        title: treasuryState ? 'Complete Treasury' : 'Request Treasury',
        helper: 'Treasury access is not ready yet.',
        primaryLabel: 'Open Admin',
        primaryAction: () => navigate(`/dashboard/shared-groups/${id}/manage`),
        secondaryLabel: 'Open Activity',
        secondaryAction: () => navigate(`/dashboard/shared-groups/${id}/timeline`),
        tone: 'amber',
      }
    }

    if (!governanceComplete && canManageGovernance) {
      return {
        title: 'Complete Governance',
        helper: 'Governance setup is not finished yet.',
        primaryLabel: 'Open Admin',
        primaryAction: () => navigate(`/dashboard/shared-groups/${id}/manage`),
        secondaryLabel: 'Open Activity',
        secondaryAction: () => navigate(`/dashboard/shared-groups/${id}/timeline`),
        tone: 'amber',
      }
    }

    if (memberCount <= 1 && canInviteMembers) {
      return {
        title: 'Invite Members',
        helper: 'This circle still needs more members.',
        primaryLabel: 'Open Admin',
        primaryAction: () => navigate(`/dashboard/shared-groups/${id}/manage`),
        secondaryLabel: 'Open Activity',
        secondaryAction: () => navigate(`/dashboard/shared-groups/${id}/timeline`),
        tone: 'emerald',
      }
    }

    if (records.length > 0) {
      return {
        title: 'Review Activity / Proof',
        helper: 'Recent activity is available with proof links.',
        primaryLabel: 'Open Activity',
        primaryAction: () => navigate(`/dashboard/shared-groups/${id}/timeline`),
        secondaryLabel: 'Open Contributions',
        secondaryAction: () => navigate(`/dashboard/shared-groups/${id}/pay`),
        tone: 'sky',
      }
    }

    return {
      title: 'All caught up',
      helper: 'Treasury, dues, collections, and activity are up to date.',
      primaryLabel: null,
      primaryAction: null,
      secondaryLabel: null,
      secondaryAction: null,
      tone: 'emerald',
    }
  }, [
    approvalsPending,
    canApproveWithdrawals,
    canInviteMembers,
    canManageGovernance,
    canPayDues,
    duesOutstandingCents,
    governanceComplete,
    id,
    memberCount,
    navigate,
    payoutsPending,
    records.length,
    workspace?.treasury_account,
    workspace?.treasury_account_status,
    workspace?.treasury_status,
  ])

  if (loading) {
    return <div className="px-6 py-10 text-sm text-slate-400">Loading circle...</div>
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
    >
      <section className={`rounded-[28px] border px-5 py-5 ${actionRequired.tone === 'emerald' ? 'border-emerald-400/20 bg-emerald-500/10' : actionRequired.tone === 'sky' ? 'border-sky-400/20 bg-sky-500/10' : 'border-amber-400/20 bg-amber-500/10'}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Action Required</p>
            <h2 className="mt-2 text-xl font-semibold text-white">{actionRequired.title}</h2>
            <p className="mt-2 text-sm text-slate-300">{actionRequired.helper}</p>
          </div>
          {actionRequired.primaryLabel ? (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={actionRequired.primaryAction}
                className="rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                {actionRequired.primaryLabel}
              </button>
              {actionRequired.secondaryLabel ? (
                <button
                  type="button"
                  onClick={actionRequired.secondaryAction}
                  className="rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold text-white transition hover:border-slate-600"
                >
                  {actionRequired.secondaryLabel}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {isInvestorSandbox ? (
        <SandboxContextCard
          eyebrow="02 · Group Finance"
          title="A community treasury with structure and control"
          action={openInvestorBusiness}
          actionLabel="Next: Explore Business →"
          metrics={[
            ...(participantCount > 0 ? [{ label: 'Participants', value: participantCount, helper: 'Operational organization scale' }] : []),
            ...(workspaceMemberCount > 0 ? [{ label: 'Workspace access', value: workspaceMemberCount, helper: workspaceMemberCount === 1 ? 'Workspace administrator' : 'Workspace members' }] : []),
            ...(monthlyDuesCents > 0 ? [{ label: 'Monthly dues', value: formatMoney(monthlyDuesCents), helper: 'Recurring obligation plan' }] : []),
            ...(workspace?.balance_cents != null ? [{ label: 'Shared treasury', value: formatMoney(workspace.balance_cents), helper: 'Server-authoritative balance' }] : []),
            ...(dueCounts.total != null ? [{ label: 'Dues obligations', value: dueCounts.total, helper: `${dueCounts.paid_current || 0} paid · ${dueCounts.pending || 0} pending · ${dueCounts.overdue || 0} overdue` }] : []),
          ]}
        >
          Greenfield Residents Association demonstrates how a community can replace fragmented bank transfers, spreadsheets and manual reconciliation with structured collections, recurring obligations, shared treasury, governance and payouts. These metrics come from the live Circle workspace and dues contracts.
        </SandboxContextCard>
      ) : null}

      <TreasuryCard
        balanceCents={workspace?.balance_cents || 0}
        onPay={() => setShowPayout(true)}
        statusLabel={treasuryStatus}
        helperLabel={treasuryHelp}
      />

      {showPayout ? <section className="rounded-[28px] border border-cyan-400/20 bg-[#050b1b] px-5 py-5">
        <div className="flex items-center justify-between"><div><p className="text-[11px] uppercase tracking-[0.24em] text-cyan-300">Treasury payout</p><h2 className="mt-2 text-lg font-semibold text-white">Send from Circle treasury</h2></div><button type="button" onClick={() => setShowPayout(false)} className="text-sm text-slate-400">Close</button></div>
        <form onSubmit={submitPayout} className="mt-4 grid gap-3 md:grid-cols-2">
          {['amount','beneficiary_name','beneficiary_account_number','beneficiary_bank_name','beneficiary_bank_code','note'].map((name) => <input key={name} value={payout[name]} onChange={(e) => setPayout((p) => ({ ...p, [name]: e.target.value }))} placeholder={name === 'amount' ? 'Amount (NGN)' : name.replaceAll('_',' ')} inputMode={name === 'amount' || name.includes('account') || name.includes('code') ? 'numeric' : undefined} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-white" />)}
          <input value={payout.transaction_pin} onChange={(e) => setPayout((p) => ({ ...p, transaction_pin: e.target.value.replace(/\D/g,'').slice(0,4) }))} placeholder="Transaction PIN" type="password" inputMode="numeric" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-white" />
          {payoutError ? <p className="md:col-span-2 text-sm text-rose-300">{payoutError}</p> : null}
          <button disabled={payoutSubmitting} className="md:col-span-2 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60">{payoutSubmitting ? 'Submitting...' : 'Submit treasury payout'}</button>
        </form>
      </section> : null}

      {payouts.length ? <section className="rounded-[28px] border border-slate-900 bg-[#050b1b] px-5 py-5"><p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Treasury payout activity</p><div className="mt-3 space-y-2">{payouts.slice(0,5).map((item) => <div key={item.id || item.reference} className="flex items-center justify-between rounded-xl border border-slate-900 bg-slate-950/60 px-3 py-3 text-sm"><span className="text-slate-200">{item.beneficiary_name || item.destination?.account_name || 'Bank payout'}</span><span className="text-cyan-200">{String(item.lifecycle_state || item.status || 'pending').replaceAll('_',' ')}</span></div>)}</div></section> : null}

      <section className="rounded-[28px] border border-slate-900 bg-[#050b1b] px-5 py-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Dues</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Current dues status</h2>
          </div>
          <span className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-300">
            {contributionStatus.label}
          </span>
        </div>
        <div className="mt-4 flex items-start justify-between gap-3 rounded-2xl border border-slate-900 bg-slate-950/60 px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Current period</p>
            <p className="mt-2 text-base font-semibold text-white">{contributionStatus.label}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${contributionBadgeClass(contributionStatus.tone)}`}>
            {contributionStatus.label}
          </span>
        </div>
        {!duePlanConfigured ? (
          <p className="mt-3 text-sm text-slate-400">
            This circle has no dues plan yet. Treasury contributions and collections stay optional.
          </p>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-900 bg-slate-950/60 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Outstanding amount</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {formatMoney(currentUserSummary?.total_outstanding_amount_cents || 0)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-900 bg-slate-950/60 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Periods owed</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {formatPeriodCountLabel(currentUserSummary?.periods_owed_count || 0, dueCadence)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-900 bg-slate-950/60 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Prepaid</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {formatPeriodCountLabel(currentUserSummary?.prepaid_periods_count || 0, dueCadence)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-900 bg-slate-950/60 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Last paid</p>
            <p className="mt-2 text-sm font-semibold text-white">
              {formatDateTimeLabel(currentUserSummary?.last_paid_at) || 'No dues payment yet'}
            </p>
          </div>
        </div>
        <div className="mt-5 rounded-2xl border border-slate-900 bg-slate-950/60 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Recent dues activity</p>
          <div className="mt-3 space-y-3">
            {dueStatusPreview.length ? (
              dueStatusPreview.map(({ member, dues }) => (
                <div
                  key={String(member?.id || member?.user?.id || member?.user?.email || 'member')}
                  className="rounded-2xl border border-slate-900 bg-[#050b1b] px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {memberDisplayName(member)}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {dues.periodsPaidLabel} - {dues.outstandingAmountLabel} outstanding
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${duesBadgeClass(
                        dues.statusKey
                      )}`}
                    >
                      {dues.statusLabel}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-4 text-sm text-slate-400">
                {duePlanConfigured ? 'No current-cycle dues status is available yet.' : 'No dues plan is configured yet.'}
              </div>
            )}
          </div>
        </div>
      </section>

      {collectionItems.length ? (
        <section className="rounded-[28px] border border-slate-900 bg-[#050b1b] px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Collections</p>
              <h2 className="mt-2 text-lg font-semibold text-white">Purpose-based collections</h2>
            </div>
            <span className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-300">
              {collectionItems.length} open
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {collectionItems.slice(0, 4).map((item) => (
              <div
                key={String(item.key || item.id)}
                className="rounded-2xl border border-slate-900 bg-slate-950/60 px-4 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{getPaymentItemTitleLabel(item)}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {item?.deadline_at ? `Closes ${formatDateTimeLabel(item.deadline_at)}` : 'Open collection'}
                    </p>
                  </div>
                  <div className="text-right text-sm font-medium text-slate-200">
                    {getPaymentItemAmountLabel(item)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-[28px] border border-slate-900 bg-[#050b1b] px-5 py-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Workspace access</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Who is in this circle</h2>
          </div>
          <span className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-300">
            {workspaceMemberCount} workspace member{workspaceMemberCount === 1 ? '' : 's'}
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {memberItems.length ? (
            memberItems.map((member) => (
              <div
                key={String(member?.id || member?.user?.id || member?.user?.email || memberDisplayName(member))}
                className="rounded-2xl border border-slate-900 bg-slate-950/60 px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{memberDisplayName(member)}</p>
                    <p className="mt-1 text-xs text-slate-400">{memberRoleLabel(member)}</p>
                  </div>
                  <span className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-300">
                    Member
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-4 text-sm text-slate-400">
              No members yet. Invite people to start this circle.
            </div>
          )}
        </div>
      </section>

      <RecentRecords records={records} emptyLabel="No activity yet." />

      <PaymentItemPreviewList items={previewItems} onOpenPay={() => navigate(`/dashboard/shared-groups/${id}/pay`)} />
    </CircleShell>
  )
}

export default CircleHomePage
