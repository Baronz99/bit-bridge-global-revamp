import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import BusinessWorkspaceNav from '../../components/business/BusinessWorkspaceNav'
import useSelectedBusiness from '../../hooks/useSelectedBusiness'
import BusinessWorkspaceRequired from '../../components/business/BusinessWorkspaceRequired'
import {
  archiveBusinessPayee,
  bulkUpdateBusinessPayees,
  getBusinessApprovalSummary,
  getBusinessPayees,
  updateBusinessPayee,
} from '../../api/business'

const cardClass =
  'rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.22)]'

const formatNgn = (value = 0) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

const BusinessPayees = () => {
  const { ownerMode, selectedBusiness } = useSelectedBusiness()
  const [approvalSummary, setApprovalSummary] = useState(null)
  const [payees, setPayees] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [query, setQuery] = useState('')
  const [kindFilter, setKindFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('active')
  const [bulkAmount, setBulkAmount] = useState('')
  const [bulkStatus, setBulkStatus] = useState('')

  const loadContext = useCallback(async () => {
    if (!selectedBusiness?.id) {
      setLoading(false)
      return
    }

    setLoading(true)
    setErrorMessage('')
    try {
      const includeArchived = statusFilter === 'archived'
      const [summaryRes, payeesRes] = await Promise.all([
        getBusinessApprovalSummary(selectedBusiness.id).catch(() => null),
        getBusinessPayees(selectedBusiness.id, {
          payee_kind: kindFilter === 'all' ? '' : kindFilter,
          roster_status: ['active', 'paused'].includes(statusFilter) ? statusFilter : '',
          include_archived: includeArchived,
          query,
        }).catch(() => null),
      ])
      const loaded = payeesRes?.data?.data?.payees || []
      setApprovalSummary(summaryRes?.data?.data || null)
      setPayees(statusFilter === 'archived' ? loaded.filter((payee) => payee.status === 'archived') : loaded)
      setSelectedIds([])
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'Unable to load team members right now.')
    } finally {
      setLoading(false)
    }
  }, [selectedBusiness?.id, kindFilter, query, statusFilter])

  useEffect(() => {
    loadContext()
  }, [loadContext])

  const metrics = useMemo(() => {
    const employees = payees.filter((payee) => payee.payee_kind === 'employee')
    return {
      employees: employees.length,
      paused: payees.filter((payee) => payee.status === 'paused').length,
      active: payees.filter((payee) => payee.status === 'active').length,
    }
  }, [payees])

  const handleFieldChange = (payeeId, field, value) => {
    setPayees((current) =>
      current.map((payee) => (payee.id === payeeId ? { ...payee, [field]: value } : payee))
    )
  }

  const handleSave = async (payee) => {
    if (!selectedBusiness?.id) return

    setSavingId(payee.id)
    try {
      await updateBusinessPayee(selectedBusiness.id, payee.id, {
        payee: {
          name: payee.name,
          account_name: payee.account_name,
          account_number: payee.account_number,
          bank_code: payee.bank_code,
          bank_name: payee.bank_name,
          payee_kind: payee.payee_kind,
          group_label: payee.group_label,
          default_amount: payee.default_amount,
          role_label: payee.role_label,
          roster_status: payee.roster_status || 'active',
          employee_code: payee.employee_code,
        },
      })
      toast.success('Team member updated.')
      await loadContext()
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Unable to update this team member.')
    } finally {
      setSavingId('')
    }
  }

  const handleArchive = async (payeeId) => {
    if (!selectedBusiness?.id) return

    setSavingId(payeeId)
    try {
      await archiveBusinessPayee(selectedBusiness.id, payeeId)
      toast.success('Team member archived.')
      await loadContext()
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Unable to archive this team member.')
    } finally {
      setSavingId('')
    }
  }

  const handleBulkUpdate = async () => {
    if (!selectedBusiness?.id || !selectedIds.length) {
      toast.error('Select at least one employee or payee first.')
      return
    }
    if (!bulkAmount && !bulkStatus) {
      toast.error('Enter a salary update or choose a status change first.')
      return
    }

    try {
      await bulkUpdateBusinessPayees(selectedBusiness.id, {
        bulk_update: {
          payee_ids: selectedIds,
          default_amount: bulkAmount || undefined,
          roster_status: bulkStatus || undefined,
        },
      })
      toast.success('Bulk payroll update applied.')
      setBulkAmount('')
      setBulkStatus('')
      await loadContext()
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Unable to apply the bulk payroll update.')
    }
  }

  const toggleSelection = (payeeId) => {
    setSelectedIds((current) =>
      current.includes(payeeId) ? current.filter((id) => id !== payeeId) : [...current, payeeId]
    )
  }

  const allVisibleSelected = payees.length > 0 && payees.every((payee) => selectedIds.includes(payee.id))

  if (ownerMode !== 'business') return <Navigate to="/dashboard/home" replace />

  if (!selectedBusiness) {
    return <BusinessWorkspaceRequired message="Select a business workspace from the switcher or return to the setup hub to manage employees, vendors, and payment records." />
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-[28px] border border-[#FF7A18] bg-[linear-gradient(135deg,rgba(255,138,42,0.16),rgba(255,176,90,0.08)_40%,rgba(15,23,42,0.94)_100%)] p-5 md:p-7 shadow-[0_24px_60px_rgba(255,122,24,0.16)]">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#FFB05A]">Employees</p>
          <h1 className="mt-3 text-2xl font-semibold text-white md:text-3xl">{selectedBusiness.name}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Maintain employees, vendors, and salary defaults for payroll and recurring team payments without turning this into a full HR system.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-700 bg-slate-950/45 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Employees</div>
              <div className="mt-2 text-2xl font-semibold text-white">{metrics.employees}</div>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-950/45 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Active for payroll</div>
              <div className="mt-2 text-2xl font-semibold text-white">{metrics.active}</div>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-950/45 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Paused</div>
              <div className="mt-2 text-2xl font-semibold text-white">{metrics.paused}</div>
            </div>
          </div>
        </section>

        <BusinessWorkspaceNav pendingCount={approvalSummary?.total_pending || 0} />

        <section className={cardClass}>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_12rem]">
            <label className="block text-sm">
              <span className="text-slate-300">Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, account name, or employee code"
                className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-300">Type</span>
              <select
                value={kindFilter}
                onChange={(event) => setKindFilter(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60"
              >
                <option value="all">All</option>
                <option value="employee">Employees</option>
                <option value="vendor">Vendors</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-slate-300">Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </div>
        </section>

        <section className={cardClass}>
          {errorMessage ? (
            <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
              {errorMessage}
            </div>
          ) : null}

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-white">Roster controls</div>
              <div className="mt-1 text-sm text-slate-400">
                Update salary defaults or pause selected team payments in one operation.
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block text-sm">
                <span className="text-slate-300">Bulk salary amount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={bulkAmount}
                  onChange={(event) => setBulkAmount(event.target.value)}
                  className="mt-1 w-44 rounded-2xl border border-slate-700 bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-300">Bulk status</span>
                <select
                  value={bulkStatus}
                  onChange={(event) => setBulkStatus(event.target.value)}
                  className="mt-1 w-40 rounded-2xl border border-slate-700 bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60"
                >
                  <option value="">No change</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </label>
              <button
                type="button"
                onClick={handleBulkUpdate}
                className="rounded-2xl bg-[#FFB05A] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#ffc27d]"
              >
                Update selected
              </button>
            </div>
          </div>
        </section>

        {loading ? (
          <section className={cardClass}>
            <div className="text-sm text-slate-400">Loading employees and vendors...</div>
          </section>
        ) : (
          <section className={cardClass}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-sm text-slate-400">{payees.length} visible record(s)</div>
              {payees.length ? (
                <button
                  type="button"
                  onClick={() => setSelectedIds(allVisibleSelected ? [] : payees.map((payee) => payee.id))}
                  className="rounded-2xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white"
                >
                  {allVisibleSelected ? 'Clear selection' : 'Select visible'}
                </button>
              ) : null}
            </div>

            {payees.length ? (
              <div className="space-y-4">
                {payees.map((payee) => (
                  <div key={payee.id} className="rounded-3xl border border-slate-800 bg-slate-950/50 p-4">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                      <label className="inline-flex items-center gap-3 text-sm text-slate-200">
                        <input type="checkbox" checked={selectedIds.includes(payee.id)} onChange={() => toggleSelection(payee.id)} />
                        <span className="font-semibold text-white">{payee.name}</span>
                      </label>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 uppercase tracking-[0.16em] text-slate-300">{payee.payee_kind}</span>
                        <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 uppercase tracking-[0.16em] text-slate-300">{payee.status}</span>
                        {payee.employee_code ? (
                          <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 font-mono text-slate-300">{payee.employee_code}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      {[
                        ['account_name', 'Account name'],
                        ['account_number', 'Account number'],
                        ['bank_code', 'Bank code'],
                        ['bank_name', 'Bank name'],
                        ['group_label', 'Group'],
                        ['role_label', 'Role or label'],
                        ['employee_code', 'Employee code'],
                        ['default_amount', 'Default amount'],
                      ].map(([field, label]) => (
                        <label key={`${payee.id}-${field}`} className="block text-sm">
                          <span className="text-slate-300">{label}</span>
                          <input
                            type={field === 'default_amount' ? 'number' : 'text'}
                            min={field === 'default_amount' ? '0' : undefined}
                            step={field === 'default_amount' ? '0.01' : undefined}
                            value={payee[field] || ''}
                            onChange={(event) => handleFieldChange(payee.id, field, event.target.value)}
                            className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60"
                          />
                        </label>
                      ))}
                      <label className="block text-sm">
                        <span className="text-slate-300">Type</span>
                        <select
                          value={payee.payee_kind || 'vendor'}
                          onChange={(event) => handleFieldChange(payee.id, 'payee_kind', event.target.value)}
                          className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60"
                        >
                          <option value="vendor">Vendor</option>
                          <option value="employee">Employee</option>
                        </select>
                      </label>
                      <label className="block text-sm">
                        <span className="text-slate-300">Payroll status</span>
                        <select
                          value={payee.status === 'archived' ? 'paused' : payee.roster_status || 'active'}
                          onChange={(event) => handleFieldChange(payee.id, 'roster_status', event.target.value)}
                          className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60"
                          disabled={payee.status === 'archived'}
                        >
                          <option value="active">Active</option>
                          <option value="paused">Paused</option>
                        </select>
                      </label>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                      <span>
                        {payee.last_paid_at ? `Last paid ${new Date(payee.last_paid_at).toLocaleString()} • ` : ''}
                        {payee.default_amount ? `Default pay ${formatNgn(payee.default_amount)}` : 'No default pay set'}
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleSave(payee)}
                          disabled={savingId === payee.id || payee.status === 'archived'}
                          className="rounded-2xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white disabled:opacity-60"
                        >
                          {savingId === payee.id ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleArchive(payee.id)}
                          disabled={savingId === payee.id || payee.status === 'archived'}
                          className="rounded-2xl border border-rose-600/40 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-100 disabled:opacity-60"
                        >
                          Archive
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4 text-sm text-slate-400">
                No roster records match the current filters. Employees and vendors appear here automatically as payroll or team payments are prepared.
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

export default BusinessPayees

