// src/pages/Circles/CirclesDetailPage.jsx

import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import ClassicBtn from '../../components/button/ClassicButton'
import DisputeModal from '../../components/DisputeModal'
import { getAccessToken } from '../../auth/tokenStore'
import { toast } from 'react-toastify'
import { needsTier2Access, withTier2MissingDetails } from '../../utils/kycGate'

import {
  getCircle,
  fundCircle,
  withdrawCircle,
  getCircleAuditSummary,
  exportCircleCsv,
  inviteCircleMember,
  listCircleActivities,
  createCircleActivity,
  reactToCircleTx,
  unreactToCircleTx,
} from '../../api/circles'

const ALLOWED_EMOJIS = ['👍', '🎉', '🙏']

const formatNaira = (amount) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(amount || 0)

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
}) => {
  const [mode, setMode] = useState('deposit')
  const [amount, setAmount] = useState('5000')
  const [note, setNote] = useState('')
  const [localError, setLocalError] = useState(null)

  useEffect(() => {
    setLocalError(null)
    setNote('')
    setAmount(mode === 'deposit' ? '5000' : '')
  }, [mode])

  useEffect(() => {
    if (!depositPreset) return
    setMode('deposit')
    setLocalError(null)

    if (typeof depositPreset.amount === 'string') setAmount(depositPreset.amount)
    if (typeof depositPreset.note === 'string') setNote(depositPreset.note)

    if (depositPreset.circleActivityId) {
      setSelectedActivityId(depositPreset.circleActivityId)
    }

    clearDepositPreset?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depositPreset])

  const isWithdraw = mode === 'withdraw'
  const busy = isWithdraw ? withdrawing : depositing
  const primaryLabel = isWithdraw ? 'Withdraw' : 'Fund group'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError(null)

    const amountValue = parseFloat(amount.toString().replace(/,/g, ''))
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      setLocalError('Enter an amount greater than zero.')
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

    await onDeposit({ amountValue, note, circleActivityId: selectedActivityId || null })
  }

  return (
    <section
      id="transfer-card"
      className="md:col-span-2 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 md:p-6 min-w-0"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Transfer</h2>
            <p className="mt-1 text-[11px] text-slate-400">
              Move money between your BitBridge wallet and this group mini-wallet.
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[11px] text-slate-500">Balance</p>
            <p className="text-sm font-semibold text-slate-100">{formatNaira(balanceNaira)}</p>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <SegBtn active={mode === 'deposit'} label="Deposit" onClick={() => setMode('deposit')} />
          <SegBtn
            active={mode === 'withdraw'}
            label="Withdrawal"
            onClick={() => setMode('withdraw')}
            disabled={!uiCanWithdraw}
          />
        </div>

        {!uiCanWithdraw && (
          <p className="mt-2 text-[11px] text-slate-500">
            Withdrawal is locked: {withdrawalLockedReason || 'Only the group owner/admin can withdraw.'}
          </p>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 md:p-5">
        <div className="flex flex-col gap-1">
          <p className="text-[12px] font-semibold text-slate-100">
            {isWithdraw ? 'Move money back to your wallet' : 'Fund this group mini-wallet'}
          </p>
          <p className="text-[11px] text-slate-400">
            {isWithdraw
              ? 'Withdraw from the shared mini-wallet into your personal BitBridge wallet.'
              : 'Deposit from your personal BitBridge wallet into this shared mini-wallet.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0">
            <div className="min-w-0">
              <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Amount</label>
              <div className="flex h-12 rounded-xl border border-slate-700 bg-slate-950/70 overflow-hidden">
                <span className="px-4 flex items-center text-xs text-slate-300 border-r border-slate-700">₦</span>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 px-4 text-sm bg-transparent text-slate-100 outline-none h-full min-w-0"
                  disabled={busy || (isWithdraw && !uiCanWithdraw)}
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
                placeholder={isWithdraw ? 'Eg. Refund after bill…' : 'Eg. December PHCN, rent top-up…'}
                className="w-full h-12 rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-100 outline-none min-w-0"
                disabled={busy || (isWithdraw && !uiCanWithdraw)}
              />
            </div>
          </div>

          {!isWithdraw && (
            <div className="mt-4">
              <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">
                Link to activity (optional)
              </label>
              <select
                value={selectedActivityId || ''}
                onChange={(e) => setSelectedActivityId(e.target.value || '')}
                className="w-full h-12 rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-100 outline-none"
                disabled={busy}
              >
                <option value="">No activity</option>
                {(activities || []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.status})
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[10px] text-slate-500">
                This only tags the deposit for reporting/progress. Timeline remains the financial truth.
              </p>
            </div>
          )}

          <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
            <div className="text-[11px] text-slate-500 sm:mr-auto">
              {isWithdraw
                ? 'This will debit the group and credit your wallet.'
                : 'This will debit your wallet and credit the group.'}
            </div>

            <div className="w-full sm:w-auto sm:min-w-[180px]">
              <ClassicBtn
                htmlType="submit"
                disabled={busy || (isWithdraw && !uiCanWithdraw)}
                className={[
                  'w-full h-12 px-6',
                  'flex items-center justify-center text-center',
                  'leading-none whitespace-nowrap',
                  isWithdraw ? '!bg-slate-800 hover:!bg-slate-700' : '',
                ].join(' ')}
              >
                <span className="leading-none">
                  {busy ? (isWithdraw ? 'Withdrawing…' : 'Funding…') : primaryLabel}
                </span>
              </ClassicBtn>
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
      </div>
    </section>
  )
}

const CirclesDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()

  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const currentUser = useSelector((state) => state.auth.user)
  const needsTier2 = needsTier2Access(currentUser)

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

  const [activeDisputeTx, setActiveDisputeTx] = useState(null)
  const [reactionBusy, setReactionBusy] = useState({})

  const [rightTab, setRightTab] = useState('timeline')

  // Activities
  const [activities, setActivities] = useState([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [activitiesError, setActivitiesError] = useState(null)

  const [creatingActivity, setCreatingActivity] = useState(false)
  const [activityName, setActivityName] = useState('')
  const [activityTarget, setActivityTarget] = useState('')
  const [activityDeadline, setActivityDeadline] = useState('')
  const [activityFreq, setActivityFreq] = useState('one_time')
  const [activityCreateError, setActivityCreateError] = useState(null)
  const [activityCreateSuccess, setActivityCreateSuccess] = useState(null)

  const [selectedActivityId, setSelectedActivityId] = useState('')
  const [depositPreset, setDepositPreset] = useState(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerActivityId, setDrawerActivityId] = useState(null)

  const [audit, setAudit] = useState(null)
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState(null)

  // ---- PIN modal state (fund + withdraw) ----
  const [pinOpen, setPinOpen] = useState(false)
  const [pinBusy, setPinBusy] = useState(false)
  const [pinError, setPinError] = useState(null)
  const [pinTitle, setPinTitle] = useState('Enter Transaction PIN')
  const [pendingAction, setPendingAction] = useState(null) // 'fund' | 'withdraw'
  const [pendingPayload, setPendingPayload] = useState(null)

  useEffect(() => {
    if (!needsTier2) return
    toast.info(withTier2MissingDetails(currentUser, 'Complete Tier 2 verification to use shared groups.'), {
      position: 'top-right',
      autoClose: 4000,
      pauseOnHover: true,
    })
    navigate('/dashboard/kyc')
  }, [navigate, needsTier2])

  const hasToken = () => Boolean(getAccessToken())

  const scrollToTransfer = () => {
    try {
      document.getElementById('transfer-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch (_) {
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
        const res = await fundCircle(group.id, { ...pendingPayload, pin })
        const body = res?.data || {}

        const newBalanceCents =
          typeof body.balance_cents === 'number'
            ? body.balance_cents
            : group.balance_cents + pendingPayload.amount_cents

        setGroup({ ...group, balance_cents: newBalanceCents })

        const circleActivityId = pendingPayload.circle_activity_id || null
        const linkedAct = circleActivityId ? (activities || []).find((a) => a.id === circleActivityId) : null

        setActivity((prev) => [
          {
            id: `local-fund-${Date.now()}`,
            amount_cents: pendingPayload.amount_cents,
            direction: 'credit',
            kind: 'fund',
            description: pendingPayload.note || 'Funding from main wallet',
            occurred_at: new Date().toISOString(),
            user: { email: 'You' },
            reactions: { counts: {}, mine: [] },
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

        setGroup({ ...group, balance_cents: newBalanceCents })

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

        setWithdrawSuccess('Withdrawn to your wallet.')
        setWithdrawError(null)
      }

      // ✅ refresh summary/audit (and activities if user is viewing that tab)
      fetchAuditSummary()
      if (rightTab === 'activities') fetchActivities()

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

        const res = await getCircle(id)
        const data = res?.data

        setGroup(data)
        setMembers(data?.members || [])
        setActivity(data?.recent_transactions || [])
      } catch (err) {
        console.error('[CircleDetail] fetchCircle error:', err)
        const status = err?.response?.status
        if (status === 404) setError('This group could not be found.')
        else if (status === 401) setError('You are not authorised. Please log in again.')
        else setError(err?.response?.data?.errors?.join(', ') || err.message || 'Unable to load this group.')
      } finally {
        setLoading(false)
      }
    }

    if (id) fetchCircle()
  }, [id])

  const createdLabel = group?.created_at
    ? new Date(group.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''

  const balanceNaira = (group?.balance_cents || 0) / 100

  const currentRole = (group?.current_user_role || '').toLowerCase()
  const isOwner = currentRole === 'owner'
  const isAdmin = currentRole === 'admin'
  const backendCanWithdraw = Boolean(group?.can_withdraw)
  const uiCanWithdraw = (isOwner || isAdmin) && backendCanWithdraw
  const uiCanCreateActivity = isOwner || isAdmin
  const uiCanInviteMembers = isOwner || isAdmin

  const withdrawalLockedReason = !backendCanWithdraw
    ? 'Withdrawals are not available for your account in this group.'
    : !(isOwner || isAdmin)
    ? 'Only the group owner/admin can withdraw.'
    : ''

  const memberCount = Array.isArray(members) ? members.length : 0
  const membersMasked = Array.isArray(members) ? members.some((m) => m?.masked) : false

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
  const onDeposit = async ({ amountValue, note, circleActivityId }) => {
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
      circle_activity_id: circleActivityId || null,
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
      setInviteError('Only group owners and admins can invite members.')
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

  useEffect(() => {
    if (rightTab === 'activities') fetchActivities()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rightTab, group?.id])

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
      setActivityCreateError('Only the group owner/admin can create an activity.')
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

      setActivityCreateSuccess('Activity created.')
      setActivityName('')
      setActivityTarget('')
      setActivityDeadline('')
      setActivityFreq('one_time')
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
    scrollToTransfer()
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

        <section className="rounded-3xl bg-gradient-to-r from-[#050816] via-slate-950 to-black border border-slate-800/70 px-5 py-5 md:px-7 md:py-7 shadow-[0_18px_60px_rgba(0,0,0,0.6)]">
          {loading ? (
            <p className="text-xs text-slate-400">Loading group…</p>
          ) : error ? (
            <p className="text-xs text-red-400">{error}</p>
          ) : !group ? (
            <p className="text-xs text-slate-400">Group not found.</p>
          ) : (
            <>
              <p className="text-[11px] tracking-[0.26em] uppercase text-sky-300/80 mb-2">SHARED GROUP</p>

              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                <div className="space-y-2 min-w-0">
                  <h1 className="text-2xl md:text-3xl font-semibold">{group.name}</h1>

                  <div className="flex flex-wrap gap-2 text-[10px] mt-1">
                    {group.purpose && (
                      <span className="inline-flex items-center rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-[2px] uppercase tracking-[0.16em] text-sky-200">
                        {group.purpose}
                      </span>
                    )}
                    <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-[2px] uppercase tracking-[0.16em] text-emerald-200">
                      Circle mini-wallet
                    </span>
                    {currentRole && (
                      <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/60 px-3 py-[2px] uppercase tracking-[0.16em] text-slate-200">
                        Your role: {currentRole}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400 mt-1">
                    Created {createdLabel || 'recently'} • Owner:{' '}
                    <span className="text-slate-200">{group.owner?.email || 'You'}</span>
                  </p>
                </div>

                <div className="lg:text-right lg:max-w-[320px] lg:pt-2">
                  <p className="text-[11px] text-slate-400 mb-1">Group balance</p>
                  <p className="text-xl md:text-2xl font-semibold text-emerald-300">{formatNaira(balanceNaira)}</p>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Every top-up, bill payment and payout connected to this group will show up in the live activity timeline so everyone stays in the loop.
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
            </>
          )}
        </section>

        <div className="grid lg:grid-cols-3 gap-4 items-start min-w-0">
          <TransferCard
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
          />

          <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 min-w-0">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div>
                <h2 className="text-sm font-semibold">Members</h2>
                <p className="text-[11px] text-slate-500">
                  {memberCount} member{memberCount === 1 ? '' : 's'}
                </p>
              </div>
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                {currentRole || 'member'}
              </span>
            </div>

            {membersMasked && (
              <p className="text-[11px] text-slate-500 mb-3">
                Some details are hidden for members. Admins can view full info.
              </p>
            )}

            {memberCount ? (
              <ul className="space-y-2">
                {(members || []).map((member) => {
                  const roleLabel = member?.role || 'member'
                  const memberUser = member?.user || {}
                  const displayName = memberUser.display_name || memberUser.email || 'Member'
                  const email = memberUser.email || ''
                  const phone = memberUser.phone_number || ''
                  const invitedBy = member?.invited_by?.email || member?.invited_by?.id
                  const avatarKey = email || displayName

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

          <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 min-w-0 lg:sticky lg:top-6">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h2 className="text-sm font-semibold">
                {rightTab === 'timeline' ? 'Live activity timeline' : 'Activities & goals'}
              </h2>

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

                <PanelTabBtn active={rightTab === 'timeline'} label="Timeline" onClick={() => setRightTab('timeline')} />
                <PanelTabBtn active={rightTab === 'activities'} label="Activities" onClick={() => setRightTab('activities')} />
              </div>
            </div>

            {rightTab === 'timeline' ? (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-slate-500">Chat-style log of money movements</p>
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

                      const isCredit = tx.direction === 'credit' || tx.direction === 'in'
                      const isPayout = tx.kind === 'payout'
                      const directionLabel = isPayout ? 'Payout to wallet' : isCredit ? 'Money added' : 'Money moved out'
                      const pillLabel = isPayout ? 'GROUP → WALLET' : isCredit ? 'WALLET → GROUP' : 'GROUP → WALLET'
                      const isMine = Boolean(currentUser?.id && tx.user?.id && tx.user.id === currentUser.id)

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
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-[11px] text-slate-300 truncate">
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
            ) : (
              <>
                <p className="text-[11px] text-slate-400">
                  Track group goals here. Transactions in the timeline remain the single source of financial truth.
                </p>

                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[12px] font-semibold text-slate-100">Create a new activity</p>
                    {!uiCanCreateActivity && <span className="text-[10px] text-slate-500">Owner/Admin only</span>}
                  </div>

                  <form onSubmit={handleCreateActivity} className="mt-4 space-y-3">
                    <div>
                      <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Activity name</label>
                      <input
                        value={activityName}
                        onChange={(e) => setActivityName(e.target.value)}
                        placeholder='Eg. "Q1 Office Rent"'
                        className="w-full h-11 rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-100 outline-none"
                        disabled={!uiCanCreateActivity || creatingActivity}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Target amount (₦)</label>
                        <input
                          value={activityTarget}
                          onChange={(e) => setActivityTarget(e.target.value)}
                          placeholder="0.00"
                          className="w-full h-11 rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-100 outline-none"
                          disabled={!uiCanCreateActivity || creatingActivity}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Deadline</label>
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
                      <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Contribution frequency</label>
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
                      <p className="mt-2 text-[10px] text-slate-500">This does not charge anyone yet — it only defines the goal.</p>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setActivityName('')
                          setActivityTarget('')
                          setActivityDeadline('')
                          setActivityFreq('one_time')
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
                        <span className="leading-none">{creatingActivity ? 'Creating…' : 'Create activity'}</span>
                      </ClassicBtn>
                    </div>

                    {activityCreateError && <p className="text-[11px] text-red-400">{activityCreateError}</p>}
                    {activityCreateSuccess && <p className="text-[11px] text-emerald-400">{activityCreateSuccess}</p>}
                  </form>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-semibold text-slate-100">Current & past activities</p>
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
                        <p className="text-[11px] text-slate-400">No activities yet.</p>
                        <p className="mt-1 text-[11px] text-slate-500">Create a goal to help the group coordinate contributions.</p>
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
            )}
          </section>
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 min-w-0">
          <form onSubmit={handleInvite} className="flex flex-col md:flex-row gap-2 items-start md:items-center min-w-0">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder={uiCanInviteMembers ? 'friend@example.com' : 'Only owners/admins can add people'}
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
              Only group owners and admins can invite members.
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
