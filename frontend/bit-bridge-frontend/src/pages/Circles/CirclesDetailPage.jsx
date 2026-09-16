// src/pages/Circles/CirclesDetailPage.jsx

import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import ClassicBtn from '../../components/button/ClassicButton'
import DisputeModal from '../../components/DisputeModal'
import { getAccessToken } from '../../auth/tokenStore'
import { toast } from 'react-toastify'
import { setOwnerMode } from '../../redux/app'
import { formatCircleRoleLabel } from './roleLabels'
import { canUseCircles, kycRank, withCircleAccessMissingDetails } from '../../utils/kycGate'

import {
  getCircleWorkspace,
  getCircleSettings,
  getCircleDuePlan,
  fundCircle,
  withdrawCircle,
  getCircleAuditSummary,
  listCircleStatements,
  createCircleStatement,
  exportCircleCsv,
  inviteCircleMember,
  listCircleActivities,
  createCircleActivity,
  reactToCircleTx,
  unreactToCircleTx,
  createCircleDuePlan,
  updateCircleDuePlan,
  quoteCircleDuePlan,
  getCirclePaymentItems,
  updateCircleSettings,
  updateMyCircleMembership,
} from '../../api/circles'

const ALLOWED_EMOJIS = ['👍', '🎉', '🙏']

const CIRCLE_ARCHETYPE_OPTIONS = [
  { value: 'sports_circle', label: 'Sports Circle' },
  { value: 'savings_circle', label: 'Savings Circle' },
  { value: 'family_circle', label: 'Family Circle' },
  { value: 'estate_circle', label: 'Estate Circle' },
  { value: 'association_treasury', label: 'Association Circle' },
  { value: 'general_circle', label: 'General Circle' },
]
const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Private' },
  { value: 'official_featured', label: 'Official featured' },
]
const DUE_WEEKDAY_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]
const DUE_ROLE_OPTIONS = [
  { value: 'member', label: 'Members' },
  { value: 'treasurer', label: 'Treasurers' },
  { value: 'admin', label: 'Admins' },
]

const DUE_SCOPE_OPTIONS = [
  {
    value: 'everyone',
    label: 'Everyone',
    description: 'Members, admins, and treasurers all receive dues obligations.',
  },
  {
    value: 'members_only',
    label: 'Members only',
    description: 'Only regular members are expected to pay.',
  },
  {
    value: 'members_admins',
    label: 'Members + Admins',
    description: 'Members and admins pay. Treasurers are excluded.',
  },
  {
    value: 'custom_roles',
    label: 'Custom roles',
    description: 'Choose exactly which circle roles should pay.',
  },
]

const CIRCLE_STATEMENT_RANGE_OPTIONS = [
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'year_to_date', label: 'Year to date' },
  { key: 'last_12_months', label: '12 months' },
  { key: 'all_time', label: 'All time' },
  { key: 'custom', label: 'Custom' },
]

const CIRCLE_STATEMENT_STATUS_STYLES = {
  pending: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
  ready: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
  failed: 'border-red-400/30 bg-red-400/10 text-red-100',
}

const PAYMENT_TEMPLATES_BY_BUCKET = {
  clubs_teams: [
    { key: 'monthly_dues', title: 'Monthly Dues', setup_type: 'recurring', cadence: 'monthly' },
    { key: 'match_fee', title: 'Match Fee', setup_type: 'activity', contribution_frequency: 'one_time' },
    { key: 'jersey', title: 'Jersey', setup_type: 'activity', contribution_frequency: 'one_time' },
    { key: 'general_support', title: 'General Support', setup_type: 'activity', contribution_frequency: 'one_time' },
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

const rolesForDueScope = (scope) => {
  switch (scope) {
    case 'members_only':
      return ['member']
    case 'members_admins':
      return ['member', 'admin']
    case 'custom_roles':
      return null
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

const formatNaira = (amount) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(amount || 0)

const formatCapAmount = (cents) => formatNaira((Number(cents || 0) || 0) / 100)

const formatMinorUnitsToMajorUnitString = (value) => {
  if (value === null || value === undefined || value === '') return ''
  const amount = Number(value)
  if (!Number.isFinite(amount)) return ''
  return String(amount / 100)
}

const toInputDate = (date) => {
  const value = new Date(date)
  if (Number.isNaN(value.getTime())) return ''
  return value.toISOString().slice(0, 10)
}

const dayDifference = (from, to) => {
  const fromDate = new Date(from)
  const toDate = new Date(to)
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return Number.NaN
  return Math.floor((toDate.getTime() - fromDate.getTime()) / 86_400_000)
}

const parseMajorUnitInputToMinorUnits = (value) => {
  if (value === null || value === undefined || value === '') return null
  const normalized = String(value).replace(/,/g, '').trim()
  if (!normalized) return null

  const amount = Number(normalized)
  if (!Number.isFinite(amount)) return null

  return Math.round(amount * 100)
}

const paymentItemSourceLabel = (item) => {
  if (!item) return 'Payment item'
  if (item.linked_reference_type === 'CircleDuePlan' || item.type === 'dues') return 'Recurring'
  if (item.linked_reference_type === 'CircleActivity' || item.type === 'activity_goal') return 'Collection'
  if (item.type === 'treasury_topup') return 'Support'
  return 'Payment item'
}

const paymentItemStatusBadge = (item) => {
  if (!item) return 'Optional'
  if (item.status === 'overdue' || item.status === 'payable_overdue') return 'Overdue'
  if (item.is_payable_now) return 'Due now'
  if (item.status === 'current' || item.status === 'paid' || item.status === 'configured') return 'Paid up'
  if (item.type === 'treasury_topup' || item.required === false) return 'Optional'
  if (item.due_on) return 'Upcoming'
  return 'Upcoming'
}

const paymentItemMetaLine = (item) => {
  if (!item) return ''
  const modeLabel =
    item.checkout_mode === 'recurring'
      ? 'Recurring'
      : item.checkout_mode === 'quantity'
        ? 'Quantity'
        : item.checkout_mode === 'fixed'
          ? 'Fixed'
          : item.type === 'treasury_topup'
            ? 'Optional contribution'
            : 'Open'
  const dueLabel = item.due_on ? `Next ${safeDateLabel(item.due_on)}` : item.due_label
  return [modeLabel, dueLabel].filter(Boolean).join(' · ')
}

const templateActionLabel = (template) => {
  if (!template) return 'Open setup'
  if (template.disabled) return 'Coming later'
  if (template.setup_type === 'recurring') return 'Configure'
  return 'Add item'
}

const safeDateLabel = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatStatusLabel = (value) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())

const formatRoleScopeLabel = (roles) => {
  const normalized = Array.isArray(roles) ? roles.filter(Boolean) : []
  if (!normalized.length) return 'Applies to selected members'
  return `Applies to ${normalized.map((role) => formatStatusLabel(role)).join(', ')}`
}

const initialsFromEmail = (email) => {
  const e = (email || '').trim()
  if (!e) return 'BB'
  return e[0].toUpperCase()
}

const colorFromEmail = (email) => {
  const str = (email || 'bitbridge').toLowerCase()
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  const idx = hash % 6
  const classes = [
    'from-sky-500 to-blue-600',
    'from-emerald-500 to-sky-600',
    'from-violet-500 to-indigo-600',
    'from-rose-500 to-fuchsia-600',
    'from-amber-500 to-orange-600',
    'from-teal-500 to-emerald-600',
  ]
  return classes[idx]
}

const pillForStatus = (status) => {
  const s = (status || '').toLowerCase()
  if (s === 'completed') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
  if (s === 'cancelled') return 'border-slate-600 bg-slate-900/60 text-slate-200'
  if (s === 'expired') return 'border-rose-500/40 bg-rose-500/10 text-rose-200'
  return 'border-sky-500/40 bg-sky-500/10 text-sky-200'
}

const ReactionBar = ({ tx, onToggle, busyEmoji }) => {
  const mine = tx?.reactions?.mine || []
  const counts = tx?.reactions?.counts || {}

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {ALLOWED_EMOJIS.map((emoji) => {
        const selected = mine.includes(emoji)
        const count = Number(counts[emoji] || 0)
        const isBusy = busyEmoji === emoji

        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onToggle(tx, emoji)}
            disabled={isBusy}
            className={[
              'inline-flex items-center justify-center gap-1 rounded-full border px-2 py-[3px] text-[11px] leading-none transition',
              selected
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
                : 'border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-900/90',
              isBusy ? 'opacity-60 cursor-not-allowed' : '',
            ].join(' ')}
            title={selected ? 'Remove reaction' : 'React'}
          >
            <span className="text-sm leading-none">{emoji}</span>
            <span className="text-slate-300 leading-none">{count}</span>
          </button>
        )
      })}
    </div>
  )
}

const SegBtn = ({ active, label, onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={[
      'flex-1 rounded-xl border text-xs font-semibold tracking-wide transition',
      'inline-flex items-center justify-center text-center leading-none px-4 py-3',
      active
        ? 'border-sky-500/50 bg-sky-500/10 text-sky-100'
        : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:bg-slate-900/70',
      disabled ? 'opacity-50 cursor-not-allowed hover:bg-slate-950/60' : '',
    ].join(' ')}
  >
    <span className="leading-none">{label}</span>
  </button>
)

const PanelTabBtn = ({ active, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      'rounded-xl border px-3 py-2 text-[11px] font-semibold tracking-wide transition',
      active
        ? 'border-sky-500/50 bg-sky-500/10 text-sky-100'
        : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:bg-slate-900/70',
    ].join(' ')}
  >
    {label}
  </button>
)

const KeyVal = ({ label, value, valueClass = '' }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</span>
    <span className={['text-[12px] font-semibold text-slate-100', valueClass].join(' ')}>{value}</span>
  </div>
)

const SummaryCard = ({ recentIn, recentOut, balance, audit, auditLoading, auditError, onRefreshAudit }) => (
  <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 md:p-5">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[11px] tracking-[0.22em] uppercase text-slate-400">Summary</p>
        <p className="mt-1 text-[11px] text-slate-500">
          Quick snapshot + audit totals for trust. Timeline remains the financial truth.
        </p>
      </div>

      <button
        type="button"
        onClick={onRefreshAudit}
        disabled={auditLoading}
        className="text-[11px] text-slate-300 hover:text-white underline underline-offset-4 shrink-0"
      >
        {auditLoading ? 'Refreshing…' : 'Refresh'}
      </button>
    </div>

    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
        <p className="text-[11px] font-semibold text-slate-200 mb-3">Recent movement</p>
        <div className="space-y-2">
          <KeyVal label="In (recent)" value={formatNaira(recentIn)} valueClass="text-emerald-300" />
          <KeyVal label="Out (recent)" value={formatNaira(recentOut)} valueClass="text-rose-300" />
          <KeyVal label="Balance" value={formatNaira(balance)} valueClass="text-sky-300" />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
        <p className="text-[11px] font-semibold text-slate-200 mb-3">Audit totals</p>

        {auditError ? (
          <p className="text-[11px] text-rose-300">{auditError}</p>
        ) : (
          <div className="space-y-2">
            <KeyVal
              label="Total in"
              value={formatNaira((audit?.total_in_cents || 0) / 100)}
              valueClass="text-emerald-300"
            />
            <KeyVal
              label="Total out"
              value={formatNaira((audit?.total_out_cents || 0) / 100)}
              valueClass="text-rose-300"
            />
            <KeyVal label="Moves" value={String(audit?.tx_count ?? '—')} />
            <KeyVal label="Last move" value={audit?.last_tx_at ? safeDateLabel(audit.last_tx_at) : '—'} />
          </div>
        )}
      </div>
    </div>
  </div>
)

/**
 * ✅ Simple Transaction PIN Modal (used for fund + withdraw)
 */
const CircleSettingsPanel = ({
  canManage,
  form,
  onChange,
  onSubmit,
  saving,
  saveError,
  saveSuccess,
  loading,
  loadError,
  recommendations,
  showIdentity = true,
  showGovernance = true,
  showContributions = true,
  intro,
}) => (
  <div className="mt-2">
    <p className="text-[11px] text-slate-400">
      {intro || 'Bank-grade circle controls should come from canonical backend settings, not UI guesses from the group name.'}
    </p>

    <form onSubmit={onSubmit} className="mt-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {showIdentity ? (
          <>
            <div className="sm:col-span-2">
              <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Group name</label>
              <input name="name" value={form.name} onChange={onChange} disabled={!canManage || loading || saving} className="w-full h-11 rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-100 outline-none" />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Circle Type</label>
              <select name="circle_archetype" value={form.circle_archetype} onChange={onChange} disabled={!canManage || loading || saving} className="w-full h-11 rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-100 outline-none">
                {CIRCLE_ARCHETYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Visibility</label>
              <select name="visibility" value={form.visibility} onChange={onChange} disabled={!canManage || loading || saving} className="w-full h-11 rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-100 outline-none">
                {VISIBILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Purpose</label>
              <input name="purpose" value={form.purpose} onChange={onChange} disabled={!canManage || loading || saving} className="w-full h-11 rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-100 outline-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Description</label>
              <textarea name="description" value={form.description} onChange={onChange} disabled={!canManage || loading || saving} rows={3} className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none resize-none" />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Badge label</label>
              <input name="badge_label" value={form.badge_label} onChange={onChange} disabled={!canManage || loading || saving} className="w-full h-11 rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-100 outline-none" />
            </div>
          </>
        ) : null}
        {showGovernance ? (
          <>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Approval threshold</label>
              <input name="withdrawal_approval_threshold" type="number" min="1" value={form.withdrawal_approval_threshold} onChange={onChange} disabled={!canManage || loading || saving} className="w-full h-11 rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-100 outline-none" />
            </div>
          </>
        ) : null}
        {showContributions ? (
          <>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Minimum contribution (NGN)</label>
              <input name="min_contribution_ngn" type="number" min="0" step="0.01" inputMode="decimal" value={form.min_contribution_ngn} onChange={onChange} disabled={!canManage || loading || saving} className="w-full h-11 rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-100 outline-none" />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Maximum contribution (NGN)</label>
              <input name="max_contribution_ngn" type="number" min="0" step="0.01" inputMode="decimal" value={form.max_contribution_ngn} onChange={onChange} disabled={!canManage || loading || saving} className="w-full h-11 rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-100 outline-none" />
            </div>
          </>
        ) : null}
      </div>

      {showGovernance ? (
        <label className="inline-flex items-center gap-2 text-[12px] text-slate-300">
          <input name="governance_setup_completed" type="checkbox" checked={Boolean(form.governance_setup_completed)} onChange={onChange} disabled={!canManage || loading || saving} />
          Governance setup completed
        </label>
      ) : null}

      {showIdentity ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Recommended defaults</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300">
            <div>Circle Type: {recommendations.current_label || 'General Circle'}</div>
            <div>Visibility: {recommendations.recommended_visibility || 'private'}</div>
            <div>KYC mode: {recommendations.recommended_kyc_mode || 'strict'}</div>
            <div>Shared control: {recommendations.shared_control_recommended ? 'Recommended' : 'Optional'}</div>
          </div>
        </div>
      ) : null}

      {loadError && <p className="text-[11px] text-rose-300">{loadError}</p>}
      {saveError && <p className="text-[11px] text-rose-300">{saveError}</p>}
      {saveSuccess && <p className="text-[11px] text-emerald-300">{saveSuccess}</p>}
      {!canManage ? (
        <p className="text-[11px] text-slate-500">Only the group creator or an admin can update these settings right now.</p>
      ) : (
        <div className="flex items-center justify-end">
          <ClassicBtn htmlType="submit" className="h-11 px-4 text-xs" disabled={saving || loading}>
            {saving ? 'Saving…' : 'Save settings'}
          </ClassicBtn>
        </div>
      )}
    </form>
  </div>
)

const SettingsSectionBtn = ({ active, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-full border px-3 py-2 text-[11px] font-semibold transition ${
      active
        ? 'border-alt bg-alt/10 text-alt'
        : 'border-slate-700 bg-slate-950/60 text-slate-300 hover:border-alt/60 hover:text-alt'
    }`}
  >
    {label}
  </button>
)

const PaymentItemsManagePanel = ({
  suggestedPaymentTemplates,
  promotedBucketLabel,
  applySuggestedTemplate,
  listedPaymentItems,
  openPaymentItemManager,
  duePanelProps,
}) => (
  <section id="section-payment-items-manage" className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-4">
    <div>
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Payment item setup</p>
      <p className="text-[12px] text-slate-300">
        Configure what this group expects members to pay. Only saved active items appear in member checkout.
      </p>
    </div>

    {suggestedPaymentTemplates.length > 0 ? (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Suggested templates</p>
        <p className="text-[11px] text-slate-500 mb-3">
          Suggested for {promotedBucketLabel}. Templates are not payable until you configure and save them as active payment items.
        </p>
        <div className="space-y-3">
          {suggestedPaymentTemplates.map((template) => (
            <div key={template.key} className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-100">{template.title}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {template.setup_type === 'recurring'
                      ? 'Recurring payment item'
                      : template.setup_type === 'fine'
                        ? 'Assigned item'
                        : 'Collection payment item'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => applySuggestedTemplate(template)}
                  disabled={template.disabled}
                  className={[
                    'rounded-xl border px-3 py-2 text-[11px] font-semibold shrink-0',
                    template.disabled
                      ? 'border-slate-800 bg-slate-950 text-slate-500 cursor-not-allowed'
                      : 'border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-900/70',
                  ].join(' ')}
                >
                  {templateActionLabel(template)}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    ) : null}

    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Active payment items</p>
      {listedPaymentItems.length ? (
        <div className="space-y-3">
          {listedPaymentItems.map((item) => (
            <div key={item.key} className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {[paymentItemSourceLabel(item), paymentItemMetaLine(item)].filter(Boolean).join(' · ')}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {item.applicability_label || item.due_label || (item.required === false ? 'Optional item' : 'Configured item')}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-slate-100">
                    {item.amount_cents != null ? formatNaira(Number(item.amount_cents) / 100) : item.checkout_mode === 'quantity' ? 'By quantity' : 'Open'}
                  </p>
                  <span className="mt-2 inline-flex items-center rounded-full border border-slate-700 bg-slate-950/60 px-2 py-[2px] text-[10px] uppercase tracking-[0.16em] text-slate-300">
                    {paymentItemStatusBadge(item)}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => openPaymentItemManager(item)}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-[11px] font-semibold text-slate-200 hover:bg-slate-900/70"
                >
                  {item.linked_reference_type === 'CircleDuePlan' || item.type === 'dues' ? 'Edit item' : 'Review item'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">No active payment items yet.</p>
      )}
    </div>

    <CircleDuePlanPanel {...duePanelProps} />
  </section>
)

const CircleDuePlanPanel = ({
  canManage,
  dueForm,
  onChange,
  onToggleRole,
  onScopeChange,
  onSubmit,
  saving,
  saveError,
  saveSuccess,
  loading,
  loadError,
  duePlan,
  dueLabel,
}) => (
  <div className="mt-2 space-y-4">
    <div>
      <p className="text-[11px] text-slate-400">
        Configure a real recurring collections plan for this circle. Members can then follow the approved cadence instead of making unstructured contributions.
      </p>
    </div>

    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Plan status</p>
          <p className="mt-2 text-sm font-semibold text-slate-100">{duePlan?.status || 'Not set'}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Current plan</p>
          <p className="mt-2 text-sm font-semibold text-slate-100">{duePlan ? dueLabel : 'No dues plan configured'}</p>
        </div>
      </div>
    </div>

    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Amount (NGN)</label>
          <input
            name="amount_ngn"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={dueForm.amount_ngn}
            onChange={onChange}
            disabled={!canManage || loading || saving}
            className="w-full h-11 rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-100 outline-none"
          />
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Cadence</label>
          <select
            name="cadence"
            value={dueForm.cadence}
            onChange={onChange}
            disabled={!canManage || loading || saving}
            className="w-full h-11 rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-100 outline-none"
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Start date</label>
          <input
            name="starts_on"
            type="date"
            value={dueForm.starts_on}
            onChange={onChange}
            disabled={!canManage || loading || saving}
            className="w-full h-11 rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-100 outline-none"
          />
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">End date (optional)</label>
          <input
            name="ends_on"
            type="date"
            value={dueForm.ends_on}
            onChange={onChange}
            disabled={!canManage || loading || saving}
            className="w-full h-11 rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-100 outline-none"
          />
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Grace period (days)</label>
          <input
            name="grace_period_days"
            type="number"
            min="0"
            step="1"
            value={dueForm.grace_period_days}
            onChange={onChange}
            disabled={!canManage || loading || saving}
            className="w-full h-11 rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-100 outline-none"
          />
        </div>
        {dueForm.cadence === 'weekly' ? (
          <div>
            <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Due weekday</label>
            <select
              name="due_weekday"
              value={dueForm.due_weekday}
              onChange={onChange}
              disabled={!canManage || loading || saving}
              className="w-full h-11 rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-100 outline-none"
            >
              {DUE_WEEKDAY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">
              {dueForm.cadence === 'yearly' ? 'Due day of month' : 'Due day of month'}
            </label>
            <input
              name="due_day_of_month"
              type="number"
              min="1"
              max="31"
              step="1"
              value={dueForm.due_day_of_month}
              onChange={onChange}
              disabled={!canManage || loading || saving}
              className="w-full h-11 rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-100 outline-none"
            />
          </div>
        )}
        {dueForm.cadence === 'yearly' ? (
          <div>
            <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Due month</label>
            <input
              name="due_month_of_year"
              type="number"
              min="1"
              max="12"
              step="1"
              value={dueForm.due_month_of_year}
              onChange={onChange}
              disabled={!canManage || loading || saving}
              className="w-full h-11 rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-100 outline-none"
            />
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Who should pay?</p>
        <p className="text-[11px] text-slate-500 mb-3">
          Choose the default payer scope first. This decides which roles receive dues obligations when each period opens.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {DUE_SCOPE_OPTIONS.map((option) => {
            const active = dueForm.due_scope === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onScopeChange(option.value)}
                disabled={!canManage || loading || saving}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  active
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                    : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'
                }`}
              >
                <p className="text-sm font-semibold">{option.label}</p>
                <p className="mt-1 text-[11px] text-inherit/80">{option.description}</p>
              </button>
            )
          })}
        </div>

        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Current scope</p>
          <p className="mt-2 text-[12px] text-slate-200">{formatRoleScopeLabel(dueForm.enrolled_roles)}</p>
        </div>

        {dueForm.due_scope === 'custom_roles' ? (
          <div className="mt-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-3">Custom role selection</p>
            <div className="flex flex-wrap gap-2">
              {DUE_ROLE_OPTIONS.map((option) => {
                const active = dueForm.enrolled_roles.includes(option.value)
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onToggleRole(option.value)}
                    disabled={!canManage || loading || saving}
                    className={`rounded-full border px-3 py-2 text-[11px] ${
                      active
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                        : 'border-slate-700 bg-slate-950 text-slate-300'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-amber-100 mb-2">Current backend limits</p>
        <p className="text-[11px] text-slate-300">
          Prepayment rules and reminder schedules are not configurable yet on the backend. The current implementation supports cadence, amount, start/end dates, grace period, and eligible roles only.
        </p>
      </div>

      {loadError && <p className="text-[11px] text-rose-300">{loadError}</p>}
      {saveError && <p className="text-[11px] text-rose-300">{saveError}</p>}
      {saveSuccess && <p className="text-[11px] text-emerald-300">{saveSuccess}</p>}

      {!canManage ? (
        <p className="text-[11px] text-slate-500">Only the group creator, admins, or treasurers can configure the dues plan.</p>
      ) : (
        <div className="flex items-center justify-end">
          <ClassicBtn htmlType="submit" className="h-11 px-4 text-xs" disabled={saving || loading}>
            {saving ? 'Saving…' : duePlan?.id ? 'Update dues plan' : 'Set Up Dues Plan'}
          </ClassicBtn>
        </div>
      )}
    </form>
  </div>
)

const PinModal = ({ open, title = 'Enter Transaction PIN', onCancel, onConfirm, busy, error }) => {
  const [pin, setPin] = useState('')

  useEffect(() => {
    if (!open) setPin('')
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90]">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close"
        onClick={busy ? undefined : onCancel}
      />

      <div className="absolute inset-x-0 top-[16%] mx-auto w-[92%] max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-[0_18px_80px_rgba(0,0,0,0.75)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] tracking-[0.22em] uppercase text-slate-400">Security</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-100">{title}</h3>
            <p className="mt-1 text-[11px] text-slate-500">This action will move money. PIN is required.</p>
          </div>

          <button
            type="button"
            onClick={busy ? undefined : onCancel}
            className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-[11px] font-semibold text-slate-200 hover:bg-slate-900/70 shrink-0"
            disabled={busy}
          >
            Close
          </button>
        </div>

        <div className="mt-4">
          <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">
            Transaction PIN
          </label>

          <input
  type="password"
  value={pin}
  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
  inputMode="numeric"
  autoComplete="one-time-code"
  placeholder="••••"
  className="w-full h-12 rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-100 outline-none"
  disabled={busy}
  onPaste={(e) => e.preventDefault()} // optional
/>



          {error ? <p className="mt-2 text-[11px] text-red-400">{error}</p> : null}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={busy ? undefined : onCancel}
              className="h-11 px-4 rounded-xl border border-slate-700 text-xs text-slate-200 hover:bg-slate-900/40"
              disabled={busy}
            >
              Cancel
            </button>

            <ClassicBtn
              htmlType="button"
              className="h-11 px-4 text-xs whitespace-nowrap flex items-center justify-center leading-none"
              disabled={busy || pin.length < 4}
              onclick={() => onConfirm(pin)}
            >
              <span className="leading-none">{busy ? 'Checking…' : 'Confirm'}</span>
            </ClassicBtn>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * ✅ NEW: Activity Detail Drawer (read-only) + actions.
 */
const ActivityDrawer = ({ open, onClose, activity, progress, contributions, onContribute }) => {
  if (!open || !activity) return null

  const deadlineLabel = activity?.deadline_at ? safeDateLabel(activity.deadline_at) : '—'
  const creatorEmail = activity?.created_by?.email || '—'
  const status = activity?.status || 'active'
  const freq = activity?.contribution_frequency || 'one_time'

  return (
    <div className="fixed inset-0 z-[80]">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/60" aria-label="Close" />

      <div
        className={[
          'absolute right-0 top-0 h-full w-full sm:w-[520px]',
          'bg-slate-950 border-l border-slate-800 shadow-[0_18px_80px_rgba(0,0,0,0.75)]',
          'p-5 md:p-6 overflow-auto',
        ].join(' ')}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] tracking-[0.22em] uppercase text-slate-400">Activity</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-100 truncate">{activity.name}</h3>

            <div className="mt-2 flex flex-wrap gap-2">
              <span
                className={[
                  'inline-flex items-center rounded-full border px-2 py-[2px] text-[10px] tracking-[0.16em] uppercase',
                  pillForStatus(status),
                ].join(' ')}
              >
                {status}
              </span>

              <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/60 px-2 py-[2px] text-[10px] tracking-[0.16em] uppercase text-slate-200">
                {freq}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-[11px] font-semibold text-slate-200 hover:bg-slate-900/70 shrink-0"
          >
            Close
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="space-y-2">
            <KeyVal label="Target" value={formatNaira((activity.target_amount_cents || 0) / 100)} />
            <KeyVal label="Raised" value={formatNaira(progress.raised)} valueClass="text-emerald-300" />
            <KeyVal label="Deadline" value={deadlineLabel} />
            <KeyVal label="Creator" value={creatorEmail} />
          </div>

          <div className="mt-4">
            <div className="h-2 rounded-full bg-slate-900/70 border border-slate-800 overflow-hidden">
              <div className="h-full bg-emerald-500/40" style={{ width: `${progress.pct || 0}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
              <span>Progress</span>
              <span>{Math.round(progress.pct || 0)}%</span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-4 rounded-xl border border-slate-700 text-xs text-slate-200 hover:bg-slate-900/40"
            >
              Back
            </button>

            <ClassicBtn
              htmlType="button"
              className="h-11 px-4 text-xs whitespace-nowrap flex items-center justify-center leading-none"
              onclick={() => onContribute(activity)}
            >
              <span className="leading-none">Contribute</span>
            </ClassicBtn>
          </div>

          <p className="mt-3 text-[10px] text-slate-500">
            Contribute will pre-fill Transfer → Deposit and auto-link this activity.
          </p>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold text-slate-100">Linked contributions (recent)</p>
            <span className="text-[11px] text-slate-500">{contributions.length} item(s)</span>
          </div>

          <div className="mt-3 space-y-2">
            {contributions.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-[11px] text-slate-400">No linked contributions yet.</p>
                <p className="mt-1 text-[11px] text-slate-500">Use “Contribute” to tag deposits to this activity.</p>
              </div>
            ) : (
              contributions.map((tx) => {
                const amount = (tx.amount_cents || 0) / 100
                const when = safeDateLabel(tx.occurred_at)
                const email = tx.user?.email || 'Member'
                return (
                  <div key={tx.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <p className="text-[11px] text-slate-300">
                      <span className="font-semibold text-slate-100">{formatNaira(amount)}</span>{' '}
                      <span className="text-slate-500">•</span>{' '}
                      <span className="text-slate-200">{email}</span>{' '}
                      <span className="text-slate-500">• {when}</span>
                    </p>
                    {tx.description ? (
                      <p className="mt-2 text-[11px] text-slate-400 break-words">{tx.description}</p>
                    ) : null}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const TransferCard = ({
  circleId,
  balanceNaira,
  uiCanWithdraw,
  withdrawalLockedReason,
  onDeposit,
  onWithdraw,
  depositing,
  withdrawing,
  depositError,
  depositSuccess,
  withdrawError,
  withdrawSuccess,
  activities,
  selectedActivityId,
  setSelectedActivityId,
  depositPreset,
  clearDepositPreset,
  isOfficialCircle,
  isFlexibleOfficialCircle,
  isTier1User,
  officialCapCents,
  standardDailyCapCents,
  productBucketLabel,
  duePlan,
  dueLabel,
  dueOpenPeriods,
  duePrepaidThroughLabel,
  dueNextDateLabel,
  payableItems,
  duesRecommended,
  uiCanPayDues,
  uiCanManageDuePlan,
  uiCanCreateActivity,
  activeRequiredCall,
  onOpenDueSetup,
  onOpenActivities,
}) => {
  const [mode, setMode] = useState('deposit')
  const [purpose, setPurpose] = useState('general')
  const [amount, setAmount] = useState('5000')
  const [note, setNote] = useState('')
  const [localError, setLocalError] = useState(null)
  const [duePaymentPreset, setDuePaymentPreset] = useState(null)
  const [duePeriods, setDuePeriods] = useState('1')
  const [dueQuoteLoading, setDueQuoteLoading] = useState(false)
  const [dueQuote, setDueQuote] = useState(null)
  const [selectedPayableKey, setSelectedPayableKey] = useState(null)
  const [showOtherOptions, setShowOtherOptions] = useState(false)
  const [nonPayableReason, setNonPayableReason] = useState(null)

  useEffect(() => {
    setLocalError(null)
    setNote('')
    setAmount(mode === 'deposit' ? '5000' : '')
    if (mode !== 'deposit') {
      setDuePaymentPreset(null)
      setPurpose('general')
    }
  }, [mode])

  useEffect(() => {
    if (!depositPreset) return
    setMode('deposit')
    setLocalError(null)

    if (typeof depositPreset.amount === 'string') setAmount(depositPreset.amount)
    if (typeof depositPreset.note === 'string') setNote(depositPreset.note)
    if (Array.isArray(depositPreset.circleDueObligationIds) && depositPreset.circleDueObligationIds.length) {
      setPurpose('dues')
      setSelectedPayableKey('dues')
      setDuePaymentPreset({
        circleDueObligationIds: depositPreset.circleDueObligationIds,
        lockAmount: Boolean(depositPreset.lockAmount),
      })
    } else {
      setDuePaymentPreset(null)
    }

    if (depositPreset.circleActivityId) {
      setPurpose('activity')
      setSelectedActivityId(depositPreset.circleActivityId)
      setSelectedPayableKey(`activity:${depositPreset.circleActivityId}`)
    } else if (Array.isArray(depositPreset.circleDueObligationIds) && depositPreset.circleDueObligationIds.length) {
      setSelectedActivityId('')
    } else {
      setPurpose('general')
      setSelectedPayableKey('treasury')
    }

    clearDepositPreset?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depositPreset])

  const isWithdraw = mode === 'withdraw'
  const busy = isWithdraw ? withdrawing : depositing
  const hasActivities = Array.isArray(activities) && activities.length > 0
  const showDuesPurpose = Boolean(duePlan) && uiCanPayDues
  const showSpecialContributionPurpose = Boolean(activeRequiredCall?.id)
  const duePaymentActive = !isWithdraw && purpose === 'dues'
  const goalPaymentActive = !isWithdraw && purpose === 'activity'
  const treasuryPaymentActive = !isWithdraw && purpose === 'general'
  const selectedActivity = goalPaymentActive ? (activities || []).find((item) => item.id === selectedActivityId) || null : null
  const dueQuotedAmountCents = Number(dueQuote?.total_amount_cents || 0)
  const dueQuotedObligationIds = Array.isArray(dueQuote?.obligation_ids) ? dueQuote.obligation_ids : []
  const dueMaxPeriods = Math.max(1, Math.min(Number(dueOpenPeriods || 1), 12))
  const primaryLabel =
    isWithdraw
      ? 'Withdraw'
      : duePaymentActive
        ? 'Confirm dues payment'
        : purpose === 'activity'
          ? 'Confirm goal contribution'
          : purpose === 'special'
            ? 'Confirm special contribution'
            : 'Confirm treasury top-up'
  const parsedAmountCents = Math.round((parseFloat(amount.toString().replace(/,/g, '')) || 0) * 100)
  const effectiveAmountCents = duePaymentActive && dueQuotedAmountCents > 0 ? dueQuotedAmountCents : parsedAmountCents
  const overOfficialCap =
    !isWithdraw &&
    isOfficialCircle &&
    isFlexibleOfficialCircle &&
    isTier1User &&
    Number(officialCapCents || 0) > 0 &&
    effectiveAmountCents > Number(officialCapCents)
  const showStandardTier1Notice = !isWithdraw && !isOfficialCircle && isTier1User
  const preferredDepositPurpose = showDuesPurpose ? 'dues' : showSpecialContributionPurpose ? 'special' : hasActivities ? 'activity' : 'general'
  const normalizedPayableItems = Array.isArray(payableItems) ? payableItems : []
  const supportPaymentItem = normalizedPayableItems.find((item) => item?.support_fallback || item?.type === 'treasury_topup') || null
  const listedPaymentItems = normalizedPayableItems.filter((item) => item?.key !== supportPaymentItem?.key)
  const informationalPayableItems = []
  const isSportsCircle = String(productBucketLabel || '').toLowerCase().includes('club') || String(productBucketLabel || '').toLowerCase().includes('team')
  const selectedPayable =
    selectedPayableKey === 'treasury'
      ? { key: 'treasury', type: 'treasury_topup', title: 'General Support', amount_cents: null, status: 'optional', due_label: '', required: false }
      : normalizedPayableItems.find((item) => item.key === selectedPayableKey) || null
  const payableSelectionBlocked = Boolean(selectedPayable?.is_review_only)
  const selectedItemTitle = selectedPayable?.title || (purpose === 'dues' ? dueLabel : purpose === 'activity' ? selectedActivity?.name || 'Goal contribution' : purpose === 'special' ? activeRequiredCall?.name || activeRequiredCall?.title || 'Special contribution' : 'General Support')
  const selectedItemCheckoutMode =
    selectedPayable?.checkout_mode ||
    (purpose === 'dues'
      ? 'recurring'
      : purpose === 'activity'
        ? 'open'
        : purpose === 'special'
          ? 'fixed'
          : 'open')
  const selectedItemAmountLocked =
    selectedPayable?.amount_locked === true ||
    selectedItemCheckoutMode === 'fixed' ||
    purpose === 'dues'
  const selectedItemQuantityMode = selectedItemCheckoutMode === 'quantity'
  const paymentItemBadge = (item) => {
    if (!item) return 'Optional'
    if (item.status === 'overdue' || item.status === 'payable_overdue') return 'Overdue'
    if (item.is_payable_now) return 'Due now'
    if (item.status === 'current' || item.status === 'paid' || item.status === 'configured') return 'Paid up'
    if (item.type === 'treasury_topup' || item.required === false) return 'Optional'
    if (item.due_on) return 'Upcoming'
    return 'Upcoming'
  }
  const paymentItemMeta = (item) => {
    if (!item) return ''
    const cadenceLabel =
      item.checkout_mode === 'recurring'
        ? 'Recurring'
        : item.checkout_mode === 'quantity'
          ? 'Quantity'
          : item.checkout_mode === 'fixed'
            ? 'Fixed'
            : item.type === 'treasury_topup'
              ? 'Optional contribution'
              : 'Open'
    const dueLabel = item.due_on ? `Next ${safeDateLabel(item.due_on)}` : item.due_label
    return [cadenceLabel, dueLabel].filter(Boolean).join(' · ')
  }
  const paymentItemButtonLabel = (item) => {
    if (!item) return 'Review'
    if (item.is_review_only) return 'View'
    return item.type === 'treasury_topup' || item.required === false ? 'Contribute' : 'Pay now'
  }
  const paymentItemButtonClass = (item) =>
    item?.is_review_only
      ? 'border-slate-700 bg-slate-950/60 text-slate-200 hover:bg-slate-900/70'
      : 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25'
  const paymentItemSourceLabel = (item) => {
    if (!item) return 'Payment item'
    if (item.linked_reference_type === 'CircleDuePlan' || item.type === 'dues') return 'Recurring'
    if (item.linked_reference_type === 'CircleActivity' || item.type === 'activity_goal') return 'Collection'
    if (item.type === 'treasury_topup') return 'Support'
    return 'Payment item'
  }
  const reviewPurposeLabel =
    selectedItemTitle
  const reviewLinkedItem =
    purpose === 'dues'
      ? duePlan?.current_period_label || dueLabel
      : purpose === 'activity'
        ? selectedActivity?.name || 'No goal selected'
        : purpose === 'special'
          ? activeRequiredCall?.name || activeRequiredCall?.title || 'Active named collection'
          : 'Circle treasury'
  const reviewUpdateEffect =
    purpose === 'dues'
      ? 'Updates your dues status.'
      : purpose === 'activity'
        ? 'Updates goal progress.'
        : purpose === 'special'
          ? 'Records a named special contribution.'
          : 'Adds unlinked funds to circle treasury.'

  useEffect(() => {
    if (mode !== 'deposit') return
    if (duePaymentPreset?.lockAmount) return
    if (purpose === preferredDepositPurpose) return
    if (
      purpose === 'general' ||
      (purpose === 'activity' && !hasActivities) ||
      (purpose === 'special' && !showSpecialContributionPurpose) ||
      (purpose === 'dues' && !showDuesPurpose)
    ) {
      setPurpose(preferredDepositPurpose)
    }
  }, [mode, purpose, preferredDepositPurpose, hasActivities, showDuesPurpose, showSpecialContributionPurpose, duePaymentPreset?.lockAmount])

  useEffect(() => {
    if (!showDuesPurpose && purpose === 'dues') setPurpose(hasActivities ? 'activity' : 'general')
  }, [showDuesPurpose, purpose, hasActivities])

  useEffect(() => {
    if (!showSpecialContributionPurpose && purpose === 'special') {
      setPurpose(showDuesPurpose ? 'dues' : hasActivities ? 'activity' : 'general')
    }
  }, [showSpecialContributionPurpose, purpose, showDuesPurpose, hasActivities])

  useEffect(() => {
    if (!hasActivities && purpose === 'activity') setPurpose(showDuesPurpose ? 'dues' : 'general')
  }, [hasActivities, purpose, showDuesPurpose])

  const openPayableItem = (item) => {
    if (!item) return
    setLocalError(null)
    setSelectedPayableKey(item.key)

    if (item.type === 'dues') {
      setPurpose('dues')
      setSelectedActivityId('')
      setDuePaymentPreset(null)
      setNonPayableReason(item.is_review_only ? (item.review_detail || 'Review this item below.') : null)
      return
    }

    if (item.type === 'activity_goal') {
      setPurpose('activity')
      setSelectedActivityId(item.activity_id || '')
      setDuePaymentPreset(null)
      if (item.amount_cents && (item.checkout_mode === 'fixed' || item.checkout_mode === 'quantity' || item.checkout_mode === 'open')) {
        setAmount(String(Number(item.amount_cents) / 100))
      }
      setNonPayableReason(null)
      return
    }

    if (item.type === 'special_call') {
      setPurpose('special')
      setSelectedActivityId('')
      setDuePaymentPreset(null)
      if (item.amount_cents) setAmount(String(Number(item.amount_cents) / 100))
      setNonPayableReason(null)
      return
    }

    setPurpose('general')
    setSelectedActivityId('')
    setDuePaymentPreset(null)
    setNonPayableReason(null)
  }

  const resetToPayableList = () => {
    setSelectedPayableKey(null)
    setLocalError(null)
    setNonPayableReason(null)
    setPurpose(preferredDepositPurpose)
    setDuePaymentPreset(null)
  }

  useEffect(() => {
    if (isWithdraw || purpose !== 'dues' || !circleId || !showDuesPurpose || duePaymentPreset?.lockAmount) return

    let cancelled = false
    setDueQuoteLoading(true)

    quoteCircleDuePlan(circleId, { periods_count: Number(duePeriods || 1) })
      .then((response) => {
        if (cancelled) return
        const payload = response?.data?.data || response?.data || {}
        setDueQuote(payload)
        const quotedAmount = Number(payload?.total_amount_cents || 0)
        if (quotedAmount > 0) setAmount(String(quotedAmount / 100))
      })
      .catch((err) => {
        if (cancelled) return
        setDueQuote(null)
        setLocalError(
          err?.response?.data?.errors?.join(', ') ||
            err?.response?.data?.error ||
            err?.message ||
            'Unable to calculate the due total.'
        )
      })
      .finally(() => {
        if (!cancelled) setDueQuoteLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [circleId, duePaymentPreset?.lockAmount, duePeriods, isWithdraw, purpose, showDuesPurpose])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError(null)

    const amountValue = parseFloat(amount.toString().replace(/,/g, ''))
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      setLocalError('Enter an amount greater than zero.')
      return
    }

    if (overOfficialCap) {
      setLocalError('Complete verification to contribute above your current limit.')
      return
    }

    if (!isWithdraw && purpose === 'activity' && !selectedActivityId) {
      setLocalError('Select an activity before contributing.')
      return
    }

    if (!isWithdraw && purpose === 'dues' && !duePaymentPreset?.lockAmount && dueQuotedObligationIds.length === 0) {
      setLocalError('There is no payable due coverage to settle right now.')
      return
    }

    if (isWithdraw) {
      if (!uiCanWithdraw) {
        setLocalError(withdrawalLockedReason || 'Withdrawals are not available for you in this group.')
        return
      }
      const maxAvailable = Number(balanceNaira || 0)
      if (amountValue > maxAvailable) {
        setLocalError('This group does not have enough balance for that payout.')
        return
      }
      await onWithdraw({ amountValue, note })
      return
    }

    await onDeposit({
      amountValue,
      note,
      paymentItemTitle: selectedItemTitle,
      paymentPurpose: purpose === 'activity' ? 'activity_goal' : purpose === 'dues' ? 'dues' : purpose === 'special' ? 'special_call' : 'treasury_topup',
      circleActivityId: purpose === 'activity' ? selectedActivityId || null : null,
      circleDueObligationIds: duePaymentPreset?.circleDueObligationIds || dueQuotedObligationIds,
    })
  }

  return (
    <section
      id="transfer-card"
      className="md:col-span-2 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 md:p-6 min-w-0"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{isWithdraw ? 'Withdraw from Circle' : 'Payment Items'}</h2>
            <p className="mt-1 text-[11px] text-slate-400">
              {isWithdraw
                ? 'Move money from the circle treasury back into your wallet.'
                : selectedPayable
                  ? selectedPayable.title
                  : `${listedPaymentItems.length} available`}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[11px] text-slate-500">Balance</p>
            <p className="text-sm font-semibold text-slate-100">{formatNaira(balanceNaira)}</p>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <SegBtn active={mode === 'deposit'} label="Pay into circle" onClick={() => setMode('deposit')} />
          <SegBtn
            active={mode === 'withdraw'}
            label="Withdrawal"
            onClick={() => setMode('withdraw')}
            disabled={!uiCanWithdraw}
          />
        </div>

        {!uiCanWithdraw && (
          <p className="mt-2 text-[11px] text-slate-500">
            Withdrawal is locked: {withdrawalLockedReason || 'Only the group creator/admin can withdraw.'}
          </p>
        )}
      </div>

      <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/60 p-3 md:p-4">
        {!isWithdraw && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Payment items</p>
              <p className="text-[11px] text-slate-500">{listedPaymentItems.length} item{listedPaymentItems.length === 1 ? '' : 's'}</p>
            </div>

            <div className="space-y-2">
              {listedPaymentItems.length ? (
                listedPaymentItems.map((item) => (
                  <div
                    key={item.key}
                    className={[
                      'w-full rounded-xl border px-3 py-3 transition',
                      selectedPayableKey === item.key
                        ? 'border-emerald-500/35 bg-emerald-500/10'
                        : 'border-slate-800 bg-slate-950/70 hover:border-slate-600 hover:bg-slate-900/70',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                          <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950/60 px-2 py-[2px] text-[10px] uppercase tracking-[0.16em] text-slate-300">
                            {paymentItemBadge(item)}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">{paymentItemMeta(item)}</p>
                        <p className="hidden mt-2 text-[12px] text-slate-300">
                          {[item.due_label, item.status_label || item.status, item.required ? 'Required' : 'Optional'].filter(Boolean).join(' • ')}
                        </p>
                        <p className="hidden mt-2 text-[12px] text-slate-400">
                          {item.description || item.review_detail || 'Configured payment item for this circle.'}
                        </p>
                        <p className="hidden mt-2 text-[11px] text-slate-500">
                          {item.amount_cents != null
                            ? `Amount rule: ${formatNaira(Number(item.amount_cents) / 100)}`
                            : item.checkout_mode === 'quantity'
                              ? 'Amount rule: Quantity-based'
                              : item.checkout_mode === 'fixed'
                                ? 'Amount rule: Fixed amount'
                                : 'Amount rule: Open amount'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <p className="text-sm font-semibold text-slate-100">
                          {item.amount_cents != null ? formatNaira(Number(item.amount_cents) / 100) : item.checkout_mode === 'quantity' ? 'By quantity' : 'Open'}
                        </p>
                        <button
                          type="button"
                          onClick={() => openPayableItem(item)}
                          className={`inline-flex h-9 items-center justify-center rounded-lg border px-3 text-[11px] font-semibold ${paymentItemButtonClass(item)}`}
                        >
                          {selectedPayableKey === item.key ? 'Selected' : paymentItemButtonLabel(item)}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3">
                  <p className="text-sm font-semibold text-slate-100">No payment items yet</p>
                  {!activities?.length && uiCanCreateActivity ? (
                    <button
                      type="button"
                      onClick={onOpenActivities}
                      className="mt-3 rounded-lg border border-sky-400/40 bg-sky-400/10 px-3 py-2 text-[11px] font-semibold text-sky-100 hover:bg-sky-400/20"
                    >
                      Create a payment item
                    </button>
                  ) : null}
                  {!duePlan && !activities?.length && uiCanManageDuePlan && uiCanCreateActivity && isSportsCircle ? (
                    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Suggested sports setup</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={onOpenDueSetup}
                          className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/20"
                        >
                          Set up Monthly Dues
                        </button>
                        <button
                          type="button"
                          onClick={onOpenActivities}
                          className="rounded-xl border border-sky-400/40 bg-sky-400/10 px-3 py-2 text-[11px] font-semibold text-sky-100 hover:bg-sky-400/20"
                        >
                          Add Match Fee
                        </button>
                      </div>
                      <p className="mt-3 text-[11px] text-slate-500">
                        Suggested payment items for clubs and teams: Monthly Dues, Match Fee, and General Support. Nothing is created until you confirm it.
                      </p>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {false && informationalPayableItems.length ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Other dues & collections</p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">Configured items that are not currently available for payment by you.</p>
                  </div>
                  <p className="text-[11px] text-slate-500">{informationalPayableItems.length} item{informationalPayableItems.length === 1 ? '' : 's'}</p>
                </div>

                <div className="mt-3 space-y-3">
                  {informationalPayableItems.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => openPayableItem(item)}
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4 text-left transition hover:border-slate-600 hover:bg-slate-900/70"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                          <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">{item.type_label || item.type}</p>
                          <p className="mt-2 text-[12px] text-slate-300">
                            {[item.status_label || item.status, item.applicability_label, item.due_label].filter(Boolean).join(' • ')}
                          </p>
                          {item.review_detail ? <p className="mt-2 text-[12px] text-slate-500">{item.review_detail}</p> : null}
                        </div>
                        <div className="shrink-0 text-left md:text-right">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Review only</p>
                          {item.due_on ? <p className="mt-2 text-[11px] text-slate-500">Next cycle {safeDateLabel(item.due_on)}</p> : null}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <button
                type="button"
                onClick={() => setShowOtherOptions((prev) => !prev)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-left text-[12px] font-semibold text-slate-200 hover:bg-slate-900/70"
              >
                More Ways to Support
              </button>
              {showOtherOptions && supportPaymentItem ? (
                <button
                  type="button"
                  onClick={() => openPayableItem(supportPaymentItem)}
                  className="mt-3 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-3 text-left transition hover:border-slate-600 hover:bg-slate-900/70"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">General Support</p>
                      <p className="mt-1 text-[11px] text-slate-400">Optional contribution</p>
                    </div>
                    <span className="inline-flex h-9 items-center justify-center rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 text-[11px] font-semibold text-emerald-100">
                      Contribute
                    </span>
                  </div>
                </button>
              ) : null}
            </div>
          </div>
        )}

        {(isWithdraw || selectedPayable) && (
          <>
        <div className="flex flex-col gap-1">
          <p className="text-[12px] font-semibold text-slate-100">
            {isWithdraw ? 'Move money back to your wallet' : 'Review payment item'}
          </p>
          <p className="text-[11px] text-slate-400">
            {isWithdraw
              ? 'Withdraw from the shared mini-wallet into your personal BitBridge wallet.'
              : 'Review the selected payment item, confirm the setup, then approve the payment.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-5">
          {!isWithdraw && selectedPayable ? (
            <div className="mb-5 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Selected item</p>
                  <p className="mt-1 text-sm font-semibold text-slate-100">{selectedPayable.title}</p>
                  <p className="mt-1 text-[12px] text-slate-400">
                    {[selectedPayable.type_label || selectedPayable.type, selectedPayable.status_label || selectedPayable.status].filter(Boolean).join(' • ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetToPayableList}
                  className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-[11px] font-semibold text-slate-200 hover:bg-slate-900/70"
                >
                  Back to items
                </button>
              </div>
            </div>
          ) : null}

          {!isWithdraw && payableSelectionBlocked ? (
            <div className="mb-5 rounded-2xl border border-sky-500/25 bg-sky-500/10 p-4 text-[12px] text-sky-100">
              <p className="font-semibold text-sky-50">{selectedPayable?.status_label || 'Review dues'}</p>
              <p className="mt-2 text-sky-100/90">
                {nonPayableReason || 'This circle has a live dues plan, but there are no open periods available for payment right now.'}
              </p>
            </div>
          ) : null}

          {!payableSelectionBlocked ? (
          <div className="mb-5 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Step 2</p>
                <p className="text-sm font-semibold text-slate-100">Configure selected item</p>
              </div>
              <p className="text-[11px] text-slate-500">
                {selectedItemCheckoutMode === 'recurring'
                  ? 'Choose how many periods to cover.'
                  : selectedItemCheckoutMode === 'quantity'
                    ? 'Choose the quantity and review the total.'
                    : selectedItemCheckoutMode === 'fixed'
                      ? 'Review the locked amount for this item.'
                      : 'Enter the amount for this payment item.'}
              </p>
            </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0">
            {!isWithdraw && purpose === 'dues' ? (
              <div className="min-w-0">
                <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Periods to cover</label>
                <select
                  value={duePeriods}
                  onChange={(e) => setDuePeriods(e.target.value)}
                  className="w-full h-12 rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-100 outline-none"
                  disabled={busy || duePaymentPreset?.lockAmount || dueQuoteLoading}
                >
                  {Array.from({ length: dueMaxPeriods }, (_, index) => {
                    const value = String(index + 1)
                    return (
                      <option key={value} value={value}>
                        {index + 1} period{index === 0 ? '' : 's'}
                      </option>
                    )
                  })}
                </select>
              </div>
            ) : null}

            {!isWithdraw && purpose === 'activity' ? (
              <div className="min-w-0">
                <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Payment item</label>
                <select
                  value={selectedActivityId || ''}
                  onChange={(e) => setSelectedActivityId(e.target.value || '')}
                  className="w-full h-12 rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-100 outline-none"
                  disabled={busy || !hasActivities}
                >
                  <option value="">Select a goal</option>
                  {(activities || []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.status})
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="min-w-0">
              <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Amount</label>
              <div className="flex h-12 rounded-xl border border-slate-700 bg-slate-950/70 overflow-hidden">
                <span className="px-4 flex items-center text-xs text-slate-300 border-r border-slate-700">₦</span>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 px-4 text-sm bg-transparent text-slate-100 outline-none h-full min-w-0"
                  disabled={busy || (isWithdraw && !uiCanWithdraw) || selectedItemAmountLocked}
                />
              </div>
              {isWithdraw && (
                <p className="mt-2 text-[10px] text-slate-500">Max available: {formatNaira(balanceNaira)}</p>
              )}
            </div>

            <div className="min-w-0">
              <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">
                Note (optional)
              </label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  isWithdraw
                    ? 'Eg. Refund after bill…'
                    : purpose === 'dues'
                      ? 'Eg. April membership dues'
                      : purpose === 'activity'
                        ? 'Eg. Jersey contribution'
                        : 'Eg. Treasury top-up…'
                }
                className="w-full h-12 rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-100 outline-none min-w-0"
                disabled={busy || (isWithdraw && !uiCanWithdraw)}
              />
            </div>
          </div>

          {duePaymentActive && (
            <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-[11px] text-emerald-100">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-emerald-50">Due payment summary</p>
                  <p className="mt-1">
                    {dueQuoteLoading
                      ? 'Calculating coverage...'
                      : `Paying ${duePeriods} period${duePeriods === '1' ? '' : 's'} for ${formatNaira((dueQuotedAmountCents || effectiveAmountCents) / 100)}.`}
                  </p>
                </div>
                <div className="text-right">
                  <p>Open periods: {dueOpenPeriods}</p>
                  <p>Prepaid through: {duePrepaidThroughLabel || '—'}</p>
                  <p>Next due: {dueNextDateLabel || '—'}</p>
                </div>
              </div>
              <p className="mt-3 text-emerald-100/90">
                The backend will apply this payment to the oldest payable obligations first and settle only the quoted periods.
              </p>
            </div>
          )}

          {!isWithdraw && purpose === 'activity' && !hasActivities && (
            <div className="mt-4 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-[11px] text-sky-100">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p>No activities are available yet for this circle.</p>
                {uiCanCreateActivity ? (
                  <button
                    type="button"
                    onClick={onOpenActivities}
                    className="rounded-xl border border-sky-400/40 bg-sky-400/10 px-3 py-2 font-semibold text-sky-100 hover:bg-sky-400/20"
                  >
                    Create activity
                  </button>
                ) : null}
              </div>
            </div>
          )}

          {!isWithdraw && purpose === 'dues' && !showDuesPurpose && (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[11px] text-amber-100">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p>
                  {duesRecommended
                    ? 'This circle is designed for dues, but the dues plan has not been configured yet.'
                    : 'Dues payment is not available for this circle yet.'}
                </p>
                {duesRecommended && uiCanManageDuePlan ? (
                  <button
                    type="button"
                    onClick={onOpenDueSetup}
                    className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 font-semibold text-amber-100 hover:bg-amber-400/20"
                  >
                    Set Up Dues Plan
                  </button>
                ) : null}
              </div>
            </div>
          )}

          {!isWithdraw && purpose === 'general' && !duePaymentActive && (
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-[11px] text-slate-300">
              This payment will be recorded as General Support for the circle.
            </div>
          )}

          {!isWithdraw && purpose === 'special' && (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[11px] text-amber-100">
              This payment will be recorded as a special contribution for the active call configured on this circle.
            </div>
          )}

          {!isWithdraw && purpose === 'activity' && hasActivities && (
            <div className="mt-4 rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 py-3 text-[11px] text-sky-100">
              This payment will be linked to the selected item for progress reporting. The timeline remains the financial truth.
              {selectedActivity ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[10px] text-sky-100/90">
                  <span>Item: {selectedActivity.name}</span>
                  <span>Target: {formatNaira((selectedActivity.target_amount_cents || 0) / 100)}</span>
                  <span>Status: {selectedActivity.status || 'active'}</span>
                </div>
              ) : null}
            </div>
          )}

          {!isWithdraw && isOfficialCircle && isFlexibleOfficialCircle && isTier1User && Number(officialCapCents || 0) > 0 && (
            <div
              className={[
                'mt-4 rounded-xl border px-3 py-3 text-[11px]',
                overOfficialCap
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                  : 'border-sky-500/30 bg-sky-500/10 text-sky-100',
              ].join(' ')}
            >
              <p>You can contribute up to {formatCapAmount(officialCapCents)} with your current verification level.</p>
              <p className="mt-1 text-[10px] text-slate-300">Complete verification to unlock higher contributions.</p>
            </div>
          )}

          {showStandardTier1Notice && (
            <div className="mt-4 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-3 text-[11px] text-sky-100">
              <p>
                Tier 1 users can contribute up to {formatCapAmount(standardDailyCapCents)} per day across standard circles.
              </p>
              <p className="mt-1 text-[10px] text-slate-300">Complete Tier 2 verification to unlock higher contributions.</p>
            </div>
          )}

          </div>
          ) : null}

          {!isWithdraw && !payableSelectionBlocked && (
            <div className="mb-5 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Step 3</p>
                  <p className="text-sm font-semibold text-slate-100">Review and confirm</p>
                </div>
                <p className="text-[11px] text-slate-500">See exactly what the payment updates before you approve it.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Purpose</p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">{reviewPurposeLabel}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Linked item</p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">{reviewLinkedItem}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Amount</p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">{formatNaira(effectiveAmountCents / 100)}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">What this payment updates</p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">{reviewUpdateEffect}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Wallet debit</p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">{formatNaira(effectiveAmountCents / 100)}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Circle credit</p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">{formatNaira(effectiveAmountCents / 100)}</p>
                </div>
              </div>
            </div>
          )}

          <div className="sticky bottom-0 mt-5 flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/95 px-4 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-end">
            <div className="text-[11px] text-slate-500 sm:mr-auto">
              {isWithdraw
                ? 'This will debit the group and credit your wallet.'
                : payableSelectionBlocked
                  ? 'This circle has a live dues plan, but there is no dues payment available for your account right now.'
                  : purpose === 'activity'
                    ? 'This will debit your wallet, credit the circle, and tag the selected goal.'
                    : purpose === 'special'
                      ? 'This will debit your wallet and record a special contribution for the active call.'
                      : purpose === 'dues'
                        ? 'This will debit your wallet and settle the quoted due obligations.'
                        : 'This will debit your wallet and credit the circle treasury.'}
            </div>

            <div className="w-full sm:w-auto sm:min-w-[200px]">
              {payableSelectionBlocked ? (
                <ClassicBtn
                  htmlType="button"
                  onclick={onOpenDueSetup}
                  className={[
                    'w-full h-12 px-6 shadow-lg',
                    'flex items-center justify-center text-center',
                    'leading-none whitespace-nowrap',
                    '!bg-sky-400 !text-slate-950 hover:!bg-sky-300',
                  ].join(' ')}
                >
                  <span className="leading-none">Review dues</span>
                </ClassicBtn>
              ) : (
                <ClassicBtn
                htmlType="submit"
                disabled={busy || (isWithdraw && !uiCanWithdraw) || (purpose === 'activity' && !selectedActivityId)}
                className={[
                  'w-full h-12 px-6 shadow-lg',
                  'flex items-center justify-center text-center',
                  'leading-none whitespace-nowrap',
                  isWithdraw ? '!bg-slate-800 hover:!bg-slate-700' : '!bg-emerald-500 !text-slate-950 hover:!bg-emerald-400',
                ].join(' ')}
              >
                <span className="leading-none">
                  {busy ? (isWithdraw ? 'Withdrawing…' : 'Processing…') : primaryLabel}
                </span>
              </ClassicBtn>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-1">
            {localError && <p className="text-[11px] text-red-400">{localError}</p>}

            {!isWithdraw && depositError && <p className="text-[11px] text-red-400">{depositError}</p>}
            {!isWithdraw && depositSuccess && <p className="text-[11px] text-emerald-400">{depositSuccess}</p>}

            {isWithdraw && withdrawError && <p className="text-[11px] text-red-400">{withdrawError}</p>}
            {isWithdraw && withdrawSuccess && <p className="text-[11px] text-emerald-400">{withdrawSuccess}</p>}
          </div>
        </form>
          </>
        )}
      </div>
    </section>
  )
}

const CirclesDetailPage = () => {
  const { id } = useParams()
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const currentUser = useSelector((state) => state.auth.user)
  const currentUserTierRank = kycRank(currentUser?.kyc_level)

  const [depositing, setDepositing] = useState(false)
  const [depositError, setDepositError] = useState(null)
  const [depositSuccess, setDepositSuccess] = useState(null)

  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawError, setWithdrawError] = useState(null)
  const [withdrawSuccess, setWithdrawSuccess] = useState(null)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState(null)
  const [inviteSuccess, setInviteSuccess] = useState(null)
  const [memberDisplayName, setMemberDisplayName] = useState('')
  const [displayNameSaving, setDisplayNameSaving] = useState(false)
  const [displayNameError, setDisplayNameError] = useState(null)
  const [displayNameSuccess, setDisplayNameSuccess] = useState(null)

  const [activeDisputeTx, setActiveDisputeTx] = useState(null)
  const [reactionBusy, setReactionBusy] = useState({})

  const [activeSection, setActiveSection] = useState('overview')
  const [rightTab, setRightTab] = useState('timeline')
  const [workspaceMode, setWorkspaceMode] = useState('member')
  const [settingsForm, setSettingsForm] = useState({
    name: '',
    purpose: '',
    description: '',
    circle_archetype: 'general_circle',
    badge_label: '',
    visibility: 'private',
    withdrawal_approval_threshold: '',
    governance_setup_completed: false,
    min_contribution_ngn: '',
    max_contribution_ngn: '',
  })
  const [settingsRecommendations, setSettingsRecommendations] = useState({})
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsError, setSettingsError] = useState(null)
  const [settingsSaveError, setSettingsSaveError] = useState(null)
  const [settingsSaveSuccess, setSettingsSaveSuccess] = useState(null)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsSection, setSettingsSection] = useState('membership')
  const [membershipSettings, setMembershipSettings] = useState({})
  const [operationsSettings, setOperationsSettings] = useState({})
  const [duePlanForm, setDuePlanForm] = useState({
    amount_ngn: '',
    cadence: 'monthly',
    due_day_of_month: '1',
    due_weekday: '1',
    due_month_of_year: '1',
    grace_period_days: '0',
    starts_on: '',
    ends_on: '',
    enrolled_roles: ['member', 'admin', 'treasurer'],
    due_scope: 'everyone',
  })
  const [duePlanLoading, setDuePlanLoading] = useState(false)
  const [duePlanError, setDuePlanError] = useState(null)
  const [duePlanSaveError, setDuePlanSaveError] = useState(null)
  const [duePlanSaveSuccess, setDuePlanSaveSuccess] = useState(null)
  const [duePlanSaving, setDuePlanSaving] = useState(false)

  // Activities
  const [activities, setActivities] = useState([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [activitiesError, setActivitiesError] = useState(null)

  const [creatingActivity, setCreatingActivity] = useState(false)
  const [activityName, setActivityName] = useState('')
  const [activityTarget, setActivityTarget] = useState('')
  const [activityDeadline, setActivityDeadline] = useState('')
  const [activityFreq, setActivityFreq] = useState('one_time')
  const [activityTemplatePreset, setActivityTemplatePreset] = useState(null)
  const [activityCreateError, setActivityCreateError] = useState(null)
  const [activityCreateSuccess, setActivityCreateSuccess] = useState(null)

  const [selectedActivityId, setSelectedActivityId] = useState('')
  const [depositPreset, setDepositPreset] = useState(null)
  const [payableItemsData, setPayableItemsData] = useState(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerActivityId, setDrawerActivityId] = useState(null)

  const [audit, setAudit] = useState(null)
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState(null)
  const [circleStatements, setCircleStatements] = useState([])
  const [circleStatementsLoading, setCircleStatementsLoading] = useState(false)
  const [circleStatementsError, setCircleStatementsError] = useState(null)
  const [circleStatementsSubmitting, setCircleStatementsSubmitting] = useState(false)
  const [circleStatementForm, setCircleStatementForm] = useState(() => {
    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    return {
      range_key: 'this_month',
      output_format: 'pdf',
      date_from: toInputDate(monthStart),
      date_to: toInputDate(today),
    }
  })

  // ---- PIN modal state (fund + withdraw) ----
  const [pinOpen, setPinOpen] = useState(false)
  const [pinBusy, setPinBusy] = useState(false)
  const [pinError, setPinError] = useState(null)

  useEffect(() => {
    if (!id) return
    dispatch(setOwnerMode({ mode: 'circle', circleId: id }))
  }, [dispatch, id])
  const [pinTitle, setPinTitle] = useState('Enter Transaction PIN')
  const [pendingAction, setPendingAction] = useState(null) // 'fund' | 'withdraw'
  const [pendingPayload, setPendingPayload] = useState(null)

  const hasToken = () => Boolean(getAccessToken())

  const applySettingsPayload = (payload) => {
    const root = payload?.data || payload || {}
    const identity = root.identity || {}
    const governance = root.governance || {}
    const contributions = root.contributions || {}

    setSettingsRecommendations(root.recommended_defaults || {})
    setMembershipSettings(root.membership || {})
    setOperationsSettings(root.operations || {})
    setSettingsForm({
      name: identity.name || '',
      purpose: identity.purpose || '',
      description: identity.description || '',
      circle_archetype: identity.circle_archetype || 'general_circle',
      badge_label: identity.badge_label || '',
      visibility: root?.privacy?.visibility || 'private',
      withdrawal_approval_threshold: governance.configured_withdrawal_approval_threshold ?? '',
      governance_setup_completed: Boolean(governance.governance_setup_completed),
      min_contribution_ngn: formatMinorUnitsToMajorUnitString(contributions.minimum_contribution_cents),
      max_contribution_ngn: formatMinorUnitsToMajorUnitString(contributions.maximum_contribution_cents),
    })
  }

  const applyDuePlanPayload = (payload) => {
    const plan = payload?.data || payload || null
    if (!plan) {
      setDuePlanForm((prev) => ({
        ...prev,
        amount_ngn: '',
        enrolled_roles: rolesForDueScope('everyone'),
        due_scope: 'everyone',
      }))
      return
    }

    const enrolledRoles = Array.isArray(plan.enrolled_roles) && plan.enrolled_roles.length ? plan.enrolled_roles : rolesForDueScope('everyone')
    setDuePlanForm({
      amount_ngn: formatMinorUnitsToMajorUnitString(plan.amount_cents),
      cadence: plan.cadence || 'monthly',
      due_day_of_month: String(plan.due_day_of_month || '1'),
      due_weekday: String(plan.due_weekday ?? '1'),
      due_month_of_year: String(plan.due_month_of_year || '1'),
      grace_period_days: String(plan.grace_period_days || '0'),
      starts_on: plan.starts_on || '',
      ends_on: plan.ends_on || '',
      enrolled_roles: enrolledRoles,
      due_scope: dueScopeFromRoles(enrolledRoles),
    })
  }

  const scrollToTransfer = () => {
    try {
      document.getElementById('transfer-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch {
      // no-op
    }
  }

  const scrollToInvitePanel = () => {
    try {
      document.getElementById('circle-invite-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch {
      // no-op
    }
  }

  const openDrawer = (actId) => {
    setDrawerActivityId(actId)
    setDrawerOpen(true)
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setDrawerActivityId(null)
  }

  const openPinFor = ({ action, title, payload }) => {
    setPinError(null)
    setPendingAction(action)
    setPendingPayload(payload)
    setPinTitle(title || 'Enter Transaction PIN')
    setPinOpen(true)
  }

  // ✅ Cancel PIN now clears loading flags too
  const cancelPin = () => {
    if (pinBusy) return
    setPinOpen(false)
    setPendingAction(null)
    setPendingPayload(null)
    setPinError(null)

    // important: stop the Transfer button spinners
    setDepositing(false)
    setWithdrawing(false)
  }

  const fetchActivities = async () => {
    if (!group?.id) return
    if (!hasToken()) return

    try {
      setActivitiesLoading(true)
      setActivitiesError(null)

      const res = await listCircleActivities(group.id)
      const data = res?.data

      setActivities(Array.isArray(data) ? data : data?.activities || [])
    } catch (e) {
      setActivitiesError(e?.response?.data?.errors?.join(', ') || e.message || 'Unable to load activities.')
      setActivities([])
    } finally {
      setActivitiesLoading(false)
    }
  }

  const fetchAuditSummary = async () => {
    if (!group?.id) return
    if (!hasToken()) return

    try {
      setAuditLoading(true)
      setAuditError(null)

      const res = await getCircleAuditSummary(group.id)
      setAudit(res?.data || null)
    } catch (e) {
      setAuditError(e?.response?.data?.errors?.join(', ') || e.message || 'Unable to load audit summary.')
      setAudit(null)
    } finally {
      setAuditLoading(false)
    }
  }

  const fetchCircleStatements = async ({ silent = false } = {}) => {
    if (!group?.id) return
    if (!hasToken()) return
    if (!uiCanViewReports) return

    try {
      if (!silent) setCircleStatementsLoading(true)
      setCircleStatementsError(null)
      const data = await listCircleStatements(group.id)
      setCircleStatements(Array.isArray(data) ? data : [])
    } catch (e) {
      setCircleStatementsError(e?.response?.data?.message || e?.response?.data?.error || e.message || 'Unable to load statements right now.')
      if (!silent) setCircleStatements([])
    } finally {
      if (!silent) setCircleStatementsLoading(false)
    }
  }

  const handleCircleStatementFormChange = (field, value) => {
    setCircleStatementForm((current) => ({ ...current, [field]: value }))
  }

  const validateCircleStatementRequest = () => {
    if (circleStatementForm.range_key !== 'custom') return true
    if (!circleStatementForm.date_from || !circleStatementForm.date_to) {
      toast('Select a valid statement period.', { type: 'error' })
      return false
    }
    if (circleStatementForm.date_to < circleStatementForm.date_from) {
      toast('End date must be on or after the start date.', { type: 'error' })
      return false
    }
    if (dayDifference(circleStatementForm.date_from, circleStatementForm.date_to) > 366) {
      toast('Statement range must be within 366 days.', { type: 'error' })
      return false
    }
    return true
  }

  const handleRequestCircleStatement = async () => {
    if (!group?.id || !uiCanViewReports) return
    if (!validateCircleStatementRequest()) return

    try {
      setCircleStatementsSubmitting(true)
      const payload = {
        range_key: circleStatementForm.range_key,
        output_format: circleStatementForm.output_format,
      }
      if (circleStatementForm.range_key === 'custom') {
        payload.date_from = circleStatementForm.date_from
        payload.date_to = circleStatementForm.date_to
      }
      const statement = await createCircleStatement(group.id, payload)
      setCircleStatements((current) => [statement, ...current.filter((item) => item.id !== statement?.id)])
      toast('Statement request submitted. We will prepare it shortly.', { type: 'success' })
    } catch (e) {
      const message = e?.response?.data?.message || e?.response?.data?.error || e.message || 'Unable to request a statement right now.'
      toast(message, { type: 'error' })
    } finally {
      setCircleStatementsSubmitting(false)
    }
  }

  const openCircleStatementDownload = (statement) => {
    if (!statement?.download_url) return
    window.open(statement.download_url, '_blank', 'noopener,noreferrer')
  }

  const handlePinConfirm = async (pin) => {
    if (!group?.id) return
    if (!pendingAction || !pendingPayload) return

    if (!hasToken()) {
      setPinError('Your session has expired. Please log in again.')
      return
    }

    try {
      setPinBusy(true)
      setPinError(null)

      if (pendingAction === 'fund') {
        const { payment_item_title: paymentItemTitle, ...fundPayload } = pendingPayload
        const res = await fundCircle(group.id, { ...fundPayload, pin })
        const body = res?.data || {}

        const newBalanceCents =
          typeof body.balance_cents === 'number'
            ? body.balance_cents
            : group.balance_cents + pendingPayload.amount_cents

        const circleActivityId = pendingPayload.circle_activity_id || null
        const linkedAct = circleActivityId ? (activities || []).find((a) => a.id === circleActivityId) : null
        const paymentPurpose = pendingPayload.payment_purpose || (circleActivityId ? 'activity_goal' : 'treasury_topup')
        const paymentPurposeLabel =
          paymentPurpose === 'dues'
            ? 'Dues payment'
            : paymentPurpose === 'activity_goal'
              ? 'Goal contribution'
              : paymentPurpose === 'special_call'
                ? 'Special contribution'
                : 'General Support'
        const itemTitle = paymentItemTitle || linkedAct?.name || paymentPurposeLabel

        setActivity((prev) => [
          {
            id: `local-fund-${Date.now()}`,
            amount_cents: pendingPayload.amount_cents,
            direction: 'credit',
            kind: 'fund',
            description: pendingPayload.note || itemTitle,
            occurred_at: new Date().toISOString(),
            user: { email: 'You' },
            reactions: { counts: {}, mine: [] },
            payment_purpose: paymentPurpose,
            payment_purpose_label: itemTitle,
            payment_item_title: itemTitle,
            circle_activity_id: circleActivityId,
            circle_activity: linkedAct
              ? {
                  id: linkedAct.id,
                  name: linkedAct.name,
                  status: linkedAct.status,
                  target_amount_cents: linkedAct.target_amount_cents,
                  deadline_at: linkedAct.deadline_at,
                }
              : null,
          },
          ...(prev || []),
        ])

        const refreshAfterFund = await getCircleWorkspace(group.id).catch(() => null)
        if (refreshAfterFund?.data) {
          setGroup(refreshAfterFund.data)
        } else {
          setGroup({
            ...group,
            balance_cents: newBalanceCents,
            treasury_balance_cents: newBalanceCents,
          })
        }

        setDepositSuccess(`Funded ${group.name}.`)
        setDepositError(null)
      }

      if (pendingAction === 'withdraw') {
        const res = await withdrawCircle(group.id, { ...pendingPayload, pin })
        const body = res?.data || {}

        const newBalanceCents =
          typeof body.balance_cents === 'number'
            ? body.balance_cents
            : group.balance_cents - pendingPayload.amount_cents

        setActivity((prev) => [
          {
            id: `local-withdraw-${Date.now()}`,
            amount_cents: pendingPayload.amount_cents,
            direction: 'debit',
            kind: 'payout',
            description: pendingPayload.note || 'Payout to main wallet',
            occurred_at: new Date().toISOString(),
            user: { email: 'You' },
            reactions: { counts: {}, mine: [] },
          },
          ...(prev || []),
        ])

        const refreshAfterWithdraw = await getCircleWorkspace(group.id).catch(() => null)
        if (refreshAfterWithdraw?.data) {
          setGroup(refreshAfterWithdraw.data)
        } else {
          setGroup({
            ...group,
            balance_cents: newBalanceCents,
            treasury_balance_cents: newBalanceCents,
          })
        }

        setWithdrawSuccess('Withdrawn to your wallet.')
        setWithdrawError(null)
      }

      // ✅ refresh summary/audit (and activities if user is viewing that tab)
      fetchAuditSummary()
      if (activeSection === 'transactions' && rightTab === 'activities') fetchActivities()

      setPinOpen(false)
      setPendingAction(null)
      setPendingPayload(null)
    } catch (e) {
      const status = e?.response?.status
      const data = e?.response?.data || {}
      const errors = Array.isArray(data.errors) ? data.errors.join(', ') : ''
      const baseMsg = data.message || errors || data.error || e?.message || 'Unable to verify PIN right now.'

      if (status === 429 && data.retry_after_seconds) {
        const minutes = Math.max(1, Math.ceil(data.retry_after_seconds / 60))
        setPinError(data.message || `Too many failed attempts. Try again in ${minutes} minute(s).`)
      } else if (status === 422 && typeof data.attempts_remaining === 'number') {
        setPinError(`${baseMsg} (${data.attempts_remaining} attempt${data.attempts_remaining === 1 ? '' : 's'} left)`)
      } else {
        setPinError(baseMsg)
      }
    } finally {
      setPinBusy(false)

      // ✅ end Transfer spinners after the PIN flow finishes
      setDepositing(false)
      setWithdrawing(false)
    }
  }

  // ---- Initial fetch circle ----
  useEffect(() => {
    const fetchCircle = async () => {
      try {
        setLoading(true)
        setError(null)

        if (!hasToken()) {
          setError('Your session has expired. Please log in again.')
          return
        }

        const res = await getCircleWorkspace(id)
        const data = res?.data

        setGroup(data)
        setMembers(data?.members || [])
        setActivity(data?.recent_transactions || [])
        try {
          setSettingsLoading(true)
          setSettingsError(null)
          const settingsRes = await getCircleSettings(id)
          applySettingsPayload(settingsRes?.data)
        } catch (settingsErr) {
          setSettingsError(
            settingsErr?.response?.data?.errors?.join(', ') ||
              settingsErr?.response?.data?.error ||
              settingsErr?.message ||
              'Unable to load circle settings.'
          )
        } finally {
          setSettingsLoading(false)
        }

        try {
          setDuePlanLoading(true)
          setDuePlanError(null)
          const duePlanRes = await getCircleDuePlan(id)
          applyDuePlanPayload(duePlanRes?.data)
        } catch (dueErr) {
          setDuePlanError(
            dueErr?.response?.data?.errors?.join(', ') ||
              dueErr?.response?.data?.error ||
              dueErr?.message ||
              'Unable to load the dues plan.'
          )
        } finally {
          setDuePlanLoading(false)
        }
      } catch (err) {
        console.error('[CircleDetail] fetchCircle error:', err)
        const status = err?.response?.status
        if (status === 404) setError('This group could not be found.')
        else if (status === 401) setError('You are not authorised. Please log in again.')
        else if (status === 403 && !canUseCircles(currentUser)) {
          toast.info(withCircleAccessMissingDetails(currentUser, 'Verify your phone and complete Tier 1 to use shared groups.'), {
            position: 'top-right',
            autoClose: 4000,
            pauseOnHover: true,
          })
          navigate('/dashboard/kyc')
        } else {
          setError(err?.response?.data?.errors?.join(', ') || err.message || 'Unable to load this group.')
        }
      } finally {
        setLoading(false)
      }
    }

    if (id) fetchCircle()
  }, [currentUser, id, navigate])

  const createdLabel = group?.created_at
    ? new Date(group.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''

  const balanceNaira = Number((group?.treasury_balance_cents ?? group?.balance_cents) || 0) / 100
  const isOfficialCircle = group?.circle_type === 'official'
  const officialBadgeLabel = group?.badge_label || 'Official BitBridge Circle'
  const isFlexibleOfficialCircle = isOfficialCircle && group?.kyc_mode === 'flexible'
  const isOfficialFeatured = group?.visibility === 'official_featured'
  const officialCapCents = Number(group?.max_contribution_cents || 0)
  const isTier1User = currentUserTierRank === 1
  const standardDailyCapCents = 10000000

  const currentRole = (group?.current_user_role || '').toLowerCase()
  const isOwner = currentRole === 'owner'
  const isAdmin = currentRole === 'admin'
  const typeProfile = group?.circle_type_profile || {}
  const archetypeLabel =
    CIRCLE_ARCHETYPE_OPTIONS.find((option) => option.value === group?.circle_archetype)?.label || 'General Circle'
  const productBucketKey = String(typeProfile.product_bucket_key || '').trim()
  const promotedBucketLabel = typeProfile.product_bucket_label || 'Associations'
  const typeLabel = typeProfile.type_label || archetypeLabel
  const bucketSubtitle =
    typeProfile.subtitle ||
    'Run your group finances properly with collections, visibility, and operating control.'
  const suggestedActions = Array.isArray(typeProfile.suggested_actions) ? typeProfile.suggested_actions : []
  const setupChecklist = Array.isArray(typeProfile.setup_checklist) ? typeProfile.setup_checklist : []
  const duesRecommended = Boolean(typeProfile.due_plan_recommended)
  const duePlan = group?.monthly_due_plan || null
  const dueLabel = typeProfile?.adaptive_labels?.due_label || 'Dues'
  const suggestedPaymentTemplates = PAYMENT_TEMPLATES_BY_BUCKET[productBucketKey] || []
  const dueOpenPeriods = Number(duePlan?.current_user_due_summary?.payable_periods_count || duePlan?.current_user_due_summary?.payable_months_count || 0)
  const dueTotalOpenCents = Number(duePlan?.current_user_due_summary?.total_open_amount_cents || 0)
  const dueCurrentAmountCents = Number(duePlan?.current_user_obligation?.amount_cents || dueTotalOpenCents || 0)
  const duePrepaidThroughLabel = duePlan?.current_user_due_summary?.prepaid_through_label || ''
  const dueUserState = duePlan?.current_user_due_state || duePlan?.current_user_due_summary?.state || null
  const dueStatusLabel = duePlan?.current_user_obligation?.status || ''
  const dueNextDateLabel = safeDateLabel(duePlan?.current_user_obligation?.due_on || duePlan?.current_cycle_due_on)
  const dueApplicabilityLabel = duePlan ? formatRoleScopeLabel(duePlan?.enrolled_roles) : ''
  const backendCanWithdraw = Boolean(group?.can_withdraw)
  const uiCanWithdraw = (isOwner || isAdmin) && backendCanWithdraw
  const uiCanCreateActivity = isOwner || isAdmin
  const uiCanInviteMembers = Boolean(group?.permissions?.can_invite_members || isOwner || isAdmin)
  const uiCanManageDuePlan = Boolean(group?.permissions?.can_manage_due_plan || isOwner || isAdmin || currentRole === 'treasurer')
  const uiCanManageSettings = Boolean(group?.permissions?.can_manage_settings || isOwner || isAdmin)
  const uiCanManageGovernance = Boolean(group?.permissions?.can_manage_governance || isOwner || isAdmin)
  const uiCanViewReports = Boolean(group?.permissions?.can_view_reports || isOwner || isAdmin || currentRole === 'treasurer')
  const uiCanPayDues = Boolean(group?.permissions?.can_pay_dues)
  const hasManageAccess = uiCanManageDuePlan || uiCanManageSettings || uiCanManageGovernance || uiCanInviteMembers || uiCanWithdraw

  const withdrawalLockedReason = !backendCanWithdraw
    ? 'Withdrawals are not available for your account in this group.'
    : !(isOwner || isAdmin)
    ? 'Only the group creator/admin can withdraw.'
    : ''

  const memberCount = Array.isArray(members) ? members.length : 0
  const managerCount = Number(operationsSettings?.members_summary?.manager_count || group?.manager_count || 0)
  const membersMasked = Array.isArray(members) ? members.some((m) => m?.masked) : false
  const currentMember = useMemo(
    () => (members || []).find((member) => String(member?.user?.id || '') === String(currentUser?.id || '')) || null,
    [members, currentUser?.id]
  )

  const handleSettingsChange = (event) => {
    const { name, type, checked, value } = event.target
    setSettingsSaveError(null)
    setSettingsSaveSuccess(null)
    setSettingsForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSettingsSubmit = async (event) => {
    event.preventDefault()
    if (!group?.id || !(uiCanManageSettings || uiCanManageGovernance)) return

    try {
      setSettingsSaving(true)
      setSettingsSaveError(null)
      setSettingsSaveSuccess(null)

      const payload = {
        settings: {
          identity: {
            name: settingsForm.name,
            purpose: settingsForm.purpose,
            description: settingsForm.description,
            circle_archetype: settingsForm.circle_archetype,
            badge_label: settingsForm.badge_label,
          },
          governance: {
            governance_setup_completed: Boolean(settingsForm.governance_setup_completed),
            withdrawal_approval_threshold: settingsForm.withdrawal_approval_threshold === ''
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
        },
      }

      const response = await updateCircleSettings(group.id, payload)
      applySettingsPayload(response?.data)
      const refresh = await getCircleWorkspace(group.id)
      const freshGroup = refresh?.data || group
      setGroup(freshGroup)
      setMembers(freshGroup?.members || members)
      setActivity(freshGroup?.recent_transactions || activity)
      setSettingsSaveSuccess('Circle settings updated.')
    } catch (saveErr) {
      setSettingsSaveError(
        saveErr?.response?.data?.errors?.join(', ') ||
          saveErr?.response?.data?.error ||
          saveErr?.message ||
          'Unable to update circle settings.'
      )
    } finally {
      setSettingsSaving(false)
    }
  }

  const handleDuePlanChange = (event) => {
    const { name, value } = event.target
    setDuePlanSaveError(null)
    setDuePlanSaveSuccess(null)

    if (name === 'due_scope') {
      const mappedRoles = rolesForDueScope(value)
      setDuePlanForm((prev) => ({
        ...prev,
        due_scope: value,
        enrolled_roles: mappedRoles || (Array.isArray(prev.enrolled_roles) && prev.enrolled_roles.length ? prev.enrolled_roles : ['member']),
      }))
      return
    }

    setDuePlanForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleDuePlanRoleToggle = (role) => {
    setDuePlanSaveError(null)
    setDuePlanSaveSuccess(null)
    setDuePlanForm((prev) => {
      const activeRoles = Array.isArray(prev.enrolled_roles) ? prev.enrolled_roles : []
      const nextRoles = activeRoles.includes(role)
        ? activeRoles.filter((item) => item !== role)
        : [...activeRoles, role]

      return {
        ...prev,
        enrolled_roles: nextRoles.length ? nextRoles : ['member'],
        due_scope: dueScopeFromRoles(nextRoles.length ? nextRoles : ['member']),
      }
    })
  }

  const applySuggestedTemplate = (template) => {
    if (!template || template.disabled) return

    if (template.setup_type === 'recurring') {
      setWorkspaceMode('manage')
      setActiveSection('dues')
      setRightTab('settings')
      setSettingsSection('operations')
      setDuePlanSaveError(null)
      setDuePlanSaveSuccess(null)
      setDuePlanForm((prev) => ({
        ...prev,
        amount_ngn: '',
        cadence: template.cadence || 'monthly',
        due_day_of_month: '1',
        due_weekday: '1',
        due_month_of_year: '1',
        grace_period_days: '0',
        starts_on: prev.starts_on || '',
        ends_on: '',
        enrolled_roles: ['member', 'admin', 'treasurer'],
        due_scope: 'everyone',
      }))
      setTimeout(() => {
        document.getElementById('section-settings-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 0)
      return
    }

    setWorkspaceMode('manage')
    setActiveSection('transactions')
    setRightTab('activities')
    setActivityCreateError(null)
    setActivityCreateSuccess(null)
    setActivityTemplatePreset(template)
    setActivityName(template.title || '')
    setActivityTarget('')
    setActivityDeadline('')
    setActivityFreq(template.contribution_frequency || 'one_time')
    setTimeout(() => {
      document.getElementById('section-records')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  const openPaymentItemManager = (item) => {
    if (!item) return

    if (item.linked_reference_type === 'CircleDuePlan' || item.type === 'dues') {
      setWorkspaceMode('manage')
      setActiveSection('dues')
      setRightTab('settings')
      setSettingsSection('operations')
      setTimeout(() => {
        document.getElementById('section-settings-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 0)
      return
    }

    setWorkspaceMode('manage')
    setActiveSection('transactions')
    setRightTab('activities')
    setActivityTemplatePreset(null)
    setTimeout(() => {
      document.getElementById('section-records')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  const handleDuePlanSubmit = async (event) => {
    event.preventDefault()
    if (!group?.id || !uiCanManageDuePlan) return

    try {
      setDuePlanSaving(true)
      setDuePlanSaveError(null)
      setDuePlanSaveSuccess(null)

      const payload = {
        amount_cents: parseMajorUnitInputToMinorUnits(duePlanForm.amount_ngn),
        cadence: duePlanForm.cadence,
        grace_period_days: Number(duePlanForm.grace_period_days || 0),
        starts_on: duePlanForm.starts_on || null,
        ends_on: duePlanForm.ends_on || null,
        enrolled_roles: duePlanForm.enrolled_roles,
      }

      if (duePlanForm.cadence === 'weekly') {
        payload.due_weekday = Number(duePlanForm.due_weekday || 1)
      } else {
        payload.due_day_of_month = Number(duePlanForm.due_day_of_month || 1)
      }

      if (duePlanForm.cadence === 'yearly') {
        payload.due_month_of_year = Number(duePlanForm.due_month_of_year || 1)
      }

      const response = operationsSettings?.due_plan?.id
        ? await updateCircleDuePlan(group.id, payload)
        : await createCircleDuePlan(group.id, payload)

      applyDuePlanPayload(response?.data)
      setOperationsSettings((prev) => ({
        ...(prev || {}),
        due_plan: response?.data?.data || response?.data || null,
      }))
      const refresh = await getCircleWorkspace(group.id)
      setGroup(refresh?.data || null)
      setDuePlanSaveSuccess(operationsSettings?.due_plan?.id ? 'Dues plan updated.' : 'Dues plan created.')
    } catch (err) {
      setDuePlanSaveError(
        err?.response?.data?.errors?.join(', ') ||
          err?.response?.data?.error ||
          err?.message ||
          'Unable to save the dues plan.'
      )
    } finally {
      setDuePlanSaving(false)
    }
  }

  const handlePayDueNow = async () => {
    if (!group?.id || !uiCanPayDues) return

    try {
      setDepositError(null)
      setDepositSuccess(null)
      const response = await quoteCircleDuePlan(group.id, { periods_count: 1 })
      const quote = response?.data?.data || response?.data || {}
      const obligationIds = Array.isArray(quote?.obligation_ids) ? quote.obligation_ids : []
      const totalAmount = Number(quote?.total_amount_cents || 0)

      if (!obligationIds.length || totalAmount <= 0) {
        setDepositError('There is no payable due period right now.')
        return
      }

      setDepositPreset({
        amount: String(totalAmount / 100),
        note: dueLabel,
        circleDueObligationIds: obligationIds,
        lockAmount: true,
      })
      setActiveSection('overview')
      scrollToTransfer()
    } catch (err) {
      setDepositError(
        err?.response?.data?.errors?.join(', ') ||
          err?.response?.data?.error ||
          err?.message ||
          'Unable to prepare due payment right now.'
      )
    }
  }

  const orderedActivity = useMemo(() => (Array.isArray(activity) ? activity : []), [activity])

  const recentTotalInNaira =
    orderedActivity
      ?.filter((tx) => tx.direction === 'credit' || tx.direction === 'in')
      .reduce((sum, tx) => sum + (tx.amount_cents || 0), 0) / 100 || 0

  const recentTotalOutNaira =
    orderedActivity
      ?.filter((tx) => tx.direction === 'debit' || tx.direction === 'out')
      .reduce((sum, tx) => sum + (tx.amount_cents || 0), 0) / 100 || 0

  const patchTxReactions = (txId, updater) => {
    setActivity((prev) =>
      (prev || []).map((t) => {
        if (t.id !== txId) return t
        const safe = { ...t, reactions: t.reactions || { counts: {}, mine: [] } }
        return updater(safe)
      })
    )
  }

  const toggleReaction = async (tx, emoji) => {
    if (!tx?.id) return
    if (!ALLOWED_EMOJIS.includes(emoji)) return

    if (!hasToken()) {
      setError('Your session has expired. Please log in again.')
      return
    }

    const txId = tx.id
    const alreadyMine = Boolean(tx?.reactions?.mine?.includes(emoji))

    setReactionBusy((prev) => ({ ...prev, [txId]: emoji }))

    patchTxReactions(txId, (safeTx) => {
      const counts = { ...(safeTx.reactions?.counts || {}) }
      const mine = Array.isArray(safeTx.reactions?.mine) ? [...safeTx.reactions.mine] : []

      if (alreadyMine) {
        const idx = mine.indexOf(emoji)
        if (idx >= 0) mine.splice(idx, 1)
        counts[emoji] = Math.max(0, Number(counts[emoji] || 0) - 1)
      } else {
        if (!mine.includes(emoji)) mine.push(emoji)
        counts[emoji] = Number(counts[emoji] || 0) + 1
      }

      return { ...safeTx, reactions: { counts, mine } }
    })

    try {
      if (alreadyMine) await unreactToCircleTx(txId, emoji)
      else await reactToCircleTx(txId, emoji)
    } catch (e) {
      console.error('[Reactions] toggle error:', e)
    } finally {
      setReactionBusy((prev) => {
        const copy = { ...prev }
        delete copy[txId]
        return copy
      })
    }
  }

  // ✅ Deposit triggers PIN modal (spinner stays on until PIN flow ends)
  const onDeposit = async ({ amountValue, note, paymentItemTitle, paymentPurpose, circleActivityId, circleDueObligationIds }) => {
    if (!group) return

    setDepositError(null)
    setDepositSuccess(null)

    if (!hasToken()) {
      setDepositError('Your session has expired. Please log in again.')
      return
    }

    setDepositing(true)

    const payload = {
      amount_cents: Math.round(amountValue * 100),
      note,
      payment_item_title: paymentItemTitle || undefined,
      payment_purpose: paymentPurpose || undefined,
      circle_activity_id: circleActivityId || null,
      circle_due_obligation_ids: Array.isArray(circleDueObligationIds) && circleDueObligationIds.length ? circleDueObligationIds : undefined,
    }

    openPinFor({
      action: 'fund',
      title: 'Enter Transaction PIN to Fund Group',
      payload,
    })
  }

  // ✅ Withdraw triggers PIN modal (spinner stays on until PIN flow ends)
  const onWithdraw = async ({ amountValue, note }) => {
    if (!group) return

    setWithdrawError(null)
    setWithdrawSuccess(null)

    if (!hasToken()) {
      setWithdrawError('Your session has expired. Please log in again.')
      return
    }

    setWithdrawing(true)

    const payload = {
      amount_cents: Math.round(amountValue * 100),
      note,
    }

    openPinFor({
      action: 'withdraw',
      title: 'Enter Transaction PIN to Withdraw',
      payload,
    })
  }

  const handleInvite = async (e) => {
    e.preventDefault()
    if (!group) return
    if (!uiCanInviteMembers) {
      setInviteError('Only group creators and admins can invite members.')
      return
    }
    const email = inviteEmail.trim()
    if (!email) return setInviteError('Enter an email to add.')

    try {
      setInviting(true)
      setInviteError(null)
      setInviteSuccess(null)

      if (!hasToken()) {
        setInviteError('Your session has expired. Please log in again.')
        return
      }

      const res = await inviteCircleMember(group.id, { email, role: 'member' })
      const newMembership = res?.data

      if (newMembership) {
        setMembers((prev) => [...(prev || []), newMembership])
      }
      setInviteEmail('')
      setInviteSuccess(`Added ${email} to this group.`)
    } catch (err) {
      const msg =
        err?.response?.data?.errors?.join(', ') ||
        err?.response?.data?.error ||
        err?.message ||
        'Unable to add this person.'
      setInviteError(msg)
    } finally {
      setInviting(false)
    }
  }

  const handleSaveDisplayName = async (e) => {
    e.preventDefault()
    if (!group?.id) return

    try {
      setDisplayNameSaving(true)
      setDisplayNameError(null)
      setDisplayNameSuccess(null)

      const response = await updateMyCircleMembership(group.id, {
        display_name: memberDisplayName.trim() || null,
      })
      const updatedMembership = response?.data || response

      setMembers((prev) =>
        (prev || []).map((member) =>
          String(member?.id || '') === String(updatedMembership?.id || '')
            ? { ...member, ...updatedMembership, user: { ...(member?.user || {}), ...(updatedMembership?.user || {}) } }
            : member
        )
      )
      setDisplayNameSuccess('Circle Name updated.')
    } catch (err) {
      setDisplayNameError(
        err?.response?.data?.errors?.join(', ') ||
          err?.response?.data?.error ||
          err?.message ||
          'Unable to update your Circle Name.'
      )
    } finally {
      setDisplayNameSaving(false)
    }
  }

  useEffect(() => {
    if (!currentMember) return
    setMemberDisplayName(currentMember?.display_name || currentMember?.user?.display_name || '')
  }, [currentMember])

  useEffect(() => {
    if (activeSection === 'transactions' && rightTab === 'activities') fetchActivities()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, rightTab, group?.id])

  useEffect(() => {
    if (group?.id) fetchActivities()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.id])

  useEffect(() => {
    if (!group?.id || !hasToken()) return

    let cancelled = false

    getCirclePaymentItems(group.id)
      .then((response) => {
        if (cancelled) return
        const payload = response?.data?.data || response?.data || []
        setPayableItemsData(Array.isArray(payload) ? payload : [])
      })
      .catch(() => {
        if (!cancelled) setPayableItemsData(null)
      })

    return () => {
      cancelled = true
    }
  }, [group?.id])

  const parseTargetCents = () => {
    const val = parseFloat((activityTarget || '').toString().replace(/,/g, ''))
    if (Number.isNaN(val) || val <= 0) return null
    return Math.round(val * 100)
  }

  const handleCreateActivity = async (e) => {
    e.preventDefault()
    if (!group?.id) return

    setActivityCreateError(null)
    setActivityCreateSuccess(null)

    if (!uiCanCreateActivity) {
      setActivityCreateError('Only the group creator/admin can create an activity.')
      return
    }

    const targetCents = parseTargetCents()
    if (!activityName.trim()) return setActivityCreateError('Activity name is required.')
    if (!targetCents) return setActivityCreateError('Enter a target amount greater than zero.')
    if (!activityDeadline) return setActivityCreateError('Deadline date is required.')

    if (!hasToken()) {
      setActivityCreateError('Your session has expired. Please log in again.')
      return
    }

    try {
      setCreatingActivity(true)

      const payload = {
        name: activityName.trim(),
        target_amount_cents: targetCents,
        deadline_at: new Date(activityDeadline).toISOString(),
        contribution_frequency: activityFreq,
      }

      const res = await createCircleActivity(group.id, payload)
      const created = res?.data
      const next = created?.activity || created

      if (next) setActivities((prev) => [next, ...(prev || [])])

      setActivityCreateSuccess(activityTemplatePreset ? `${activityTemplatePreset.title} added as a payment item.` : 'Activity created.')
      setActivityName('')
      setActivityTarget('')
      setActivityDeadline('')
      setActivityFreq('one_time')
      setActivityTemplatePreset(null)
    } catch (e) {
      const msg =
        e?.response?.data?.errors?.join(', ') || e?.response?.data?.error || e?.message || 'Unable to create activity.'
      setActivityCreateError(msg)
    } finally {
      setCreatingActivity(false)
    }
  }

  useEffect(() => {
    if (group?.id) fetchAuditSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.id])

  useEffect(() => {
    if (!group?.id || !uiCanViewReports) return
    fetchCircleStatements()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.id, uiCanViewReports])

  const hasPendingCircleStatements = useMemo(
    () => circleStatements.some((statement) => statement?.status === 'pending'),
    [circleStatements]
  )

  useEffect(() => {
    if (!hasPendingCircleStatements || !group?.id || !uiCanViewReports) return undefined

    const timeoutId = window.setTimeout(() => {
      fetchCircleStatements({ silent: true })
    }, 15000)

    return () => window.clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circleStatements, group?.id, hasPendingCircleStatements, uiCanViewReports])

  const exportCsv = async () => {
    if (!group?.id) return
    if (!hasToken()) return

    try {
      const res = await exportCircleCsv(group.id)
      const blob = res?.data
      if (!blob) throw new Error('Unable to export CSV.')

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `circle-${group.id}-transactions.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      console.error('[exportCsv]', e)
    }
  }

  const progressForActivity = (act) => {
    const target = Number(act?.target_amount_cents || 0) / 100
    if (!target) return { raised: 0, target: 0, pct: 0 }

    const raisedFromApi = Number(act?.raised_amount_cents || 0) / 100
    const raised = raisedFromApi || 0
    const pct = Math.max(0, Math.min(100, (raised / target) * 100))
    return { raised, target, pct }
  }

  const daysRemaining = (deadlineAt) => {
    if (!deadlineAt) return null
    const d = new Date(deadlineAt)
    if (Number.isNaN(d.getTime())) return null
    const now = new Date()
    const diff = d.getTime() - now.getTime()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    return days
  }

  const drawerActivity = useMemo(
    () => (drawerActivityId ? (activities || []).find((a) => a.id === drawerActivityId) : null),
    [drawerActivityId, activities]
  )

  const drawerProgress = useMemo(
    () => (drawerActivity ? progressForActivity(drawerActivity) : { raised: 0, target: 0, pct: 0 }),
    [drawerActivity]
  )

  const drawerContributions = useMemo(() => {
    if (!drawerActivity?.id) return []
    return (orderedActivity || [])
      .filter((tx) => tx.direction === 'credit' || tx.direction === 'in')
      .filter((tx) => tx.circle_activity_id === drawerActivity.id || tx.circle_activity?.id === drawerActivity.id)
  }, [drawerActivity, orderedActivity])

  const handleContribute = (act) => {
    if (!act?.id) return
    setSelectedActivityId(act.id)

    setDepositPreset({
      circleActivityId: act.id,
      amount: '5000',
      note: '',
    })

    closeDrawer()
    setActiveSection('overview')
    scrollToTransfer()
  }

  const sectionNav =
    workspaceMode === 'member'
      ? [
          { key: 'overview', label: 'Overview' },
          { key: 'transactions', label: 'Recent Records' },
        ]
      : [
          { key: 'overview', label: 'Overview' },
          { key: 'dues', label: 'Payment Items' },
          { key: 'members', label: 'Members' },
          { key: 'governance', label: 'Governance' },
          { key: 'settings', label: 'Settings' },
        ]

  useEffect(() => {
    if (workspaceMode !== 'manage') return
    if (!hasManageAccess) setWorkspaceMode('member')
  }, [hasManageAccess, workspaceMode])

  useEffect(() => {
    if (workspaceMode !== 'member') return
    if (activeSection !== 'overview' && activeSection !== 'transactions') {
      setActiveSection('overview')
    }
    if (rightTab !== 'timeline') setRightTab('timeline')
  }, [activeSection, rightTab, workspaceMode])

  const payableItems = useMemo(() => {
    const backendItems = Array.isArray(payableItemsData)
      ? payableItemsData
      : Array.isArray(group?.payment_items)
        ? group.payment_items
        : []

    return backendItems.map((item, index) => {
      const normalizedType =
        item.type ||
        (item.linked_reference_type === 'CircleDuePlan'
          ? 'dues'
          : item.linked_reference_type === 'CircleActivity'
            ? 'activity_goal'
            : item.linked_reference_type === 'CircleFine'
              ? 'fine_penalty'
              : 'treasury_topup')

      return {
        key: item.key || item.id || `payment-item-${index}`,
        ...item,
        type: normalizedType,
        type_label:
          item.type_label ||
          (normalizedType === 'dues'
            ? 'Recurring dues'
            : normalizedType === 'activity_goal'
              ? 'Collection goal'
              : normalizedType === 'fine_penalty'
                ? 'Assigned fine'
                : 'Open contribution'),
      }
    })
  }, [group?.payment_items, payableItemsData])

  const supportPaymentItem =
    payableItems.find((item) => item?.support_fallback || item?.type === 'treasury_topup') || null
  const listedPaymentItems = payableItems.filter((item) => item?.key !== supportPaymentItem?.key)

  const hasPayableItems = payableItems.some((item) => item?.is_payable_now !== false && !item?.support_fallback)

  const smartPrimaryCta = hasPayableItems
    ? {
        label: 'Pay into Circle',
        onClick: () => {
          setActiveSection('overview')
          scrollToTransfer()
        },
      }
    : !duePlan && duesRecommended && uiCanManageDuePlan
    ? {
        label: 'Set Up Dues',
        onClick: () => setActiveSection('dues'),
      }
      : {
          label: 'Contribute',
          onClick: () => {
            setActiveSection('overview')
            scrollToTransfer()
          },
        }

  const governanceComplete = Boolean(settingsForm.governance_setup_completed)

  const jumpToSection = (sectionKey) => {
    setActiveSection(sectionKey)

    if (sectionKey === 'overview') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    if (sectionKey === 'dues') {
      document.getElementById('section-dues')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    if (sectionKey === 'members') {
      document.getElementById('section-members')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    if (sectionKey === 'transactions') {
      setRightTab('timeline')
      document.getElementById('section-records')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    if (sectionKey === 'governance') {
      setRightTab('settings')
      setSettingsSection('governance')
      document.getElementById('section-settings-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    if (sectionKey === 'settings') {
      setRightTab('settings')
      setSettingsSection('governance')
      document.getElementById('section-settings-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-6 md:py-8 overflow-x-hidden">
      <div className="max-w-6xl xl:max-w-7xl mx-auto space-y-5">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard/shared-groups')}
            className="text-xs text-slate-300 hover:text-white inline-flex items-center gap-1"
          >
            ← Back to shared groups
          </button>
          <span className="text-[11px] text-slate-500">Shared group details</span>
        </div>

        <section
          className={[
            'rounded-3xl px-5 py-5 md:px-7 md:py-7 shadow-[0_18px_60px_rgba(0,0,0,0.6)]',
            isOfficialCircle
              ? 'bg-gradient-to-r from-[#120f06] via-slate-950 to-[#1f1721] border border-amber-500/30'
              : 'bg-gradient-to-r from-[#050816] via-slate-950 to-black border border-slate-800/70',
          ].join(' ')}
        >
          {loading ? (
            <p className="text-xs text-slate-400">Loading group…</p>
          ) : error ? (
            <p className="text-xs text-red-400">{error}</p>
          ) : !group ? (
            <p className="text-xs text-slate-400">Group not found.</p>
          ) : (
            <>
              <p className={`text-[11px] tracking-[0.26em] uppercase mb-2 ${isOfficialCircle ? 'text-amber-200/90' : 'text-sky-300/80'}`}>
                {isOfficialCircle ? 'OFFICIAL CIRCLE' : 'BITBRIDGE CIRCLE'}
              </p>

              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                <div className="space-y-2 min-w-0">
                  <h1 className="text-2xl md:text-3xl font-semibold">{group.name}</h1>

                  <div className="flex flex-wrap gap-2 text-[10px] mt-1">
                    {isOfficialCircle && (
                      <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-[2px] uppercase tracking-[0.16em] text-amber-100">
                        Official BitBridge Circle
                      </span>
                    )}
                    {group.circle_archetype && (
                      <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950 px-3 py-[2px] uppercase tracking-[0.16em] text-slate-100">
                        {typeLabel}
                      </span>
                    )}
                    <span className="inline-flex items-center rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-[2px] uppercase tracking-[0.16em] text-violet-100">
                      {promotedBucketLabel}
                    </span>
                    {currentRole && (
                      <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/60 px-3 py-[2px] uppercase tracking-[0.16em] text-slate-200">
                        Your role: {formatCircleRoleLabel(currentRole)}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400 mt-1">
                    Created {createdLabel || 'recently'} • Creator:{' '}
                    <span className="text-slate-200">{group.owner?.email || 'You'}</span>
                  </p>

                  <p className="mt-3 text-[12px] text-slate-300 max-w-2xl">
                    {bucketSubtitle}
                  </p>

                  {isFlexibleOfficialCircle && isTier1User && officialCapCents > 0 && (
                    <div className="mt-3 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-[11px] text-amber-100">
                      <p>You can contribute up to {formatCapAmount(officialCapCents)} with your current verification level.</p>
                      <p className="mt-1 text-[10px] text-slate-300">Complete verification to unlock higher contributions.</p>
                    </div>
                  )}
                </div>

                <div className="lg:text-right lg:max-w-[320px] lg:pt-2">
                  <p className="text-[11px] text-slate-400 mb-1">Circle treasury balance</p>
                  <p className="text-xl md:text-2xl font-semibold text-emerald-300">{formatNaira(balanceNaira)}</p>
                  <div className="mt-4 flex justify-start lg:justify-end">
                    <ClassicBtn htmlType="button" className="h-11 px-4 text-xs" onclick={smartPrimaryCta.onClick}>
                      {smartPrimaryCta.label}
                    </ClassicBtn>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    {isOfficialCircle
                      ? 'Every founder contribution, milestone payout, and tagged campaign update stays visible in one controlled operating timeline.'
                      : 'Collections, payouts, and operating movement stay visible in one circle ledger built for proper group finance operations.'}
                  </p>
                </div>
              </div>

              <SummaryCard
                recentIn={recentTotalInNaira}
                recentOut={recentTotalOutNaira}
                balance={balanceNaira}
                audit={audit}
                auditLoading={auditLoading}
                auditError={auditError}
                onRefreshAudit={fetchAuditSummary}
              />

              {workspaceMode === 'manage' && (duesRecommended || duePlan) && (
                <div id="section-dues" className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="space-y-2">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Dues & Contributions</p>
                      <h2 className="text-lg font-semibold text-slate-100">{dueLabel}</h2>
                      <p className="text-[12px] text-slate-300">
                        {duePlan
                          ? dueUserState?.detail || 'This circle already has a live collections structure. Members can settle current or open periods against the configured plan.'
                          : 'This circle is a strong fit for structured recurring collections. Set the dues plan after member setup to keep collections accountable.'}
                      </p>
                      {duePlan ? <p className="text-[11px] text-slate-500">{dueApplicabilityLabel}</p> : null}
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:min-w-[260px]">
                      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Status</div>
                        <div className="mt-2 text-sm font-semibold text-slate-100">
                          {duePlan ? (dueUserState?.title || dueStatusLabel || 'Configured') : 'Not set'}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Open periods</div>
                        <div className="mt-2 text-sm font-semibold text-slate-100">{duePlan ? dueOpenPeriods : 0}</div>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Outstanding</div>
                        <div className="mt-2 text-sm font-semibold text-slate-100">
                          {duePlan ? formatNaira(dueTotalOpenCents / 100) : '—'}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Prepaid through</div>
                        <div className="mt-2 text-sm font-semibold text-slate-100">
                          {duePlan ? duePrepaidThroughLabel || '—' : '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {duePlan && dueNextDateLabel && !['not_enrolled', 'plan_inactive'].includes(dueUserState?.key || '') ? (
                      <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950 px-3 py-[2px] text-[10px] uppercase tracking-[0.16em] text-slate-300">
                        Next due: {dueNextDateLabel}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        if (duePlan) {
                          jumpToSection('dues')
                          return
                        }
                        if (uiCanManageDuePlan) {
                          setActiveSection('dues')
                          setRightTab('settings')
                          setSettingsSection('operations')
                          setTimeout(() => {
                            document.getElementById('section-settings-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                          }, 0)
                          return
                        }
                        jumpToSection('dues')
                      }}
                      className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-[11px] font-semibold text-slate-100 hover:bg-slate-900/70"
                    >
                      {duePlan ? 'Review dues' : 'Open dues setup'}
                    </button>
                    {!duePlan && uiCanViewReports ? (
                      <button
                        type="button"
                        onClick={exportCsv}
                        className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-[11px] font-semibold text-slate-200 hover:bg-slate-900/70"
                      >
                        Export CSV
                      </button>
                    ) : null}
                  </div>

                  {setupChecklist.length > 0 && uiCanManageDuePlan && !duePlan && (
                    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 mb-2">Recommended setup sequence</p>
                      <div className="flex flex-wrap gap-2">
                        {setupChecklist.map((item) => (
                          <span
                            key={item}
                            className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950 px-3 py-[2px] text-[10px] uppercase tracking-[0.16em] text-slate-300"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        {!loading && !error && group ? (
          <div className="sticky top-3 z-20 rounded-2xl border border-slate-800/80 bg-slate-950/90 p-2 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
              {sectionNav.map((section) => (
                <PanelTabBtn
                  key={section.key}
                  active={activeSection === section.key}
                  label={section.label}
                  onClick={() => jumpToSection(section.key)}
                />
              ))}
              </div>
              {hasManageAccess ? (
                <div className="flex items-center gap-2">
                  <PanelTabBtn
                    active={workspaceMode === 'member'}
                    label="Member"
                    onClick={() => setWorkspaceMode('member')}
                  />
                  <PanelTabBtn
                    active={workspaceMode === 'manage'}
                    label="Manage"
                    onClick={() => setWorkspaceMode('manage')}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {!loading && !error && group && workspaceMode === 'manage' && activeSection === 'dues' ? (
          <PaymentItemsManagePanel
            suggestedPaymentTemplates={suggestedPaymentTemplates}
            promotedBucketLabel={promotedBucketLabel}
            applySuggestedTemplate={applySuggestedTemplate}
            listedPaymentItems={listedPaymentItems}
            openPaymentItemManager={openPaymentItemManager}
            duePanelProps={{
              canManage: uiCanManageDuePlan,
              dueForm: duePlanForm,
              onChange: handleDuePlanChange,
              onScopeChange: (scope) => handleDuePlanChange({ target: { name: 'due_scope', value: scope } }),
              onToggleRole: handleDuePlanRoleToggle,
              onSubmit: handleDuePlanSubmit,
              saving: duePlanSaving,
              saveError: duePlanSaveError,
              saveSuccess: duePlanSaveSuccess,
              loading: duePlanLoading,
              loadError: duePlanError,
              duePlan: operationsSettings?.due_plan || duePlan,
              dueLabel,
            }}
          />
        ) : null}

        <div className="grid lg:grid-cols-3 gap-4 items-start min-w-0">
          <TransferCard
            circleId={group?.id}
            balanceNaira={balanceNaira}
            uiCanWithdraw={uiCanWithdraw}
            withdrawalLockedReason={withdrawalLockedReason}
            onDeposit={onDeposit}
            onWithdraw={onWithdraw}
            depositing={depositing}
            withdrawing={withdrawing}
            depositError={depositError}
            depositSuccess={depositSuccess}
            withdrawError={withdrawError}
            withdrawSuccess={withdrawSuccess}
            activities={activities}
            selectedActivityId={selectedActivityId}
            setSelectedActivityId={setSelectedActivityId}
            depositPreset={depositPreset}
            clearDepositPreset={() => setDepositPreset(null)}
            isOfficialCircle={isOfficialCircle}
            isFlexibleOfficialCircle={isFlexibleOfficialCircle}
            isTier1User={isTier1User}
            officialCapCents={officialCapCents}
            standardDailyCapCents={standardDailyCapCents}
            productBucketLabel={promotedBucketLabel}
            duePlan={duePlan}
            dueLabel={dueLabel}
            dueOpenPeriods={dueOpenPeriods}
            duePrepaidThroughLabel={duePrepaidThroughLabel}
            dueNextDateLabel={dueNextDateLabel}
            payableItems={payableItems}
            duesRecommended={duesRecommended}
            uiCanPayDues={uiCanPayDues}
            uiCanManageDuePlan={uiCanManageDuePlan}
            uiCanCreateActivity={uiCanCreateActivity}
            activeRequiredCall={group?.active_required_call || null}
            onOpenDueSetup={() => {
              setActiveSection('dues')
              setRightTab('settings')
              setSettingsSection('operations')
              setTimeout(() => {
                document.getElementById('section-settings-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }, 0)
            }}
            onOpenActivities={() => {
              setActiveSection('transactions')
              setRightTab('activities')
              setTimeout(() => {
                document.getElementById('section-records')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }, 0)
            }}
          />

          {workspaceMode === 'manage' ? (
          <section id="section-members" className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 min-w-0">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div>
                <h2 className="text-sm font-semibold">Members</h2>
                <p className="text-[11px] text-slate-500">
                  {memberCount} member{memberCount === 1 ? '' : 's'}
                </p>
              </div>
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                {formatCircleRoleLabel(currentRole || 'member')}
              </span>
            </div>

            {membersMasked && (
              <p className="text-[11px] text-slate-500 mb-3">
                Some details are hidden for members. Admins can view full info.
              </p>
            )}

            <form onSubmit={handleSaveDisplayName} className="mb-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
              <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">
                Set your Circle Name
              </label>
              <div className="flex flex-col md:flex-row gap-2">
                <input
                  value={memberDisplayName}
                  onChange={(event) => setMemberDisplayName(event.target.value)}
                  placeholder="How this circle should know you"
                  className="flex-1 h-11 rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-100 outline-none"
                />
                <ClassicBtn htmlType="submit" className="h-11 px-4 text-xs" disabled={displayNameSaving}>
                  {displayNameSaving ? 'Saving…' : 'Save Circle Name'}
                </ClassicBtn>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Your Circle Name only applies inside this circle. Legal identity stays unchanged.
              </p>
              {displayNameError && <p className="mt-2 text-[11px] text-rose-300">{displayNameError}</p>}
              {displayNameSuccess && <p className="mt-2 text-[11px] text-emerald-300">{displayNameSuccess}</p>}
            </form>

            {memberCount ? (
              <ul className="space-y-2">
                {(members || []).map((member) => {
                  const roleLabel = formatCircleRoleLabel(member?.role || 'member')
                  const memberUser = member?.user || {}
                  const displayName = member?.display_name || memberUser.display_name || memberUser.email || 'Member'
                  const secondaryName = member?.fallback_name || memberUser.fallback_name || ''
                  const adminIdentityName = memberUser.admin_identity_name || ''
                  const email = memberUser.email || ''
                  const phone = memberUser.phone_number || ''
                  const invitedBy = member?.invited_by?.email || member?.invited_by?.id
                  const avatarKey = displayName || email

                  return (
                    <li
                      key={member?.id || `${roleLabel}-${email}`}
                      className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2"
                    >
                      <div
                        className={`h-9 w-9 rounded-full bg-gradient-to-br ${colorFromEmail(
                          avatarKey
                        )} flex items-center justify-center text-[12px] font-semibold border border-slate-900 shadow shrink-0`}
                        title={email || displayName}
                      >
                        {initialsFromEmail(avatarKey)}
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-100 truncate">{displayName}</p>
                        {(adminIdentityName || secondaryName) ? (
                          <p className="text-[11px] text-slate-500 truncate">{adminIdentityName || secondaryName}</p>
                        ) : null}
                        <p className="text-[11px] text-slate-400 truncate">
                          {email || 'Email hidden'}
                          {phone ? ` • ${phone}` : ''}
                          {invitedBy ? ` • Invited by ${invitedBy}` : ''}
                        </p>
                      </div>

                      <span className="ml-auto text-[10px] uppercase tracking-[0.18em] text-slate-400">
                        {roleLabel}
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-[11px] text-slate-500">No members found yet.</p>
            )}
          </section>
          ) : null}

          <section id="section-records" className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 min-w-0 lg:sticky lg:top-6">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h2 className="text-sm font-semibold">
                {workspaceMode === 'member'
                  ? 'Recent Records'
                  : rightTab === 'timeline'
                  ? 'Live activity timeline'
                  : rightTab === 'activities'
                    ? 'Activities & goals'
                    : 'Circle settings'}
              </h2>

              {workspaceMode === 'manage' ? (
              <div className="flex items-center gap-2 shrink-0">
                {rightTab === 'timeline' && (
                  <button
                    type="button"
                    onClick={exportCsv}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-[11px] font-semibold text-slate-200 hover:bg-slate-900/70"
                  >
                    Export CSV
                  </button>
                )}

                <PanelTabBtn active={rightTab === 'timeline'} label="Timeline" onClick={() => { setActiveSection('transactions'); setRightTab('timeline') }} />
                <PanelTabBtn active={rightTab === 'activities'} label="Activities" onClick={() => { setActiveSection('transactions'); setRightTab('activities') }} />
                <PanelTabBtn active={rightTab === 'settings'} label="Settings" onClick={() => { setActiveSection('settings'); setRightTab('settings') }} />
              </div>
              ) : null}
            </div>

            {workspaceMode === 'member' || rightTab === 'timeline' ? (
              <>
                {uiCanViewReports ? (
                  <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="max-w-2xl">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Statements</p>
                        <h3 className="mt-2 text-base font-semibold text-slate-100">Generate a formal circle treasury statement</h3>
                        <p className="mt-2 text-[12px] text-slate-300">
                          Prepare a dated treasury statement with opening balance, closing balance, credits, debits, fees, and posted records.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => fetchCircleStatements()}
                        className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-[11px] font-semibold text-slate-200 hover:bg-slate-900/70"
                      >
                        Refresh statements
                      </button>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {CIRCLE_STATEMENT_RANGE_OPTIONS.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => handleCircleStatementFormChange('range_key', option.key)}
                          className={[
                            'rounded-full border px-3 py-2 text-[11px] font-semibold transition',
                            circleStatementForm.range_key === option.key
                              ? 'border-cyan-400/50 bg-cyan-400/15 text-cyan-100'
                              : 'border-slate-700 bg-slate-950/70 text-slate-300 hover:bg-slate-900/70',
                          ].join(' ')}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <label className="space-y-2">
                        <span className="block text-[11px] uppercase tracking-[0.16em] text-slate-400">Format</span>
                        <select
                          value={circleStatementForm.output_format}
                          onChange={(event) => handleCircleStatementFormChange('output_format', event.target.value)}
                          className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
                        >
                          <option value="pdf">PDF</option>
                          <option value="csv">CSV</option>
                        </select>
                      </label>

                      {circleStatementForm.range_key === 'custom' ? (
                        <>
                          <label className="space-y-2">
                            <span className="block text-[11px] uppercase tracking-[0.16em] text-slate-400">Start date</span>
                            <input
                              type="date"
                              value={circleStatementForm.date_from}
                              onChange={(event) => handleCircleStatementFormChange('date_from', event.target.value)}
                              className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
                            />
                          </label>
                          <label className="space-y-2">
                            <span className="block text-[11px] uppercase tracking-[0.16em] text-slate-400">End date</span>
                            <input
                              type="date"
                              value={circleStatementForm.date_to}
                              onChange={(event) => handleCircleStatementFormChange('date_to', event.target.value)}
                              className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
                            />
                          </label>
                        </>
                      ) : (
                        <div className="md:col-span-2 xl:col-span-3 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Selected period</p>
                          <p className="mt-2 text-sm font-semibold text-slate-100">
                            {CIRCLE_STATEMENT_RANGE_OPTIONS.find((option) => option.key === circleStatementForm.range_key)?.label || 'This month'}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-400">
                            Large ranges like yearly or all-time statements may take longer to prepare.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-[11px] text-slate-400">
                        Statements are prepared on demand and remain available for download when ready.
                      </p>
                      <ClassicBtn
                        htmlType="button"
                        className="h-11 px-4 text-xs"
                        onclick={handleRequestCircleStatement}
                        disabled={circleStatementsSubmitting}
                      >
                        {circleStatementsSubmitting ? 'Preparing request…' : 'Generate statement'}
                      </ClassicBtn>
                    </div>

                    <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-100">Recent statements</h4>
                          <p className="mt-1 text-[11px] text-slate-400">Monitor pending requests or download ready statements.</p>
                        </div>
                        <span className="text-[11px] text-slate-500">{circleStatements.length} total</span>
                      </div>

                      {circleStatementsLoading ? (
                        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-300">
                          Loading statements...
                        </div>
                      ) : circleStatementsError ? (
                        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                          {circleStatementsError}
                        </div>
                      ) : circleStatements.length === 0 ? (
                        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-300">
                          No statements yet. Generate one when you need a formal treasury record.
                        </div>
                      ) : (
                        <div className="mt-4 space-y-3">
                          {circleStatements.map((statement) => {
                            const statusClass = CIRCLE_STATEMENT_STATUS_STYLES[statement.status] || 'border-white/10 bg-white/5 text-slate-100'
                            return (
                              <div key={statement.id} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="text-sm font-semibold text-slate-100">{statement.reference}</div>
                                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${statusClass}`}>
                                        {statement.status}
                                      </span>
                                      <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">
                                        {statement.output_format}
                                      </span>
                                    </div>
                                    <div className="mt-2 text-sm text-slate-300">
                                      {(statement.range_label || 'Custom range')} • {safeDateLabel(statement.resolved_date_from || statement.date_from)} to {safeDateLabel(statement.resolved_date_to || statement.date_to)}
                                    </div>
                                    <div className="mt-1 text-[11px] text-slate-500">
                                      Requested {safeDateLabel(statement.created_at)}
                                      {statement.generated_at ? ` • Ready ${safeDateLabel(statement.generated_at)}` : ''}
                                    </div>
                                  </div>

                                  {statement.download_url ? (
                                    <button
                                      type="button"
                                      onClick={() => openCircleStatementDownload(statement)}
                                      className="rounded-xl bg-emerald-600/90 px-4 py-2 text-[11px] font-semibold text-white hover:bg-emerald-600"
                                    >
                                      Download {String(statement.output_format || 'pdf').toUpperCase()}
                                    </button>
                                  ) : null}
                                </div>

                                {statement.status === 'failed' && statement.failure_reason ? (
                                  <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-3 text-sm text-rose-100">
                                    {statement.failure_reason}
                                  </div>
                                ) : null}

                                {statement.status === 'ready' ? (
                                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                                    <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-3">
                                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Opening</div>
                                      <div className="mt-2 text-sm font-semibold text-white">{formatNaira(Number(statement.opening_balance_cents || 0) / 100)}</div>
                                    </div>
                                    <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-3">
                                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Closing</div>
                                      <div className="mt-2 text-sm font-semibold text-white">{formatNaira(Number(statement.closing_balance_cents || 0) / 100)}</div>
                                    </div>
                                    <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-3">
                                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Credits</div>
                                      <div className="mt-2 text-sm font-semibold text-emerald-300">{formatNaira(Number(statement.total_credits_cents || 0) / 100)}</div>
                                    </div>
                                    <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-3">
                                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Debits</div>
                                      <div className="mt-2 text-sm font-semibold text-rose-300">{formatNaira(Number(statement.total_debits_cents || 0) / 100)}</div>
                                    </div>
                                    <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-3">
                                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Records</div>
                                      <div className="mt-2 text-sm font-semibold text-white">{Number(statement.transaction_count || 0).toLocaleString('en-NG')}</div>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-slate-500">Item-first payment ledger</p>
                  <span className="text-[11px] text-slate-500">
                    Last {orderedActivity.length} move{orderedActivity.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="mt-3 max-h-[620px] overflow-auto pr-1">
                  <ul className="space-y-3 text-xs">
                    {orderedActivity.map((tx) => {
                      const amount = (tx.amount_cents || 0) / 100
                      const when = safeDateLabel(tx.occurred_at)
                      const email = tx.user?.email || 'Someone in this group'

                      const purposeLabel = tx.payment_item_title || tx.payment_purpose_label || tx.label || tx.description || 'Circle payment'
                      const isCredit = tx.direction === 'credit' || tx.direction === 'in'
                      const isPayout = tx.kind === 'payout'
                      const directionLabel = isPayout ? 'Payout to wallet' : isCredit ? 'Money added' : 'Money moved out'
                      const pillLabel = isPayout ? 'GROUP → WALLET' : isCredit ? 'WALLET → GROUP' : 'GROUP → WALLET'
                      const isMine = Boolean(currentUser?.id && tx.user?.id && tx.user.id === currentUser.id)
                      const metadataParts = [
                        isMine ? 'You' : email,
                        directionLabel,
                        tx.circle_activity?.name ? `Item: ${tx.circle_activity.name}` : null,
                      ].filter(Boolean)

                      return (
                        <li key={tx.id} className="relative">
                          <div className={`flex items-start gap-3 ${isMine ? 'justify-end' : 'justify-start'}`}>
                            {!isMine && (
                              <div
                                className={`h-9 w-9 rounded-full bg-gradient-to-br ${colorFromEmail(email)} flex items-center justify-center text-[12px] font-semibold border border-slate-900 shadow shrink-0`}
                                title={email}
                              >
                                {initialsFromEmail(email)}
                              </div>
                            )}

                            <div
                              className={[
                                'max-w-[85%] rounded-3xl border px-4 py-3 shadow min-w-0',
                                isMine
                                  ? 'border-emerald-500/25 bg-emerald-500/10'
                                  : 'border-slate-800 bg-gradient-to-r from-slate-950 to-slate-900',
                              ].join(' ')}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-100">{purposeLabel}</p>
                                  <p className="mt-1 truncate text-[11px] text-slate-400">{metadataParts.join(' • ')}</p>
                                  <p className="hidden text-[11px] text-slate-300 truncate">
                                    <span className="font-medium text-slate-200">{email}</span>{' '}
                                    <span className="text-slate-500">• {directionLabel}</span>
                                  </p>
                                </div>
                                <span className="text-[11px] text-slate-500 whitespace-nowrap shrink-0">{when}</span>
                              </div>

                              <p className="mt-2 text-sm text-slate-100 break-words">
                                <span className="font-semibold">{formatNaira(amount)}</span>
                                {tx.description ? (
                                  <span className="text-[12px] text-slate-300"> — {tx.description}</span>
                                ) : null}
                              </p>

                              {false && purposeLabel && purposeLabel !== tx.description ? (
                                <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                                  {purposeLabel}
                                </p>
                              ) : null}

                              <div className="mt-2 flex flex-wrap gap-2">
                                <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-[2px] text-[10px] tracking-[0.16em] uppercase text-emerald-200">
                                  {pillLabel}
                                </span>

                                {tx.circle_activity?.name ? (
                                  <button
                                    type="button"
                                    onClick={() => openDrawer(tx.circle_activity?.id)}
                                    className="inline-flex items-center rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-[2px] text-[10px] tracking-[0.16em] uppercase text-sky-200 hover:bg-sky-500/20"
                                    title="View activity"
                                  >
                                    Activity: {tx.circle_activity.name}
                                  </button>
                                ) : null}
                              </div>

                              <ReactionBar tx={tx} onToggle={toggleReaction} busyEmoji={reactionBusy[tx.id] || null} />

                              <div className="mt-2 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  {tx.wallet_transaction_reference ? (
                                    <button
                                      type="button"
                                      onClick={() => navigate(`/dashboard/receipt/${tx.wallet_transaction_reference}`)}
                                      className="text-[11px] text-emerald-300 hover:text-emerald-100 underline underline-offset-4"
                                    >
                                      View receipt
                                    </button>
                                  ) : null}
                                </div>
                                {tx.dispute ? (
                                  <span className="text-[11px] text-amber-400">? Review requested ? {tx.dispute.status}</span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setActiveDisputeTx(tx)}
                                    className="text-[11px] text-sky-300 hover:text-sky-100 underline underline-offset-4"
                                  >
                                    Request review
                                  </button>
                                )}
                              </div>
                            </div>

                            {isMine && (
                              <div
                                className={`h-9 w-9 rounded-full bg-gradient-to-br ${colorFromEmail(email)} flex items-center justify-center text-[12px] font-semibold border border-slate-900 shadow shrink-0`}
                                title="You"
                              >
                                {initialsFromEmail(email)}
                              </div>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </>
            ) : rightTab === 'activities' ? (
              <>
                {activityTemplatePreset ? (
                  <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-200 mb-2">Payment item setup</p>
                    <p className="text-[12px] text-emerald-100">
                      You are configuring <span className="font-semibold">{activityTemplatePreset.title}</span> for {promotedBucketLabel}. This only becomes payable after you save it.
                    </p>
                  </div>
                ) : null}

                <p className="text-[11px] text-slate-400">
                  {isOfficialCircle
                    ? 'Track campaign milestones here. Transactions in the timeline remain the single source of financial truth.'
                    : 'Track group goals here. Transactions in the timeline remain the single source of financial truth.'}
                </p>

                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[12px] font-semibold text-slate-100">
                      {activityTemplatePreset
                        ? `Configure ${activityTemplatePreset.title}`
                        : isOfficialCircle
                          ? 'Create a new milestone'
                          : 'Create a new activity'}
                    </p>
                    {!uiCanCreateActivity && <span className="text-[10px] text-slate-500">Creator/Admin only</span>}
                  </div>

                  <form onSubmit={handleCreateActivity} className="mt-4 space-y-3">
                    <div>
                      <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">
                        {activityTemplatePreset ? 'Payment item name' : 'Activity name'}
                      </label>
                      <input
                        value={activityName}
                        onChange={(e) => setActivityName(e.target.value)}
                        placeholder={isOfficialCircle ? 'Eg. "Founders Launch Milestone"' : 'Eg. "Q1 Office Rent"'}
                        className="w-full h-11 rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-100 outline-none"
                        disabled={!uiCanCreateActivity || creatingActivity}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">
                          {activityTemplatePreset ? 'Amount / target (₦)' : 'Target amount (₦)'}
                        </label>
                        <input
                          value={activityTarget}
                          onChange={(e) => setActivityTarget(e.target.value)}
                          placeholder="0.00"
                          className="w-full h-11 rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-100 outline-none"
                          disabled={!uiCanCreateActivity || creatingActivity}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">
                          {activityTemplatePreset ? 'Due / close date' : 'Deadline'}
                        </label>
                        <input
                          type="date"
                          value={activityDeadline}
                          onChange={(e) => setActivityDeadline(e.target.value)}
                          className="w-full h-11 rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-100 outline-none"
                          disabled={!uiCanCreateActivity || creatingActivity}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">
                        {activityTemplatePreset ? 'Collection frequency' : 'Contribution frequency'}
                      </label>
                      <select
                        value={activityFreq}
                        onChange={(e) => setActivityFreq(e.target.value)}
                        className="w-full h-11 rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-100 outline-none"
                        disabled={!uiCanCreateActivity || creatingActivity}
                      >
                        <option value="one_time">One-time</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                      <p className="mt-2 text-[10px] text-slate-500">
                        {isOfficialCircle
                          ? 'This does not charge anyone yet — it only defines the milestone.'
                          : 'This does not charge anyone yet — it only defines the goal.'}
                      </p>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setActivityName('')
                          setActivityTarget('')
                          setActivityDeadline('')
                          setActivityFreq('one_time')
                          setActivityTemplatePreset(null)
                          setActivityCreateError(null)
                          setActivityCreateSuccess(null)
                        }}
                        className="h-11 px-4 rounded-xl border border-slate-700 text-xs text-slate-200 hover:bg-slate-900/40"
                        disabled={creatingActivity}
                      >
                        Cancel
                      </button>

                      <ClassicBtn
                        htmlType="submit"
                        className="h-11 px-4 text-xs whitespace-nowrap flex items-center justify-center leading-none"
                        disabled={!uiCanCreateActivity || creatingActivity}
                      >
                        <span className="leading-none">{creatingActivity ? 'Creating…' : activityTemplatePreset ? 'Save payment item' : 'Create activity'}</span>
                      </ClassicBtn>
                    </div>

                    {activityCreateError && <p className="text-[11px] text-red-400">{activityCreateError}</p>}
                    {activityCreateSuccess && <p className="text-[11px] text-emerald-400">{activityCreateSuccess}</p>}
                  </form>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-semibold text-slate-100">
                      {isOfficialCircle ? 'Current & past milestones' : 'Current & past activities'}
                    </p>
                    <button
                      type="button"
                      onClick={fetchActivities}
                      className="text-[11px] text-slate-300 hover:text-white underline underline-offset-4"
                      disabled={activitiesLoading}
                    >
                      {activitiesLoading ? 'Refreshing…' : 'Refresh'}
                    </button>
                  </div>

                  {activitiesError && <p className="mt-2 text-[11px] text-slate-500">{activitiesError}</p>}

                  <div className="mt-3 space-y-3 max-h-[360px] overflow-auto pr-1">
                    {!activitiesLoading && (!activities || activities.length === 0) ? (
                      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                        <p className="text-[11px] text-slate-400">
                          {isOfficialCircle ? 'No milestones yet.' : 'No activities yet.'}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {isOfficialCircle
                            ? 'Create a milestone to help contributors follow campaign progress.'
                            : 'Create a goal to help the group coordinate contributions.'}
                        </p>
                      </div>
                    ) : (
                      (activities || []).map((act) => {
                        const p = progressForActivity(act)
                        const remaining = daysRemaining(act.deadline_at)

                        return (
                          <div key={act.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <button
                                type="button"
                                onClick={() => openDrawer(act.id)}
                                className="min-w-0 text-left"
                                title="View activity"
                              >
                                <p className="text-[12px] font-semibold text-slate-100 truncate">{act.name}</p>
                                <p className="mt-1 text-[11px] text-slate-400">
                                  <span className="text-slate-200">{formatNaira(p.raised)}</span>{' '}
                                  <span className="text-slate-500">of</span>{' '}
                                  <span className="text-slate-200">{formatNaira(p.target)}</span>{' '}
                                  <span className="text-slate-500">raised</span>
                                </p>
                              </button>

                              <div className="text-right shrink-0">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Days left</p>
                                <p className="text-[12px] font-semibold text-slate-100">
                                  {typeof remaining === 'number' ? Math.max(0, remaining) : '—'}
                                </p>
                              </div>
                            </div>

                            <div className="mt-3">
                              <div className="h-2 rounded-full bg-slate-900/70 border border-slate-800 overflow-hidden">
                                <div className="h-full bg-emerald-500/40" style={{ width: `${p.pct || 0}%` }} />
                              </div>
                              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                                <span>Progress</span>
                                <span>{Math.round(p.pct || 0)}%</span>
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={[
                                    'inline-flex items-center rounded-full border px-2 py-[2px] text-[10px] tracking-[0.16em] uppercase',
                                    pillForStatus(act.status),
                                  ].join(' ')}
                                >
                                  {act.status}
                                </span>

                                <span className="text-[11px] text-slate-500">{act.contribution_frequency}</span>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleContribute(act)}
                                className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-[11px] font-semibold text-slate-200 hover:bg-slate-900/70"
                                title="Pre-fill Transfer and link this activity"
                              >
                                Contribute
                              </button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div id="section-settings-panel" className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <SettingsSectionBtn
                    active={settingsSection === 'membership'}
                    label="My Membership"
                    onClick={() => {
                      setActiveSection('members')
                      setSettingsSection('membership')
                    }}
                  />
                  <SettingsSectionBtn
                    active={settingsSection === 'operations'}
                    label="Circle Operations"
                    onClick={() => {
                      setActiveSection('dues')
                      setSettingsSection('operations')
                    }}
                  />
                  <SettingsSectionBtn
                    active={settingsSection === 'governance'}
                    label="Governance"
                    onClick={() => {
                      setActiveSection('governance')
                      setSettingsSection('governance')
                    }}
                  />
                </div>

                {settingsSection === 'membership' ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">My Membership</p>
                      <p className="text-[11px] text-slate-300">
                        Manage how this circle identifies you without changing your legal BitBridge account identity.
                      </p>
                    </div>

                    <form onSubmit={handleSaveDisplayName} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Circle alias</label>
                      <div className="flex flex-col md:flex-row gap-2">
                        <input
                          value={memberDisplayName}
                          onChange={(event) => setMemberDisplayName(event.target.value)}
                          placeholder="How this circle should know you"
                          className="flex-1 h-11 rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-100 outline-none"
                        />
                        <ClassicBtn htmlType="submit" className="h-11 px-4 text-xs" disabled={displayNameSaving}>
                          {displayNameSaving ? 'Saving…' : 'Save alias'}
                        </ClassicBtn>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500">
                        {membershipSettings?.next_display_name_change_at
                          ? `Next alias change available ${safeDateLabel(membershipSettings.next_display_name_change_at)}.`
                          : 'This alias only applies inside this circle.'}
                      </p>
                      {displayNameError && <p className="mt-2 text-[11px] text-rose-300">{displayNameError}</p>}
                      {displayNameSuccess && <p className="mt-2 text-[11px] text-emerald-300">{displayNameSuccess}</p>}
                    </form>

                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Notifications</p>
                      <p className="text-[11px] text-slate-300">
                        Circle-specific notification and reminder preferences are not available yet on the backend.
                      </p>
                    </div>
                  </div>
                ) : null}

                {settingsSection === 'operations' ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Payment items workspace</p>
                      <p className="text-[11px] text-slate-300">
                        Use the Payment Items section in Manage mode to configure templates, review active items, and update recurring dues.
                      </p>
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={() => setActiveSection('dues')}
                          className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-[11px] font-semibold text-slate-200 hover:bg-slate-900/70"
                        >
                          Open Payment Items
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Operations</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-slate-300">
                        <div>Members: {operationsSettings?.members_summary?.total_members || memberCount || 0}</div>
                        <div>Managers: {operationsSettings?.members_summary?.manager_count || group?.manager_count || 0}</div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {uiCanViewReports ? (
                          <button
                            type="button"
                            onClick={exportCsv}
                            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-[11px] font-semibold text-slate-200 hover:bg-slate-900/70"
                          >
                            Export CSV
                          </button>
                        ) : null}
                        {uiCanInviteMembers ? (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveSection('members')
                              scrollToInvitePanel()
                            }}
                            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-[11px] font-semibold text-slate-200 hover:bg-slate-900/70"
                          >
                            Manage members
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}

                {settingsSection === 'governance' ? (
                  <CircleSettingsPanel
                    canManage={uiCanManageSettings || uiCanManageGovernance}
                    form={settingsForm}
                    onChange={handleSettingsChange}
                    onSubmit={handleSettingsSubmit}
                    saving={settingsSaving}
                    saveError={settingsSaveError}
                    saveSuccess={settingsSaveSuccess}
                    loading={settingsLoading}
                    loadError={settingsError}
                    recommendations={settingsRecommendations}
                  />
                ) : null}
              </div>
            )}
          </section>
        </div>

        <section id="circle-invite-panel" className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 min-w-0">
          <form onSubmit={handleInvite} className="flex flex-col md:flex-row gap-2 items-start md:items-center min-w-0">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder={uiCanInviteMembers ? 'friend@example.com' : 'Only creators/admins can add people'}
              className="w-full md:flex-1 h-11 rounded-lg border border-slate-700 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none min-w-0"
              disabled={!uiCanInviteMembers}
            />
            <ClassicBtn
              htmlType="submit"
              className="h-11 px-4 text-xs whitespace-nowrap flex items-center justify-center leading-none"
              disabled={inviting || !uiCanInviteMembers}
            >
              <span className="leading-none">{inviting ? 'Adding…' : 'Add person'}</span>
            </ClassicBtn>
          </form>

          {!uiCanInviteMembers && (
            <p className="mt-2 text-[11px] text-slate-500">
              Only group creators and admins can invite members.
            </p>
          )}
          {inviteError && <p className="mt-2 text-[11px] text-red-400">{inviteError}</p>}
          {inviteSuccess && <p className="mt-2 text-[11px] text-emerald-400">{inviteSuccess}</p>}
        </section>
      </div>

      <ActivityDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        activity={drawerActivity}
        progress={drawerProgress}
        contributions={drawerContributions}
        onContribute={handleContribute}
      />

      {activeDisputeTx && (
        <DisputeModal
          tx={activeDisputeTx}
          onClose={() => setActiveDisputeTx(null)}
          onCreated={(dispute) => {
            setActivity((prev) => (prev || []).map((t) => (t.id === activeDisputeTx.id ? { ...t, dispute } : t)))
          }}
        />
      )}

      {/* ✅ PIN Modal for Fund + Withdraw */}
      <PinModal
        open={pinOpen}
        title={pinTitle}
        busy={pinBusy}
        error={pinError}
        onCancel={cancelPin}
        onConfirm={handlePinConfirm}
      />
    </div>
  )
}

export default CirclesDetailPage
