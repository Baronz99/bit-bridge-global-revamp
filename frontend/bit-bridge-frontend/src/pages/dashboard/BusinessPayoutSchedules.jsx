import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import BusinessWorkspaceNav from '../../components/business/BusinessWorkspaceNav'
import useSelectedBusiness from '../../hooks/useSelectedBusiness'
import BusinessWorkspaceRequired from '../../components/business/BusinessWorkspaceRequired'
import {
  createBusinessPayoutRun,
  generateBusinessPayoutRun,
  getBusinessApprovalSummary,
  getBusinessPayees,
  getBusinessScheduledPayoutRuns,
  previewBusinessPayoutRun,
} from '../../api/business'

const cardClass =
  'rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.22)]'

const formatNgn = (value = 0) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

const toneForStatus = (status) => {
  switch (String(status || '').toLowerCase()) {
    case 'completed':
    case 'approved':
      return 'border-emerald-600/40 bg-emerald-500/10 text-emerald-100'
    case 'pending_approval':
    case 'processing':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-100'
    case 'failed':
    case 'rejected':
      return 'border-rose-600/40 bg-rose-500/10 text-rose-100'
    default:
      return 'border-slate-700 bg-slate-950/60 text-slate-200'
  }
}

const BusinessPayoutSchedules = () => {
  const { ownerMode, selectedBusiness } = useSelectedBusiness()
  const [approvalSummary, setApprovalSummary] = useState(null)
  const [payees, setPayees] = useState([])
  const [scheduledRuns, setScheduledRuns] = useState([])
  const [selectedPayees, setSelectedPayees] = useState({})
  const [scheduleDay, setScheduleDay] = useState('25')
  const [title, setTitle] = useState('Monthly payroll')
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState('')
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const loadContext = useCallback(async () => {
    if (!selectedBusiness?.id) {
      setLoading(false)
      return
    }

    setLoading(true)
    setErrorMessage('')
    try {
      const [summaryRes, payeesRes, schedulesRes] = await Promise.all([
        getBusinessApprovalSummary(selectedBusiness.id).catch(() => null),
        getBusinessPayees(selectedBusiness.id, { roster_status: 'active' }).catch(() => null),
        getBusinessScheduledPayoutRuns(selectedBusiness.id).catch(() => null),
      ])
      setApprovalSummary(summaryRes?.data?.data || null)
      setPayees(payeesRes?.data?.data?.payees || [])
      setScheduledRuns(schedulesRes?.data?.data || [])
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'Unable to load recurring payroll right now.')
    } finally {
      setLoading(false)
    }
  }, [selectedBusiness?.id])

  useEffect(() => {
    loadContext()
  }, [loadContext])

  const selectedRows = useMemo(
    () =>
      payees
        .filter((payee) => selectedPayees[payee.id]?.enabled)
        .map((payee) => ({
          name: payee.name,
          account_name: payee.account_name || payee.name,
          account_number: payee.account_number,
          bank_code: payee.bank_code,
          bank_name: payee.bank_name,
          amount: Number(selectedPayees[payee.id]?.amount || payee.default_amount || 0),
          narration: selectedPayees[payee.id]?.narration || `Monthly payroll for ${payee.name}`,
        }))
        .filter((row) => row.amount > 0),
    [payees, selectedPayees]
  )

  const togglePayee = (payeeId) => {
    setSelectedPayees((current) => ({
      ...current,
      [payeeId]: {
        enabled: !current[payeeId]?.enabled,
        amount: current[payeeId]?.amount || '',
        narration: current[payeeId]?.narration || '',
      },
    }))
  }

  const updateSelectedPayee = (payeeId, field, value) => {
    setSelectedPayees((current) => ({
      ...current,
      [payeeId]: {
        enabled: current[payeeId]?.enabled ?? true,
        amount: current[payeeId]?.amount || '',
        narration: current[payeeId]?.narration || '',
        [field]: value,
      },
    }))
  }

  const handlePreview = async () => {
    if (!selectedBusiness?.id || !selectedRows.length) {
      toast.error('Select at least one team payee with an amount.')
      return
    }

    setBusy('preview')
    setErrorMessage('')
    try {
      const response = await previewBusinessPayoutRun(selectedBusiness.id, { payout_run: { items: selectedRows } })
      setPreview(response?.data?.data || null)
      toast.success('Recurring payroll preview prepared.')
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to preview this recurring payroll setup.'
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setBusy('')
    }
  }

  const handleCreateSchedule = async () => {
    if (!selectedBusiness?.id || !selectedRows.length) {
      toast.error('Select at least one team payee with an amount.')
      return
    }

    setBusy('create')
    setErrorMessage('')
    try {
      await createBusinessPayoutRun(selectedBusiness.id, {
        payout_run: {
          title,
          items: selectedRows,
          schedule_frequency: 'monthly',
          schedule_day_of_month: Number(scheduleDay),
          auto_generate: true,
        },
      })
      toast.success('Monthly payroll schedule created.')
      setSelectedPayees({})
      setPreview(null)
      await loadContext()
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to create this recurring payroll schedule.'
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setBusy('')
    }
  }

  const handleGenerateRun = async (scheduleId) => {
    if (!selectedBusiness?.id) return

    setBusy(`generate-${scheduleId}`)
    try {
      await generateBusinessPayoutRun(selectedBusiness.id, scheduleId)
      toast.success('Draft payroll run generated from schedule.')
      await loadContext()
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Unable to generate a payroll run from this schedule.')
    } finally {
      setBusy('')
    }
  }

  if (ownerMode !== 'business') return <Navigate to="/dashboard/home" replace />

  if (!selectedBusiness) {
    return <BusinessWorkspaceRequired message="Select a business workspace from the switcher or return to the setup hub to configure recurring payroll." />
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-[28px] border border-[#FF7A18] bg-[linear-gradient(135deg,rgba(255,138,42,0.16),rgba(255,176,90,0.08)_40%,rgba(15,23,42,0.94)_100%)] p-5 md:p-7 shadow-[0_24px_60px_rgba(255,122,24,0.16)]">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#FFB05A]">Recurring Payroll</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white md:text-3xl">{selectedBusiness.name}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Create monthly payroll templates from saved team payees, then generate fresh payroll runs whenever the next cycle is due.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-950/45 px-4 py-3 text-sm text-slate-300">
              Pending approvals: <span className="font-semibold text-white">{approvalSummary?.total_pending || 0}</span>
            </div>
          </div>
        </section>

        <BusinessWorkspaceNav
          pendingCount={approvalSummary?.total_pending || 0}
          action={
            <Link
              to="/dashboard/business/payouts"
              className="rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white"
            >
              Open payroll
            </Link>
          }
        />

        {loading ? (
          <section className={cardClass}>
            <div className="text-sm text-slate-400">Loading recurring payroll...</div>
          </section>
        ) : (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
            <section className={cardClass}>
              {errorMessage ? (
                <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
                  {errorMessage}
                </div>
              ) : null}

              <div className="flex flex-wrap items-end justify-between gap-4">
                <label className="block text-sm">
                  <span className="text-slate-300">Payroll title</span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="mt-1 w-full min-w-[16rem] rounded-2xl border border-slate-700 bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-300">Pay day each month</span>
                  <select
                    value={scheduleDay}
                    onChange={(event) => setScheduleDay(event.target.value)}
                    className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60"
                  >
                    {Array.from({ length: 28 }, (_, index) => String(index + 1)).map((day) => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-5 space-y-4">
                {payees.length ? payees.map((payee) => {
                  const selected = selectedPayees[payee.id] || {}
                  return (
                    <div key={payee.id} className="rounded-3xl border border-slate-800 bg-slate-950/50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white">{payee.name}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {payee.payee_kind || 'vendor'} {payee.role_label ? `| ${payee.role_label}` : ''} {payee.group_label ? `| ${payee.group_label}` : ''} | {payee.bank_code} | {payee.account_number}
                          </div>
                        </div>
                        <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                          <input type="checkbox" checked={Boolean(selected.enabled)} onChange={() => togglePayee(payee.id)} />
                          Include
                        </label>
                      </div>

                      {selected.enabled ? (
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          {[
                            ['amount', 'Amount (NGN)'],
                            ['narration', 'Narration'],
                          ].map(([field, label]) => (
                            <label key={`${payee.id}-${field}`} className="block text-sm">
                              <span className="text-slate-300">{label}</span>
                              <input
                                type={field === 'amount' ? 'number' : 'text'}
                                value={selected[field] || ''}
                                onChange={(event) => updateSelectedPayee(payee.id, field, event.target.value)}
                                className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60"
                              />
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )
                }) : (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4 text-sm text-slate-400">
                    No team payees yet. Add employees or vendors first before configuring recurring payroll.
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={busy === 'preview'}
                  className="rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white disabled:opacity-60"
                >
                  {busy === 'preview' ? 'Preparing preview...' : 'Preview totals'}
                </button>
                <button
                  type="button"
                  onClick={handleCreateSchedule}
                  disabled={busy === 'create'}
                  className="rounded-2xl bg-[#FFB05A] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#ffc27d] disabled:opacity-60"
                >
                  {busy === 'create' ? 'Creating schedule...' : 'Create recurring payroll'}
                </button>
                <Link
                  to="/dashboard/business/payees"
                  className="rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white"
                >
                  Manage team payees
                </Link>
              </div>
            </section>

            <div className="flex flex-col gap-6">
              <section className={cardClass}>
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Schedule preview</div>
                {preview ? (
                  <div className="mt-4 space-y-3 text-sm text-slate-300">
                    <div className="flex items-center justify-between gap-3">
                      <span>Total recipients</span>
                      <span className="font-semibold text-white">{preview.total_items}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Total monthly amount</span>
                      <span className="font-semibold text-white">{formatNgn(preview.total_amount)}</span>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Approval</div>
                      <div className="mt-2 text-sm text-slate-300">
                        {preview.approval?.required
                          ? `Each generated run will require approval from ${preview.approval.required_roles?.join(', ') || 'configured approvers'}.`
                          : 'Generated runs will be approved immediately at the current total.'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-slate-400">
                    Preview the selected team payees to confirm totals before creating monthly payroll.
                  </div>
                )}
              </section>

              <section className={cardClass}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Recurring payroll</div>
                  <span className="text-xs text-slate-500">{scheduledRuns.length} total</span>
                </div>
                <div className="mt-4 space-y-3">
                  {scheduledRuns.length ? scheduledRuns.map((run) => (
                    <div key={run.id} className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white">{run.title || 'Recurring payroll'}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            Monthly on day {run.schedule_day_of_month || '-'} | Next payroll {run.next_run_at ? new Date(run.next_run_at).toLocaleString() : 'Not set'}
                          </div>
                        </div>
                        <div className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${toneForStatus(run.status)}`}>
                          {String(run.status || 'draft').replace(/_/g, ' ')}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-300">
                        <span>{formatNgn(run.total_amount)}</span>
                        <button
                          type="button"
                          onClick={() => handleGenerateRun(run.id)}
                          disabled={busy === `generate-${run.id}`}
                          className="rounded-2xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white disabled:opacity-60"
                        >
                          {busy === `generate-${run.id}` ? 'Generating...' : 'Generate payroll run'}
                        </button>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4 text-sm text-slate-400">
                      No recurring payroll schedules yet.
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default BusinessPayoutSchedules



