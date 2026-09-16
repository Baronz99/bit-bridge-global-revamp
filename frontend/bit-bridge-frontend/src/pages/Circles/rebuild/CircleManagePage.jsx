import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  approveCircleApprovalRequest,
  createCircleActivity,
  createCircleDuePlan,
  getCircleDueObligations,
  getCircleDuePlan,
  getCirclePaymentItems,
  getCircleSettings,
  getCircleWorkspace,
  inviteCircleMember,
  rejectCircleApprovalRequest,
  updateCircleActivity,
  updateCircleDuePlan,
  updateCircleSettings,
} from '../../../api/circles'
import CircleShell from './CircleShell'
import {
  buildMemberDuesLookup,
  formatMoney,
  getCircleBucketLabel,
  getCircleRoleLabel,
  getCircleTitle,
  getPaymentItemAmountLabel,
  normalizePaymentItems,
} from './shared'
import { formatCircleRoleLabel } from '../roleLabels'

const PAYMENT_TEMPLATES_BY_BUCKET = {
  clubs_teams: [
    { key: 'monthly_dues', title: 'Monthly Dues', setup_type: 'recurring', cadence: 'monthly' },
    { key: 'match_fee', title: 'Match Fee', setup_type: 'activity', contribution_frequency: 'one_time' },
    { key: 'jersey', title: 'Jersey', setup_type: 'activity', contribution_frequency: 'one_time' },
    { key: 'general_support', title: 'Treasury Contribution', setup_type: 'activity', contribution_frequency: 'one_time' },
  ],
  estates_communities: [
    { key: 'security_levy', title: 'Security Levy', setup_type: 'recurring', cadence: 'monthly' },
    { key: 'utility_bill', title: 'Utility Bill', setup_type: 'activity', contribution_frequency: 'monthly' },
    { key: 'maintenance_levy', title: 'Maintenance Levy', setup_type: 'activity', contribution_frequency: 'one_time' },
    { key: 'emergency_support', title: 'Emergency Support', setup_type: 'activity', contribution_frequency: 'one_time' },
  ],
  families: [
    { key: 'welfare_support', title: 'Welfare Support', setup_type: 'activity', contribution_frequency: 'monthly' },
    { key: 'event_fund', title: 'Event Fund', setup_type: 'activity', contribution_frequency: 'one_time' },
    { key: 'emergency_contribution', title: 'Emergency Contribution', setup_type: 'activity', contribution_frequency: 'one_time' },
  ],
  associations: [
    { key: 'membership_dues', title: 'Membership Dues', setup_type: 'recurring', cadence: 'monthly' },
    { key: 'event_contribution', title: 'Event Contribution', setup_type: 'activity', contribution_frequency: 'one_time' },
    { key: 'penalty_fee', title: 'Penalty Fee', setup_type: 'fine', disabled: true },
  ],
  cooperatives: [
    { key: 'savings_contribution', title: 'Savings Contribution', setup_type: 'recurring', cadence: 'monthly' },
    { key: 'special_contribution', title: 'Special Contribution', setup_type: 'activity', contribution_frequency: 'one_time' },
  ],
}

const DUE_ROLE_OPTIONS = [
  { value: 'member', label: 'Members' },
  { value: 'treasurer', label: 'Treasurers' },
  { value: 'admin', label: 'Admins' },
]

const DUE_SCOPE_OPTIONS = [
  { value: 'everyone', label: 'Everyone in this Circle' },
  { value: 'members_only', label: 'Members only' },
  { value: 'members_admins', label: 'Members + Admins' },
  { value: 'custom_roles', label: 'Choose specific roles' },
]

const CADENCE_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

const WEEKDAY_OPTIONS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
]

const MONTH_DAY_OPTIONS = Array.from({ length: 31 }, (_, index) => {
  const value = String(index + 1)
  return { value, label: value }
})

const YEAR_MONTH_OPTIONS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

const GRACE_PERIOD_OPTIONS = [0, 1, 2, 3, 5, 7, 14].map((value) => ({
  value: String(value),
  label: value === 1 ? '1 day' : `${value} days`,
}))

const PAYMENT_ITEM_KIND_OPTIONS = [
  { value: 'fixed', label: 'Fixed collection' },
  { value: 'open', label: 'Open collection' },
  { value: 'quantity', label: 'Quantity collection' },
]

const CONTRIBUTION_FREQUENCY_OPTIONS = [
  { value: 'one_time', label: 'Available any time' },
  { value: 'weekly', label: 'Weekly availability' },
  { value: 'monthly', label: 'Monthly availability' },
]

const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Private' },
  { value: 'official_featured', label: 'Official featured' },
]

const rolesForDueScope = (scope) => {
  switch (scope) {
    case 'members_only':
      return ['member']
    case 'members_admins':
      return ['member', 'admin']
    case 'custom_roles':
      return []
    case 'everyone':
    default:
      return ['member', 'admin', 'treasurer']
  }
}

const dueScopeFromRoles = (roles) => {
  const normalized = Array.isArray(roles) ? [...new Set(roles.map(String))].sort() : []
  const joined = normalized.join('|')
  if (joined === ['admin', 'member', 'treasurer'].sort().join('|')) return 'everyone'
  if (joined === 'member') return 'members_only'
  if (joined === ['admin', 'member'].sort().join('|')) return 'members_admins'
  return 'custom_roles'
}

const formatMinorUnitsToMajorUnitString = (value) => {
  if (value === null || value === undefined || value === '') return ''
  const amount = Number(value)
  if (!Number.isFinite(amount)) return ''
  return String(amount / 100)
}

const parseMajorUnitInputToMinorUnits = (value) => {
  if (value === null || value === undefined || value === '') return null
  const normalized = String(value).replace(/,/g, '').trim()
  if (!normalized) return null
  const amount = Number(normalized)
  if (!Number.isFinite(amount)) return null
  return Math.round(amount * 100)
}

const sourceLabel = (item) => {
  if (item?.linked_reference_type === 'CircleDuePlan' || item?.type === 'dues') return 'Recurring'
  if (String(item?.payment_item_kind || item?.checkout_mode || item?.item_type || '').toLowerCase() === 'quantity') return 'Quantity'
  if (item?.linked_reference_type === 'CircleActivity' || item?.type === 'activity_goal') return 'Collection'
  if (item?.type === 'treasury_topup') return 'Treasury Contribution'
  return 'Contribution option'
}

const statusLabel = (item) => {
  if (item?.status === 'overdue' || item?.status === 'payable_overdue') return 'Overdue'
  if (item?.status === 'current' || item?.status === 'paid') return 'Paid up'
  if (item?.is_payable_now) return 'Due now'
  return 'Active'
}

const activitySetupTone = (template) => {
  switch (template?.key) {
    case 'general_support':
    case 'emergency_support':
    case 'emergency_contribution':
    case 'welfare_support':
      return 'Open collection'
    case 'match_fee':
    case 'utility_bill':
    case 'maintenance_levy':
    case 'event_fund':
    case 'event_contribution':
    case 'special_contribution':
      return 'Fixed collection'
    case 'jersey':
      return 'Quantity collection'
    default:
      return 'Contribution option'
  }
}

const activityAmountLabel = (template) => {
  const kind = String(template || '').toLowerCase()
  if (kind === 'quantity') return 'Unit price (NGN)'
  if (kind === 'open') return 'Suggested amount (NGN)'
  return 'Amount members pay (NGN)'
}

const activityKindForTemplate = (template) => {
  switch (template?.key) {
    case 'general_support':
    case 'emergency_support':
    case 'emergency_contribution':
    case 'welfare_support':
      return 'open'
    case 'jersey':
      return 'quantity'
    default:
      return 'fixed'
  }
}

const activityAvailabilityLabel = (frequency) => {
  switch (frequency) {
    case 'weekly':
      return 'Weekly availability'
    case 'monthly':
      return 'Monthly availability'
    default:
      return 'Available any time'
  }
}

const SectionButton = ({ active, children, ...props }) => (
  <button
    type="button"
    {...props}
    className={[
      'rounded-full border px-4 py-2 text-sm font-medium transition',
      active
        ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200'
        : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:text-white',
    ].join(' ')}
  >
    {children}
  </button>
)

const Field = ({ label, children }) => (
  <label className="block">
    <span className="mb-2 block text-sm text-slate-300">{label}</span>
    {children}
  </label>
)

const inputClass =
  'w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none'

const CircleManagePage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [workspace, setWorkspace] = useState(null)
  const [paymentItems, setPaymentItems] = useState([])
  const [members, setMembers] = useState([])
  const [dueObligations, setDueObligations] = useState([])
  const [duePlan, setDuePlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [section, setSection] = useState('payment_items')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [processingApprovalId, setProcessingApprovalId] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')

  const [settingsForm, setSettingsForm] = useState({
    name: '',
    purpose: '',
    description: '',
    badge_label: '',
    visibility: 'private',
    withdrawal_approval_threshold: '',
    governance_setup_completed: false,
    min_contribution_ngn: '',
    max_contribution_ngn: '',
  })

  const [duePlanForm, setDuePlanForm] = useState({
    amount_ngn: '',
    cadence: 'monthly',
    due_day_of_month: '1',
    due_weekday: '1',
    due_month_of_year: '1',
    grace_period_days: '0',
    starts_on: '',
    ends_on: '',
    due_scope: 'everyone',
    enrolled_roles: rolesForDueScope('everyone'),
  })

  const [activityForm, setActivityForm] = useState({
    name: '',
    amount_ngn: '',
    deadline_at: '',
    contribution_frequency: 'one_time',
    payment_item_kind: 'fixed',
  })
  const [activityTemplate, setActivityTemplate] = useState(null)
  const [editingActivityId, setEditingActivityId] = useState('')

  const loadManage = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const [workspaceResponse, paymentItemsResponse, settingsResponse, duePlanResponse, obligationsResponse] = await Promise.all([
        getCircleWorkspace(id),
        getCirclePaymentItems(id),
        getCircleSettings(id).catch(() => null),
        getCircleDuePlan(id).catch(() => null),
        getCircleDueObligations(id).catch(() => null),
      ])
      const workspaceData = workspaceResponse?.data || {}
      const settingsRoot = settingsResponse?.data || settingsResponse || {}
      const identity = settingsRoot.identity || {}
      const governance = settingsRoot.governance || {}
      const contributions = settingsRoot.contributions || {}
      const duePlanRoot = duePlanResponse?.data || duePlanResponse || null

      setWorkspace(workspaceData)
      setMembers(Array.isArray(workspaceData?.members) ? workspaceData.members : [])
      setDueObligations(Array.isArray(obligationsResponse?.data) ? obligationsResponse.data : [])
      setPaymentItems(normalizePaymentItems(paymentItemsResponse))
      setDuePlan(duePlanRoot)
      setSettingsForm({
        name: identity.name || workspaceData?.name || '',
        purpose: identity.purpose || '',
        description: identity.description || workspaceData?.description || '',
        badge_label: identity.badge_label || '',
        visibility: settingsRoot?.privacy?.visibility || 'private',
        withdrawal_approval_threshold: governance.configured_withdrawal_approval_threshold ?? '',
        governance_setup_completed: Boolean(governance.governance_setup_completed),
        min_contribution_ngn: formatMinorUnitsToMajorUnitString(contributions.minimum_contribution_cents),
        max_contribution_ngn: formatMinorUnitsToMajorUnitString(contributions.maximum_contribution_cents),
      })

      if (duePlanRoot) {
        const enrolledRoles = Array.isArray(duePlanRoot.enrolled_roles) && duePlanRoot.enrolled_roles.length
          ? duePlanRoot.enrolled_roles
          : rolesForDueScope('everyone')
        setDuePlanForm({
          amount_ngn: formatMinorUnitsToMajorUnitString(duePlanRoot.amount_cents),
          cadence: duePlanRoot.cadence || 'monthly',
          due_day_of_month: String(duePlanRoot.due_day_of_month || '1'),
          due_weekday: String(duePlanRoot.due_weekday ?? '1'),
          due_month_of_year: String(duePlanRoot.due_month_of_year || '1'),
          grace_period_days: String(duePlanRoot.grace_period_days || '0'),
          starts_on: duePlanRoot.starts_on || '',
          ends_on: duePlanRoot.ends_on || '',
          due_scope: dueScopeFromRoles(enrolledRoles),
          enrolled_roles: enrolledRoles,
        })
      }
    } catch {
      setError('Unable to load this circle right now.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadManage()
  }, [loadManage])

  const permissions = workspace?.permissions || {}
  const canManage = Boolean(
    permissions.can_manage_settings ||
      permissions.can_manage_due_plan ||
      permissions.can_manage_members ||
      permissions.can_manage_governance
  )

  const bucketKey = String(workspace?.product_bucket_key || '').trim()
  const bucketLabel = getCircleBucketLabel(workspace)
  const templates = PAYMENT_TEMPLATES_BY_BUCKET[bucketKey] || []
  const activePaymentItems = useMemo(
    () => paymentItems.filter((item) => !item?.support_fallback),
    [paymentItems]
  )
  const approvals = workspace?.approvals || {}
  const approvalItems = Array.isArray(approvals?.items) ? approvals.items : []
  const memberDuesLookup = useMemo(() => buildMemberDuesLookup(members, dueObligations, duePlan), [members, dueObligations, duePlan])
  const maxWithdrawalThreshold = Math.max(Number(workspace?.governance_summary?.max_withdrawal_approval_threshold || 0), 0)
  const withdrawalThresholdOptions = useMemo(() => {
    const options = [{ value: '', label: 'Use recommended setting' }]
    for (let value = 1; value <= maxWithdrawalThreshold; value += 1) {
      options.push({
        value: String(value),
        label: value === 1 ? '1 approval' : `${value} approvals`,
      })
    }
    return options
  }, [maxWithdrawalThreshold])

  const handleApprovalDecision = useCallback(async (approvalRequestId, decision) => {
    if (!id || !approvalRequestId) return
    try {
      setProcessingApprovalId(String(approvalRequestId))
      setError('')
      setNotice('')
      if (decision === 'approve') {
        await approveCircleApprovalRequest(id, approvalRequestId)
        setNotice('Withdrawal approved. Funds will be credited to the requester wallet.')
      } else {
        await rejectCircleApprovalRequest(id, approvalRequestId)
        setNotice('Withdrawal rejected.')
      }
      await loadManage()
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          requestError?.message ||
          'Unable to update this withdrawal request right now.'
      )
    } finally {
      setProcessingApprovalId('')
    }
  }, [id, loadManage])

  const handleTemplate = (template) => {
    if (!template || template.disabled) return
    setNotice('')
    if (template.setup_type === 'recurring') {
      setSection('payment_items')
      setDuePlanForm((current) => ({
        ...current,
        cadence: template.cadence || current.cadence,
      }))
      return
    }

    setActivityTemplate(template)
    setEditingActivityId('')
    setActivityForm({
      name: template.title,
      amount_ngn: '',
      deadline_at: '',
      contribution_frequency: template.contribution_frequency || 'one_time',
      payment_item_kind: activityKindForTemplate(template),
    })
  }

  const beginEditActivityItem = (item) => {
    setNotice('')
    setError('')
    setActivityTemplate(null)
    setEditingActivityId(String(item?.linked_reference_id || item?.activity_id || item?.id || ''))
    setActivityForm({
      name: item?.title || '',
      amount_ngn: formatMinorUnitsToMajorUnitString(
        item?.amount_cents || item?.suggested_amount_cents || item?.target_amount_cents
      ),
      deadline_at: item?.due_on ? String(item.due_on).slice(0, 10) : '',
      contribution_frequency: item?.contribution_frequency || 'one_time',
      payment_item_kind: item?.payment_item_kind || item?.item_type || 'fixed',
    })
  }

  const resetActivityForm = () => {
    setEditingActivityId('')
    setActivityTemplate(null)
    setActivityForm({
      name: '',
      amount_ngn: '',
      deadline_at: '',
      contribution_frequency: 'one_time',
      payment_item_kind: 'fixed',
    })
  }

  const saveDuePlan = async (event) => {
    event.preventDefault()
    if (!id) return
    const amountCents = parseMajorUnitInputToMinorUnits(duePlanForm.amount_ngn)
    if (!amountCents || amountCents <= 0) {
      setError('Enter a valid due amount.')
      return
    }

    const enrolledRoles =
      duePlanForm.due_scope === 'custom_roles'
        ? duePlanForm.enrolled_roles
        : rolesForDueScope(duePlanForm.due_scope)

    const payload = {
      amount_cents: amountCents,
      cadence: duePlanForm.cadence,
      grace_period_days: Number(duePlanForm.grace_period_days || 0),
      starts_on: duePlanForm.starts_on || null,
      ends_on: duePlanForm.ends_on || null,
      enrolled_roles: enrolledRoles,
    }

    if (duePlanForm.cadence === 'weekly') payload.due_weekday = Number(duePlanForm.due_weekday || 1)
    if (duePlanForm.cadence === 'monthly' || duePlanForm.cadence === 'yearly') {
      payload.due_day_of_month = Number(duePlanForm.due_day_of_month || 1)
    }
    if (duePlanForm.cadence === 'yearly') payload.due_month_of_year = Number(duePlanForm.due_month_of_year || 1)

    try {
      setSaving(true)
      setError('')
      const response = duePlan
        ? await updateCircleDuePlan(id, payload)
        : await createCircleDuePlan(id, payload)
      const root = response?.data || response
      setDuePlan(root)
      setNotice('Dues plan saved.')
    } catch (requestError) {
      setError(
        requestError?.response?.data?.errors?.join(', ') ||
          requestError?.response?.data?.error ||
          requestError?.message ||
          'Unable to save dues right now.'
      )
    } finally {
      setSaving(false)
    }
  }

  const saveActivityItem = async (event) => {
    event.preventDefault()
    if (!id) return
    const amountCents = parseMajorUnitInputToMinorUnits(activityForm.amount_ngn)
    if (!activityForm.name.trim()) {
      setError('Collection name is required.')
      return
    }
    if (!amountCents || amountCents <= 0) {
      setError('Enter a valid amount or target.')
      return
    }

    try {
      setSaving(true)
      setError('')
      const payload = {
        name: activityForm.name.trim(),
        target_amount_cents: amountCents,
        contribution_frequency: activityForm.contribution_frequency,
        payment_item_kind: activityForm.payment_item_kind,
      }
      if (activityForm.deadline_at) {
        payload.deadline_at = new Date(activityForm.deadline_at).toISOString()
      }
      if (editingActivityId) {
        await updateCircleActivity(id, editingActivityId, payload)
      } else {
        await createCircleActivity(id, payload)
      }
      const refreshedItems = await getCirclePaymentItems(id)
      setPaymentItems(normalizePaymentItems(refreshedItems))
      setNotice(
        editingActivityId
          ? `${activityForm.name.trim()} updated.`
          : `${activityForm.name.trim()} added to collections.`
      )
      resetActivityForm()
    } catch (requestError) {
      setError(
        requestError?.response?.data?.errors?.join(', ') ||
          requestError?.response?.data?.error ||
          requestError?.message ||
          'Unable to save this collection right now.'
      )
    } finally {
      setSaving(false)
    }
  }

  const saveSettings = async (event) => {
    event.preventDefault()
    if (!id) return
    try {
      setSaving(true)
      setError('')
      await updateCircleSettings(id, {
        identity: {
          name: settingsForm.name,
          purpose: settingsForm.purpose,
          description: settingsForm.description,
          badge_label: settingsForm.badge_label,
        },
        governance: {
          governance_setup_completed: Boolean(settingsForm.governance_setup_completed),
          withdrawal_approval_threshold:
            settingsForm.withdrawal_approval_threshold === ''
              ? null
              : Number(settingsForm.withdrawal_approval_threshold),
        },
        contributions: {
          min_contribution_cents: parseMajorUnitInputToMinorUnits(settingsForm.min_contribution_ngn),
          max_contribution_cents: parseMajorUnitInputToMinorUnits(settingsForm.max_contribution_ngn),
        },
        privacy: {
          visibility: settingsForm.visibility,
        },
      })
      setNotice('Circle settings updated.')
    } catch (requestError) {
      setError(
        requestError?.response?.data?.errors?.join(', ') ||
          requestError?.response?.data?.error ||
          requestError?.message ||
          'Unable to update settings.'
      )
    } finally {
      setSaving(false)
    }
  }

  const sendInvite = async (event) => {
    event.preventDefault()
    if (!id || !inviteEmail.trim()) return
    try {
      setSaving(true)
      setError('')
      await inviteCircleMember(id, { email: inviteEmail.trim(), role: 'member' })
      setInviteEmail('')
      setNotice('Member invited.')
    } catch (requestError) {
      setError(
        requestError?.response?.data?.errors?.join(', ') ||
          requestError?.response?.data?.error ||
          requestError?.message ||
          'Unable to invite member.'
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="px-6 py-10 text-sm text-slate-400">Loading circle settings...</div>
  }

  if (error && !workspace) {
    return <div className="px-6 py-10 text-sm text-rose-300">{error}</div>
  }

  if (!workspace) {
    return <div className="px-6 py-10 text-sm text-rose-300">Circle not found.</div>
  }

  if (!canManage) {
    return (
      <CircleShell
        circleId={id}
        title={getCircleTitle(workspace)}
        roleLabel={getCircleRoleLabel(workspace)}
        bucketLabel={bucketLabel}
        active="manage"
      >
        <div className="rounded-[28px] border border-slate-900 bg-[#050b1b] px-5 py-5 text-sm text-slate-400">
          You do not have permission to manage this circle.
        </div>
      </CircleShell>
    )
  }

  return (
    <CircleShell
      circleId={id}
      title={getCircleTitle(workspace)}
      roleLabel={getCircleRoleLabel(workspace)}
      bucketLabel={bucketLabel}
      active="manage"
    >
      <div className="rounded-[28px] border border-slate-900 bg-[#050b1b] px-5 py-5">
        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Admin</p>
        <h2 className="mt-2 text-xl font-semibold text-white">Configure contributions, members, governance, and settings.</h2>
        <div className="mt-5 flex flex-wrap gap-3">
          <SectionButton active={section === 'payment_items'} onClick={() => setSection('payment_items')}>Contributions</SectionButton>
          <SectionButton active={section === 'members'} onClick={() => setSection('members')}>Members</SectionButton>
          <SectionButton active={section === 'governance'} onClick={() => setSection('governance')}>Governance</SectionButton>
          <SectionButton active={section === 'settings'} onClick={() => setSection('settings')}>Settings</SectionButton>
        </div>
      </div>

      {notice ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-200">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {section === 'payment_items' ? (
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            <section className="rounded-[28px] border border-slate-900 bg-[#050b1b] px-5 py-5">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Suggested Templates</p>
              <h3 className="mt-2 text-lg font-semibold text-white">Suggested collections for {bucketLabel || 'this circle'}</h3>
              <div className="mt-4 space-y-3">
                {templates.map((template) => (
                  <div key={template.key} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-900 bg-slate-950/60 px-4 py-4">
                    <div>
                      <p className="text-sm font-semibold text-white">{template.title}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {template.setup_type === 'recurring'
                          ? 'Dues plan'
                          : template.setup_type === 'fine'
                            ? 'Assigned charge'
                            : 'Collection option'}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={template.disabled}
                      onClick={() => handleTemplate(template)}
                      className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:text-slate-500"
                    >
                      {template.disabled ? 'Later' : template.setup_type === 'recurring' ? 'Configure' : 'Add collection'}
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-900 bg-[#050b1b] px-5 py-5">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Active Collections</p>
              <div className="mt-4 space-y-3">
                {activePaymentItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-4 text-sm text-slate-400">
                    No active collections yet.
                  </div>
                ) : (
                  activePaymentItems.map((item) => (
                    <div key={String(item.key || item.id)} className="rounded-2xl border border-slate-900 bg-slate-950/60 px-4 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-white">{item.title}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {sourceLabel(item)} · {statusLabel(item)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-white">
                            {getPaymentItemAmountLabel(item)}
                          </p>
                          {item?.linked_reference_type === 'CircleActivity' ? (
                            <button
                              type="button"
                              onClick={() => beginEditActivityItem(item)}
                              className="mt-2 text-xs font-semibold text-cyan-200 hover:text-cyan-100"
                            >
                              Edit collection
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => navigate(`/dashboard/shared-groups/${id}/legacy`)}
                              className="mt-2 text-xs font-semibold text-cyan-200 hover:text-cyan-100"
                            >
                              Open collection
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-[28px] border border-slate-900 bg-[#050b1b] px-5 py-5">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Dues Plan</p>
              <h3 className="mt-2 text-lg font-semibold text-white">{duePlan ? 'Edit recurring dues' : 'Set up recurring dues'}</h3>
              <form className="mt-4 space-y-4" onSubmit={saveDuePlan}>
                <Field label="Amount (NGN)">
                  <input className={inputClass} value={duePlanForm.amount_ngn} onChange={(e) => setDuePlanForm((prev) => ({ ...prev, amount_ngn: e.target.value }))} />
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Cadence">
                    <select className={inputClass} value={duePlanForm.cadence} onChange={(e) => setDuePlanForm((prev) => ({ ...prev, cadence: e.target.value }))}>
                      {CADENCE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Who should pay?">
                    <select
                      className={inputClass}
                      value={duePlanForm.due_scope}
                      onChange={(e) =>
                        setDuePlanForm((prev) => ({
                          ...prev,
                          due_scope: e.target.value,
                          enrolled_roles:
                            e.target.value === 'custom_roles' ? prev.enrolled_roles : rolesForDueScope(e.target.value),
                        }))
                      }
                    >
                      {DUE_SCOPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-4">
                  <p className="text-sm font-medium text-white">Everyone pays by default</p>
                  <p className="mt-1 text-xs text-slate-300">
                    New dues plans include the creator, admins, treasurers, and members unless you choose a narrower scope.
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    New members start owing from when they join the Circle. They are not back-billed for periods before they joined.
                  </p>
                </div>

                {duePlanForm.due_scope === 'custom_roles' ? (
                  <div className="flex flex-wrap gap-2">
                    {DUE_ROLE_OPTIONS.map((role) => {
                      const active = duePlanForm.enrolled_roles.includes(role.value)
                      return (
                        <button
                          key={role.value}
                          type="button"
                          onClick={() =>
                            setDuePlanForm((prev) => ({
                              ...prev,
                              enrolled_roles: active
                                ? prev.enrolled_roles.filter((value) => value !== role.value)
                                : [...prev.enrolled_roles, role.value],
                            }))
                          }
                          className={`rounded-full border px-3 py-2 text-xs font-semibold ${active ? 'border-cyan-400/60 bg-cyan-500/10 text-cyan-200' : 'border-slate-700 text-slate-300'}`}
                        >
                          {role.label}
                        </button>
                      )
                    })}
                  </div>
                ) : null}

                <div className="rounded-2xl border border-slate-900 bg-slate-950/60 px-4 py-4">
                  <p className="text-sm font-medium text-white">Members can pay multiple periods</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Checkout supports paying one or more periods at a time. Set one clear frequency and due date here.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label={duePlanForm.cadence === 'weekly' ? 'Due weekday' : 'Due day'}>
                    {duePlanForm.cadence === 'weekly' ? (
                      <select className={inputClass} value={duePlanForm.due_weekday} onChange={(e) => setDuePlanForm((prev) => ({ ...prev, due_weekday: e.target.value }))}>
                        {WEEKDAY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    ) : (
                      <select className={inputClass} value={duePlanForm.due_day_of_month} onChange={(e) => setDuePlanForm((prev) => ({ ...prev, due_day_of_month: e.target.value }))}>
                        {MONTH_DAY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    )}
                  </Field>
                  <Field label="Grace period (days)">
                    <select className={inputClass} value={duePlanForm.grace_period_days} onChange={(e) => setDuePlanForm((prev) => ({ ...prev, grace_period_days: e.target.value }))}>
                      {GRACE_PERIOD_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                {duePlanForm.cadence === 'yearly' ? (
                  <Field label="Due month">
                    <select className={inputClass} value={duePlanForm.due_month_of_year} onChange={(e) => setDuePlanForm((prev) => ({ ...prev, due_month_of_year: e.target.value }))}>
                      {YEAR_MONTH_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </Field>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Start date">
                    <input type="date" className={inputClass} value={duePlanForm.starts_on} onChange={(e) => setDuePlanForm((prev) => ({ ...prev, starts_on: e.target.value }))} />
                  </Field>
                  <Field label="End date">
                    <input type="date" className={inputClass} value={duePlanForm.ends_on} onChange={(e) => setDuePlanForm((prev) => ({ ...prev, ends_on: e.target.value }))} />
                  </Field>
                </div>

                <button type="submit" disabled={saving} className="w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500">
                  {saving ? 'Saving…' : duePlan ? 'Update dues plan' : 'Save dues plan'}
                </button>
              </form>
            </section>

              <section className="rounded-[28px] border border-slate-900 bg-[#050b1b] px-5 py-5">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Collections</p>
                <h3 className="mt-2 text-lg font-semibold text-white">
                  {editingActivityId ? `Edit ${activityForm.name || 'collection'}` : activityTemplate ? `Configure ${activityTemplate.title}` : 'Create a collection'}
                </h3>
                {activityTemplate ? (
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-900 bg-slate-950/60 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{activityTemplate.title}</p>
                      <p className="mt-1 text-xs text-slate-400">{activitySetupTone(activityTemplate)}</p>
                    </div>
                    <div className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                      Template
                    </div>
                  </div>
                ) : null}
                {editingActivityId ? (
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Editing active collection</p>
                      <p className="mt-1 text-xs text-amber-100/80">Changes will update the live item members see in Circle contributions.</p>
                    </div>
                    <div className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                      Live
                    </div>
                  </div>
                ) : null}
                <form className="mt-4 space-y-4" onSubmit={saveActivityItem}>
                  <Field label="Collection name">
                    <input className={inputClass} value={activityForm.name} onChange={(e) => setActivityForm((prev) => ({ ...prev, name: e.target.value }))} />
                  </Field>
                  <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Collection type">
                    <select
                      className={inputClass}
                      value={activityForm.payment_item_kind}
                      onChange={(e) => setActivityForm((prev) => ({ ...prev, payment_item_kind: e.target.value }))}
                    >
                      {PAYMENT_ITEM_KIND_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={activityAmountLabel(activityForm.payment_item_kind)}>
                    <input className={inputClass} value={activityForm.amount_ngn} onChange={(e) => setActivityForm((prev) => ({ ...prev, amount_ngn: e.target.value }))} />
                  </Field>
                    <Field label="Availability">
                      <select className={inputClass} value={activityForm.contribution_frequency} onChange={(e) => setActivityForm((prev) => ({ ...prev, contribution_frequency: e.target.value }))}>
                        {CONTRIBUTION_FREQUENCY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Field label="Due / close date (optional)">
                    <input type="date" className={inputClass} value={activityForm.deadline_at} onChange={(e) => setActivityForm((prev) => ({ ...prev, deadline_at: e.target.value }))} />
                    <p className="mt-2 text-xs text-slate-500">Leave this blank to keep the item available until you close it.</p>
                  </Field>
                  <div className="rounded-2xl border border-slate-900 bg-slate-950/60 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">How members will see it</p>
                      <span className="rounded-full border border-slate-800 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                        {activityAvailabilityLabel(activityForm.contribution_frequency)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-300">Members will see this in Circle contributions after you save it.</p>
                  </div>
                  <div className="flex gap-3">
                  <button type="submit" disabled={saving} className="flex-1 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500">
                    {saving ? 'Saving…' : editingActivityId ? 'Update collection' : 'Save collection'}
                  </button>
                  {activityTemplate || editingActivityId ? (
                    <button
                      type="button"
                      onClick={resetActivityForm}
                      className="rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold text-white"
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </form>
            </section>
          </div>
        </div>
      ) : null}

      {section === 'members' ? (
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[28px] border border-slate-900 bg-[#050b1b] px-5 py-5">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Invite Member</p>
            <form className="mt-4 space-y-4" onSubmit={sendInvite}>
              <Field label="Email">
                <input className={inputClass} value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
              </Field>
              <button type="submit" disabled={saving} className="w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500">
                {saving ? 'Sending…' : 'Invite member'}
              </button>
            </form>
          </section>
          <section className="rounded-[28px] border border-slate-900 bg-[#050b1b] px-5 py-5">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Members</p>
            <div className="mt-4 space-y-3">
              {members.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-4 text-sm text-slate-400">
                  No member data available yet.
                </div>
              ) : (
                members.map((member, index) => {
                  const dues = memberDuesLookup[String(member?.id || member?.user?.id || '')]
                  return (
                    <div key={String(member?.id || index)} className="rounded-2xl border border-slate-900 bg-slate-950/60 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white">{member?.display_name || member?.user?.display_name || member?.user?.email || 'Member'}</p>
                          <p className="mt-1 text-xs text-slate-400">{formatCircleRoleLabel(member?.role || member?.membership_role || 'member')}</p>
                          {dues ? (
                            <p className="mt-2 text-xs text-slate-500">{dues.periodsPaidLabel} - {dues.outstandingAmountLabel} outstanding</p>
                          ) : duePlan ? (
                            <p className="mt-2 text-xs text-slate-500">No dues status for this cycle.</p>
                          ) : null}
                        </div>
                        {dues ? (
                          <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${dues.statusKey === 'paid' ? 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-100' : 'border border-amber-400/20 bg-amber-400/10 text-amber-100'}`}>
                            {dues.statusLabel}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </section>
        </div>
      ) : null}

      {section === 'governance' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-[28px] border border-slate-900 bg-[#050b1b] px-5 py-5">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Governance</p>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between rounded-2xl border border-slate-900 bg-slate-950/60 px-4 py-4">
                <span>Withdrawal approval threshold</span>
                <span className="font-medium text-white">{settingsForm.withdrawal_approval_threshold || 'Not set'}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-900 bg-slate-950/60 px-4 py-4">
                <span>Governance setup</span>
                <span className="font-medium text-white">{settingsForm.governance_setup_completed ? 'Completed' : 'Pending'}</span>
              </div>
            </div>
          </section>
          <section className="rounded-[28px] border border-slate-900 bg-[#050b1b] px-5 py-5">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Withdrawal Approvals</p>
            <p className="mt-3 text-sm text-slate-400">
              Approved withdrawals land in the requester wallet, then the requester can use their personal bank transfer flow.
            </p>
            <div className="mt-4 space-y-3">
              {approvalItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-4 text-sm text-slate-400">
                  No pending withdrawal approvals right now.
                </div>
              ) : (
                approvalItems.map((item) => {
                  const availableActions = item?.available_actions || {}
                  const acting = processingApprovalId === String(item?.id || '')
                  return (
                    <div key={String(item?.id)} className="rounded-2xl border border-slate-900 bg-slate-950/60 px-4 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {item?.initiated_by?.display_name || 'Requester'} requested {formatMoney((Number(item?.amount_cents || 0) || 0) / 100)}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {item?.remaining_approvals || 0} approval{Number(item?.remaining_approvals || 0) === 1 ? '' : 's'} remaining
                          </p>
                          {item?.note ? (
                            <p className="mt-2 text-sm text-slate-300">{item.note}</p>
                          ) : null}
                          <p className="mt-2 text-xs text-cyan-200">{item?.settlement_message}</p>
                          <p className="mt-2 text-[11px] text-slate-500">
                            {item?.created_at ? new Date(item.created_at).toLocaleString() : ''}
                          </p>
                        </div>
                        <div className="rounded-full border border-slate-800 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                          {item?.lifecycle_state || 'pending_approval'}
                        </div>
                      </div>
                      {availableActions?.can_approve || availableActions?.can_reject ? (
                        <div className="mt-4 flex gap-3">
                          <button
                            type="button"
                            disabled={acting || !availableActions?.can_approve}
                            onClick={() => handleApprovalDecision(item.id, 'approve')}
                            className="flex-1 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 disabled:bg-slate-800 disabled:text-slate-500"
                          >
                            {acting ? 'Updating…' : 'Approve'}
                          </button>
                          <button
                            type="button"
                            disabled={acting || !availableActions?.can_reject}
                            onClick={() => handleApprovalDecision(item.id, 'reject')}
                            className="flex-1 rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold text-white disabled:border-slate-800 disabled:text-slate-500"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl border border-slate-900 bg-slate-950/40 px-4 py-3 text-xs text-slate-400">
                          {availableActions?.self_action_blocked
                            ? 'You cannot approve your own withdrawal request.'
                            : 'This request is read-only for your role right now.'}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
            <button
              type="button"
              onClick={() => navigate(`/dashboard/shared-groups/${id}/legacy`)}
              className="mt-5 rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold text-white"
            >
              Open legacy governance
            </button>
          </section>
        </div>
      ) : null}

      {section === 'settings' ? (
        <section className="rounded-[28px] border border-slate-900 bg-[#050b1b] px-5 py-5">
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Settings</p>
          <form className="mt-4 space-y-4" onSubmit={saveSettings}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Circle name">
                <input className={inputClass} value={settingsForm.name} onChange={(e) => setSettingsForm((prev) => ({ ...prev, name: e.target.value }))} />
              </Field>
              <Field label="Badge label">
                <input className={inputClass} value={settingsForm.badge_label} onChange={(e) => setSettingsForm((prev) => ({ ...prev, badge_label: e.target.value }))} />
              </Field>
            </div>
            <Field label="Purpose">
              <input className={inputClass} value={settingsForm.purpose} onChange={(e) => setSettingsForm((prev) => ({ ...prev, purpose: e.target.value }))} />
            </Field>
            <Field label="Description">
              <textarea className={`${inputClass} min-h-[120px]`} value={settingsForm.description} onChange={(e) => setSettingsForm((prev) => ({ ...prev, description: e.target.value }))} />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Visibility">
                <select className={inputClass} value={settingsForm.visibility} onChange={(e) => setSettingsForm((prev) => ({ ...prev, visibility: e.target.value }))}>
                  {VISIBILITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Withdrawal approval threshold">
                {maxWithdrawalThreshold > 0 ? (
                  <select className={inputClass} value={settingsForm.withdrawal_approval_threshold} onChange={(e) => setSettingsForm((prev) => ({ ...prev, withdrawal_approval_threshold: e.target.value }))}>
                    {withdrawalThresholdOptions.map((option) => (
                      <option key={option.value || 'recommended'} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-2xl border border-slate-900 bg-slate-950/60 px-4 py-4 text-sm text-slate-400">
                    Add more than one manager before setting a withdrawal approval threshold.
                  </div>
                )}
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Minimum contribution (NGN)">
                <input className={inputClass} value={settingsForm.min_contribution_ngn} onChange={(e) => setSettingsForm((prev) => ({ ...prev, min_contribution_ngn: e.target.value }))} />
              </Field>
              <Field label="Maximum contribution (NGN)">
                <input className={inputClass} value={settingsForm.max_contribution_ngn} onChange={(e) => setSettingsForm((prev) => ({ ...prev, max_contribution_ngn: e.target.value }))} />
              </Field>
            </div>
            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={Boolean(settingsForm.governance_setup_completed)}
                onChange={(e) => setSettingsForm((prev) => ({ ...prev, governance_setup_completed: e.target.checked }))}
              />
              Governance setup completed
            </label>
            <button type="submit" disabled={saving} className="w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500">
              {saving ? 'Saving…' : 'Save settings'}
            </button>
          </form>
        </section>
      ) : null}
    </CircleShell>
  )
}

export default CircleManagePage
