import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import BusinessWorkspaceNav from '../../components/business/BusinessWorkspaceNav'
import useSelectedBusiness from '../../hooks/useSelectedBusiness'
import useBusinessDashboardPresentation from '../../hooks/useBusinessDashboardPresentation'
import BusinessWorkspaceRequired from '../../components/business/BusinessWorkspaceRequired'
import {
  createBusinessPayoutRun,
  executeBusinessPayoutRun,
  getBusinessPayoutRun,
  getBusinessPayoutRuns,
  previewBusinessPayoutRun,
  reopenBusinessPayoutRun,
  reviewBusinessPayoutRun,
  submitBusinessPayoutRun,
  updateBusinessPayoutRun,
} from '../../api/business'

const cardClass =
  'rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.22)]'

const emptyRow = () => ({
  name: '',
  account_name: '',
  account_number: '',
  bank_code: '',
  bank_name: '',
  amount: '',
  narration: '',
})

const formatNgn = (value = 0) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

const BusinessBulkPayouts = () => {
  const { ownerMode, selectedBusiness } = useSelectedBusiness()
  const {
    loading: accountLoading,
    approvalSummary,
    isLive,
    permissions,
    hero,
    navigationItems,
  } = useBusinessDashboardPresentation(selectedBusiness?.id)
  const [rows, setRows] = useState([emptyRow()])
  const [existingRuns, setExistingRuns] = useState([])
  const [preview, setPreview] = useState(null)
  const [draftRun, setDraftRun] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [historyStatus, setHistoryStatus] = useState('')
  const [historyCycleKey, setHistoryCycleKey] = useState('')
  const [historyQuery, setHistoryQuery] = useState('')

  const loadContext = useCallback(async () => {
    if (!selectedBusiness?.id) {
      setLoading(false)
      return
    }

      setLoading(true)
      setErrorMessage('')
      try {
      const runsRes = await getBusinessPayoutRuns(selectedBusiness.id, {
          scheduled: false,
          status: historyStatus,
          cycle_key: historyCycleKey,
          query: historyQuery,
        }).catch(() => null)
      setExistingRuns(runsRes?.data?.data || [])
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'Unable to load payroll right now.')
    } finally {
      setLoading(false)
    }
  }, [selectedBusiness?.id, historyStatus, historyCycleKey, historyQuery])

  useEffect(() => {
    loadContext()
  }, [loadContext])

  const sanitizedRows = useMemo(
    () =>
      rows
        .map((row) => ({
          ...row,
          amount: row.amount === '' ? '' : Number(row.amount),
        }))
        .filter(
          (row) =>
            row.name ||
            row.account_name ||
            row.account_number ||
            row.bank_code ||
            row.bank_name ||
            row.amount ||
            row.narration
        ),
    [rows]
  )
  const canRunPayroll = Boolean(permissions?.canRunPayroll)

  const handleRowChange = (index, field, value) => {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row))
    )
  }

  const addRow = () => setRows((current) => [...current, emptyRow()])

  const removeRow = (index) => {
    setRows((current) => {
      if (current.length === 1) return [emptyRow()]
      return current.filter((_, rowIndex) => rowIndex !== index)
    })
  }

  const ensureRowsPresent = () => {
    if (!sanitizedRows.length) {
      toast.error('Add at least one payroll entry.')
      return false
    }
    return true
  }

  const handlePreview = async () => {
    if (!selectedBusiness?.id || !ensureRowsPresent()) return

    setBusy('preview')
    setErrorMessage('')
    try {
      const response = await previewBusinessPayoutRun(selectedBusiness.id, {
        payout_run: { items: sanitizedRows },
      })
      setPreview(response?.data?.data || null)
      toast.success('Payroll totals prepared.')
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to preview this payroll run.'
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setBusy('')
    }
  }

  const handleSaveDraft = async () => {
    if (!selectedBusiness?.id || !ensureRowsPresent()) return

    setBusy('draft')
    setErrorMessage('')
    try {
      const payload = { payout_run: { title: 'Payroll run', items: sanitizedRows } }
      const response = draftRun?.id
        ? await updateBusinessPayoutRun(selectedBusiness.id, draftRun.id, payload)
        : await createBusinessPayoutRun(selectedBusiness.id, payload)
      setDraftRun(response?.data?.data || null)
      setPreview(response?.data?.data?.preview || null)
      toast.success(draftRun?.id ? 'Draft payroll run updated.' : 'Draft payroll run created.')
      await loadContext()
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to save this payroll run.'
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setBusy('')
    }
  }

  const handleSubmit = async () => {
    if (!selectedBusiness?.id || !draftRun?.id) return

    setBusy('submit')
    setErrorMessage('')
    try {
      const response = await submitBusinessPayoutRun(selectedBusiness.id, draftRun.id)
      setDraftRun(response?.data?.data || null)
      setPreview(response?.data?.data?.preview || null)
      const nextStatus = String(response?.data?.data?.status || '')
      toast.info(nextStatus === 'pending_approval' ? 'Payroll run submitted for approval.' : 'Payroll run approved and ready to execute.')
      await loadContext()
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to submit this payroll run.'
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setBusy('')
    }
  }

  const handleReview = async () => {
    if (!selectedBusiness?.id || !draftRun?.id) return

    setBusy('review')
    setErrorMessage('')
    try {
      const response = await reviewBusinessPayoutRun(selectedBusiness.id, draftRun.id)
      setDraftRun(response?.data?.data || null)
      setPreview(response?.data?.data?.preview || null)
      toast.success('Payroll run locked for review.')
      await loadContext()
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to lock this payroll run for review.'
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setBusy('')
    }
  }

  const handleReopen = async () => {
    if (!selectedBusiness?.id || !draftRun?.id) return

    setBusy('reopen')
    setErrorMessage('')
    try {
      const response = await reopenBusinessPayoutRun(selectedBusiness.id, draftRun.id)
      setDraftRun(response?.data?.data || null)
      setPreview(response?.data?.data?.preview || null)
      toast.success('Payroll run returned to draft editing.')
      await loadContext()
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to reopen this payroll run.'
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setBusy('')
    }
  }

  const handleExecute = async () => {
    if (!selectedBusiness?.id || !draftRun?.id) return

    setBusy('execute')
    setErrorMessage('')
    try {
      const response = await executeBusinessPayoutRun(selectedBusiness.id, draftRun.id)
      setDraftRun(response?.data?.data || null)
      setPreview(response?.data?.data?.preview || null)
      toast.success('Payroll execution started.')
      await loadContext()
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to execute this payroll run.'
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setBusy('')
    }
  }


  const loadRunDetail = async (runId) => {
    if (!selectedBusiness?.id) return
    try {
      const response = await getBusinessPayoutRun(selectedBusiness.id, runId)
      const data = response?.data?.data || null
      setDraftRun(data)
      setPreview(data?.preview || null)
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Unable to load this payroll run.')
    }
  }


  const statusTone = (status) => {
    switch (String(status || '').toLowerCase()) {
      case 'approved':
      case 'completed':
      case 'successful':
        return 'border-emerald-600/40 bg-emerald-500/10 text-emerald-100'
      case 'pending_approval':
      case 'processing':
      case 'pending':
        return 'border-amber-500/40 bg-amber-500/10 text-amber-100'
      case 'failed':
      case 'rejected':
        return 'border-rose-600/40 bg-rose-500/10 text-rose-100'
      case 'partially_completed':
        return 'border-blue-600/40 bg-blue-500/10 text-blue-100'
      default:
        return 'border-slate-700 bg-slate-950/60 text-slate-200'
    }
  }

  if (ownerMode !== 'business') return <Navigate to="/dashboard/home" replace />

  if (!selectedBusiness) {
    return <BusinessWorkspaceRequired message="Select a business workspace from the switcher or return to the setup hub to prepare payroll and team payments." />
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-[28px] border border-[#FF7A18] bg-[linear-gradient(135deg,rgba(255,138,42,0.16),rgba(255,176,90,0.08)_40%,rgba(15,23,42,0.94)_100%)] p-5 md:p-7 shadow-[0_24px_60px_rgba(255,122,24,0.16)]">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#FFB05A]">Payroll</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white md:text-3xl">{selectedBusiness.name}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                {isLive
                  ? 'Prepare payroll or one-off team payments for multiple recipients, submit the run into the current approval flow, then execute it through the existing business transfer rails.'
                  : 'Payroll unlocks after onboarding, verification, and provisioning are complete.'}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-950/45 px-4 py-3 text-sm text-slate-300">
              Pending approvals: <span className="font-semibold text-white">{approvalSummary?.total_pending || 0}</span>
            </div>
          </div>
        </section>

        <BusinessWorkspaceNav
          pendingCount={approvalSummary?.total_pending || 0}
          visibleNavigationItems={navigationItems}
          action={
            <Link
              to="/dashboard/business/transfers"
              className="rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white"
            >
              Review transfers
            </Link>
          }
        />

        {accountLoading || loading ? (
          <section className={cardClass}>
            <div className="text-sm text-slate-400">Loading payroll workspace...</div>
          </section>
        ) : !isLive ? (
          <section className={cardClass}>
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-5">
              <div className="text-sm font-semibold text-amber-100">Payroll is not available yet.</div>
              <div className="mt-2 text-sm text-amber-50/90">
                Complete business activation first, then team payouts and recurring payroll will unlock.
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
          </section>
        ) : !canRunPayroll ? (
          <section className={cardClass}>
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-5">
              <div className="text-sm font-semibold text-amber-100">Payroll access is restricted.</div>
              <div className="mt-2 text-sm text-amber-50/90">
                Your role does not currently have permission to run payroll from this business workspace.
              </div>
            </div>
          </section>
        ) : (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
            <section className={cardClass}>
              {errorMessage ? (
                <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
                  {errorMessage}
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">Payroll entries</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Manual entry lets you prepare payroll runs for review, approval, and execution.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addRow}
                  className="rounded-2xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white"
                >
                  Add row
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {rows.map((row, index) => (
                  <div key={`row-${index}`} className="rounded-3xl border border-slate-800 bg-slate-950/50 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-white">Recipient {index + 1}</div>
                      <button type="button" onClick={() => removeRow(index)} className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 hover:text-white">
                        Remove
                      </button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {[
                        ['name', 'Recipient name'],
                        ['account_name', 'Account name'],
                        ['account_number', 'Account number'],
                        ['bank_code', 'Bank code'],
                        ['bank_name', 'Bank name'],
                        ['amount', 'Amount (NGN)'],
                        ['narration', 'Narration'],
                      ].map(([field, label]) => (
                        <label key={`${field}-${index}`} className="block text-sm">
                          <span className="text-slate-300">{label}</span>
                          <input
                            type={field === 'amount' ? 'number' : 'text'}
                            value={row[field]}
                            onChange={(event) => handleRowChange(index, field, event.target.value)}
                            className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
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
                  onClick={handleSaveDraft}
                  disabled={busy === 'draft' || draftRun?.status === 'review_ready'}
                  className="rounded-2xl bg-[#FFB05A] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#ffc27d] disabled:opacity-60"
                >
                  {busy === 'draft' ? 'Saving draft...' : draftRun?.id ? 'Update draft' : 'Create draft'}
                </button>
                <button
                  type="button"
                  onClick={handleReview}
                  disabled={!draftRun?.id || busy === 'review' || draftRun?.status !== 'draft'}
                  className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100 disabled:opacity-50"
                >
                  {busy === 'review' ? 'Locking...' : 'Review payroll'}
                </button>
                <button
                  type="button"
                  onClick={handleReopen}
                  disabled={!draftRun?.id || busy === 'reopen' || draftRun?.status !== 'review_ready'}
                  className="rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white disabled:opacity-50"
                >
                  {busy === 'reopen' ? 'Reopening...' : 'Return to editing'}
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!draftRun?.id || busy === 'submit' || ['pending_approval', 'approved', 'processing', 'completed'].includes(String(draftRun?.status || ''))}
                  className="rounded-2xl border border-emerald-600/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 disabled:opacity-50"
                >
                  {busy === 'submit' ? 'Submitting...' : 'Submit for approval'}
                </button>
                <button
                  type="button"
                  onClick={handleExecute}
                  disabled={!draftRun?.id || busy === 'execute' || draftRun?.status !== 'approved'}
                  className="rounded-2xl border border-blue-600/40 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-100 disabled:opacity-50"
                >
                  {busy === 'execute' ? 'Executing...' : 'Execute payroll'}
                </button>
                <Link
                  to="/dashboard/business/payees"
                  className="rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white"
                >
                  Manage team payees
                </Link>
                <Link
                  to="/dashboard/business/schedules"
                  className="rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white"
                >
                  Recurring payroll
                </Link>
              </div>
            </section>

            <div className="flex flex-col gap-6">
              <section className={cardClass}>
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Preview</div>
                {preview ? (
                  <div className="mt-4 space-y-3 text-sm text-slate-300">
                    <div className="flex items-center justify-between gap-3">
                      <span>Total recipients</span>
                      <span className="font-semibold text-white">{preview.total_items}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Total amount</span>
                      <span className="font-semibold text-white">{formatNgn(preview.total_amount)}</span>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Approval</div>
                      <div className="mt-2 text-sm text-slate-300">
                        {preview.approval?.required
                          ? `Approval required from ${preview.approval.required_roles?.join(', ') || 'configured approvers'}.`
                          : 'No enforced approval is required for this run at the current total.'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-slate-400">
                    Preview totals to see the batch size and whether the current approval policy will block execution.
                  </div>
                )}
              </section>

              <section className={cardClass}>
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Draft payroll run</div>
                {draftRun ? (
                  <div className="mt-4 space-y-3 text-sm text-slate-300">
                    <div className="flex items-center justify-between gap-3">
                      <span>Status</span>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${statusTone(draftRun.status)}`}>
                        {draftRun.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Reference</span>
                      <span className="font-mono text-xs text-slate-200">{draftRun.reference}</span>
                    </div>
                    {draftRun.period_label ? (
                      <div className="flex items-center justify-between gap-3">
                        <span>Payroll period</span>
                        <span className="text-white">{draftRun.period_label}</span>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between gap-3">
                      <span>Total</span>
                      <span className="font-semibold text-white">{formatNgn(draftRun.total_amount)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-3 py-3">
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Successful</div>
                        <div className="mt-2 text-lg font-semibold text-white">{draftRun.successful_items_count || 0}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-3 py-3">
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Pending</div>
                        <div className="mt-2 text-lg font-semibold text-white">{draftRun.pending_items_count || 0}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-3 py-3">
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Failed</div>
                        <div className="mt-2 text-lg font-semibold text-white">{draftRun.failed_items_count || 0}</div>
                      </div>
                    </div>
                    {draftRun.review_ready ? (
                      <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 text-blue-100">
                        This payroll run is locked for review. Reopen it if you need to edit before submission.
                      </div>
                    ) : null}
                    {draftRun.approval_request_id ? (
                      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100">
                        This run is linked to approval request <span className="font-mono text-xs">{draftRun.approval_request_id}</span>{draftRun.approval_status ? ` (${draftRun.approval_status})` : ''}.
                      </div>
                    ) : null}
                    {Array.isArray(draftRun.items) && draftRun.items.length ? (
                      <div className="space-y-2">
                        {draftRun.items.slice(0, 12).map((item) => (
                          <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950/45 px-3 py-3 text-sm text-slate-300">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="font-semibold text-white">{item.payee_name || item.account_name || item.name || 'Recipient'}</div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {item.payee_kind ? `${item.payee_kind} | ` : ''}{item.employee_code ? `${item.employee_code} | ` : ''}{item.bank_code} | {item.account_number}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-white">{formatNgn(item.amount)}</div>
                                <div className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${statusTone(item.status)}`}>
                                  {String(item.status || 'draft').replace(/_/g, ' ')}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-slate-400">
                    Create a draft run first. Submission and execution stay disabled until a run exists.
                  </div>
                )}
              </section>

              <section className={cardClass}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Payroll history</div>
                  <span className="text-xs text-slate-500">{existingRuns.length} total</span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <label className="block text-sm">
                    <span className="text-slate-300">Status</span>
                    <select
                      value={historyStatus}
                      onChange={(event) => setHistoryStatus(event.target.value)}
                      className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60"
                    >
                      <option value="">All statuses</option>
                      {['draft', 'review_ready', 'pending_approval', 'approved', 'processing', 'partially_completed', 'completed', 'failed', 'rejected'].map((status) => (
                        <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-300">Cycle key</span>
                    <input
                      value={historyCycleKey}
                      onChange={(event) => setHistoryCycleKey(event.target.value)}
                      placeholder="e.g. 2026-04"
                      className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-300">Search</span>
                    <input
                      value={historyQuery}
                      onChange={(event) => setHistoryQuery(event.target.value)}
                      placeholder="Reference, title, or period"
                      className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60"
                    />
                  </label>
                </div>
                <div className="mt-4 space-y-3">
                  {existingRuns.length ? (
                    existingRuns.slice(0, 5).map((run) => (
                      <div
                        key={run.id}
                        className="w-full rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4 text-left transition hover:border-slate-600"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">{run.title || 'Payroll run'}</div>
                            <div className="mt-1 text-xs text-slate-500">{run.reference}</div>
                            {run.period_label ? (
                              <div className="mt-1 text-xs text-slate-500">{run.period_label}</div>
                            ) : null}
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-white">{formatNgn(run.total_amount)}</div>
                            <div className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${statusTone(run.status)}`}>
                              {String(run.status || '').replace(/_/g, ' ')}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex gap-3">
                          <button
                            type="button"
                            onClick={() => loadRunDetail(run.id)}
                            className="text-xs text-slate-300 hover:text-white transition"
                          >
                            Inspect here
                          </button>
                          <Link
                            to={`/dashboard/business/payouts/${encodeURIComponent(run.id)}`}
                            className="text-xs text-[#FFB05A] hover:text-[#ffd2a0] transition"
                          >
                            Open detail
                          </Link>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4 text-sm text-slate-400">
                      No payroll runs yet.
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

export default BusinessBulkPayouts





