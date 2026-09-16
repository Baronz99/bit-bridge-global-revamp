import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import BusinessWorkspaceNav from '../../components/business/BusinessWorkspaceNav'
import useSelectedBusiness from '../../hooks/useSelectedBusiness'
import BusinessWorkspaceRequired from '../../components/business/BusinessWorkspaceRequired'
import {
  getBusinessApprovalSummary,
  getBusinessMemberships,
  getBusinessSettings,
  updateBusinessSettings,
} from '../../api/business'

const cardClass =
  'rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.22)]'

const roleTone = (role) => {
  const normalized = String(role || '').toLowerCase()
  if (normalized === 'owner') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
  if (normalized === 'admin') return 'border-[#FFB05A]/40 bg-[rgba(255,176,90,0.12)] text-[#FFD2A0]'
  if (normalized === 'approver') return 'border-blue-500/30 bg-blue-500/10 text-blue-200'
  if (normalized === 'finance_manager') return 'border-violet-500/30 bg-violet-500/10 text-violet-200'
  return 'border-slate-700 bg-slate-950/45 text-slate-300'
}

const transferRoles = ['owner', 'admin', 'finance_manager', 'approver']

const BusinessSettings = () => {
  const { ownerMode, selectedBusiness } = useSelectedBusiness()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [approvalSummary, setApprovalSummary] = useState(null)
  const [memberships, setMemberships] = useState([])
  const [currentUserRole, setCurrentUserRole] = useState(null)
  const [formData, setFormData] = useState({
    initiator_roles: ['owner', 'admin'],
    draft_only_roles: [],
  })

  useEffect(() => {
    let active = true

    const loadSettings = async () => {
      if (!selectedBusiness?.id) {
        setLoading(false)
        return
      }

      setLoading(true)
      setErrorMessage('')
      try {
        const [settingsRes, membersRes, summaryRes] = await Promise.all([
          getBusinessSettings(selectedBusiness.id),
          getBusinessMemberships(selectedBusiness.id).catch(() => null),
          getBusinessApprovalSummary(selectedBusiness.id).catch(() => null),
        ])

        if (!active) return
        const settings = settingsRes?.data?.data?.settings?.transfer_controls || {}
        setFormData({
          initiator_roles: Array.isArray(settings.initiator_roles) ? settings.initiator_roles : ['owner', 'admin'],
          draft_only_roles: Array.isArray(settings.draft_only_roles) ? settings.draft_only_roles : [],
        })
        setMemberships(Array.isArray(membersRes?.data?.data?.memberships) ? membersRes.data.data.memberships : [])
        setCurrentUserRole(membersRes?.data?.data?.current_user_role || null)
        setApprovalSummary(summaryRes?.data?.data || null)
      } catch (error) {
        if (!active) return
        setErrorMessage(error?.response?.data?.message || 'Unable to load business settings right now.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadSettings()
    return () => {
      active = false
    }
  }, [selectedBusiness?.id])

  const canManage = ['owner', 'admin'].includes(String(currentUserRole || '').toLowerCase())

  const roleCoverage = useMemo(() => {
    return memberships.reduce((accumulator, membership) => {
      const role = String(membership.role || '').toLowerCase()
      accumulator[role] = (accumulator[role] || 0) + 1
      return accumulator
    }, {})
  }, [memberships])

  const uncoveredInitiators = useMemo(
    () => formData.initiator_roles.filter((role) => (roleCoverage[role] || 0) === 0),
    [formData.initiator_roles, roleCoverage]
  )

  const uncoveredDraftOnly = useMemo(
    () => formData.draft_only_roles.filter((role) => (roleCoverage[role] || 0) === 0),
    [formData.draft_only_roles, roleCoverage]
  )

  const toggleRole = (field, role) => {
    setFormData((current) => {
      const selected = current[field].includes(role)
      const next = selected ? current[field].filter((item) => item !== role) : [...current[field], role]
      const updated = { ...current, [field]: next }
      if (field === 'initiator_roles') {
        updated.draft_only_roles = updated.draft_only_roles.filter((item) => !next.includes(item))
      }
      if (field === 'draft_only_roles') {
        updated.initiator_roles = updated.initiator_roles.filter((item) => item !== role)
      }
      return updated
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!selectedBusiness?.id) return
    if (!formData.initiator_roles.length) {
      toast.error('Select at least one transfer initiator role.')
      return
    }

    setSaving(true)
    setErrorMessage('')
    try {
      const response = await updateBusinessSettings(selectedBusiness.id, {
        settings: {
          initiator_roles: formData.initiator_roles,
          draft_only_roles: formData.draft_only_roles,
        },
      })
      const settings = response?.data?.data?.settings?.transfer_controls || {}
      setFormData({
        initiator_roles: Array.isArray(settings.initiator_roles) ? settings.initiator_roles : formData.initiator_roles,
        draft_only_roles: Array.isArray(settings.draft_only_roles) ? settings.draft_only_roles : formData.draft_only_roles,
      })
      toast.success('Business transfer controls updated.')
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to update business transfer controls.'
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  if (ownerMode !== 'business') return <Navigate to="/dashboard/home" replace />

  if (!selectedBusiness) {
    return <BusinessWorkspaceRequired message="Select a business workspace from the switcher or return to the setup hub to manage transfer controls." />
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-[28px] border border-[#FF7A18] bg-[linear-gradient(135deg,rgba(255,138,42,0.16),rgba(255,176,90,0.08)_40%,rgba(15,23,42,0.94)_100%)] p-5 md:p-7 shadow-[0_24px_60px_rgba(255,122,24,0.16)]">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#FFB05A]">Business Settings</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white md:text-3xl">{selectedBusiness.name}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Define which business roles can initiate transfers directly and which roles can only draft requests for approval.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-950/45 px-4 py-3 text-sm text-slate-300">
              Current role: <span className="font-semibold text-white">{currentUserRole || 'member'}</span>
            </div>
          </div>
        </section>

        <BusinessWorkspaceNav
          pendingCount={approvalSummary?.total_pending || 0}
          action={
            <Link
              to="/dashboard/business/team"
              className="rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white"
            >
              Review team roles
            </Link>
          }
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]">
          <section className={cardClass}>
            <h2 className="text-lg font-semibold text-white">Transfer role controls</h2>
            <p className="mt-2 text-sm text-slate-400">
              Initiator roles can submit transfers normally. Draft-only roles can only create pending approval requests when an enforced policy applies.
            </p>

            {errorMessage ? (
              <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
                {errorMessage}
              </div>
            ) : null}

            {loading ? (
              <div className="mt-4 text-sm text-slate-400">Loading transfer controls...</div>
            ) : !canManage ? (
              <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
                Only owner and admin roles can update transfer controls.
              </div>
            ) : (
              <form className="mt-4 space-y-6" onSubmit={handleSubmit}>
                <div>
                  <div className="text-sm font-medium text-slate-300">Initiator roles</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {transferRoles.map((role) => {
                      const selected = formData.initiator_roles.includes(role)
                      return (
                        <button
                          key={`initiator-${role}`}
                          type="button"
                          onClick={() => toggleRole('initiator_roles', role)}
                          className={`rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition ${
                            selected
                              ? roleTone(role)
                              : 'border-slate-700 bg-slate-950/45 text-slate-300 hover:border-slate-500 hover:text-white'
                          }`}
                        >
                          {role}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-slate-300">Draft-only roles</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {transferRoles.map((role) => {
                      const selected = formData.draft_only_roles.includes(role)
                      const disabled = formData.initiator_roles.includes(role)
                      return (
                        <button
                          key={`draft-${role}`}
                          type="button"
                          disabled={disabled}
                          onClick={() => toggleRole('draft_only_roles', role)}
                          className={`rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition ${
                            selected
                              ? 'border-violet-500/30 bg-violet-500/10 text-violet-200'
                              : disabled
                              ? 'cursor-not-allowed border-slate-800 bg-slate-950/25 text-slate-600'
                              : 'border-slate-700 bg-slate-950/45 text-slate-300 hover:border-slate-500 hover:text-white'
                          }`}
                        >
                          {role}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-2xl bg-[#FFB05A] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#ffc27d] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? 'Saving controls...' : 'Save transfer controls'}
                </button>
              </form>
            )}
          </section>

          <div className="flex flex-col gap-6">
            <section className={cardClass}>
              <h2 className="text-lg font-semibold text-white">Coverage guidance</h2>
              <p className="mt-2 text-sm text-slate-400">
                These settings only work if the team actually contains the roles you assign.
              </p>

              {uncoveredInitiators.length ? (
                <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
                  Missing initiator role coverage for: {uncoveredInitiators.join(', ')}.
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-100">
                  Current team covers all selected initiator roles.
                </div>
              )}

              {uncoveredDraftOnly.length ? (
                <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
                  Missing draft-only role coverage for: {uncoveredDraftOnly.join(', ')}.
                </div>
              ) : null}

              <div className="mt-4 flex flex-col gap-3">
                <Link
                  to="/dashboard/business/team"
                  className="rounded-2xl border border-slate-700 bg-slate-950/45 px-4 py-4 text-sm font-medium text-slate-100 hover:border-slate-500 hover:bg-slate-950/65 transition"
                >
                  Review team roles
                </Link>
                <Link
                  to="/dashboard/business/policies"
                  className="rounded-2xl border border-slate-700 bg-slate-950/45 px-4 py-4 text-sm font-medium text-slate-100 hover:border-slate-500 hover:bg-slate-950/65 transition"
                >
                  Review approval policies
                </Link>
              </div>
            </section>

            <section className={cardClass}>
              <h2 className="text-lg font-semibold text-white">Current controls snapshot</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Initiator roles</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {formData.initiator_roles.map((role) => (
                      <span key={role} className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${roleTone(role)}`}>
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Draft-only roles</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {formData.draft_only_roles.length ? (
                      formData.draft_only_roles.map((role) => (
                        <span key={role} className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-violet-200">
                          {role}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">No draft-only roles configured.</span>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BusinessSettings

