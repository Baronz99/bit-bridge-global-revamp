import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import BusinessWorkspaceNav from '../../components/business/BusinessWorkspaceNav'
import useSelectedBusiness from '../../hooks/useSelectedBusiness'
import BusinessWorkspaceRequired from '../../components/business/BusinessWorkspaceRequired'
import {
  createBusinessMembership,
  deleteBusinessMembership,
  getBusinessEntity,
  getBusinessApprovalSummary,
  getBusinessMemberships,
  updateBusinessMembership,
} from '../../api/business'

const cardClass =
  'rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.22)]'

const roleTone = (role) => {
  const normalized = String(role || '').toLowerCase()
  if (normalized === 'owner') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
  if (normalized === 'admin') return 'border-[#FFB05A]/40 bg-[rgba(255,176,90,0.12)] text-[#FFD2A0]'
  if (normalized === 'approver') return 'border-blue-500/30 bg-blue-500/10 text-blue-200'
  return 'border-slate-700 bg-slate-950/45 text-slate-300'
}

const formatDate = (value) => {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return date.toLocaleString()
}

const BusinessTeam = () => {
  const { ownerMode, selectedBusiness } = useSelectedBusiness()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [approvalSummary, setApprovalSummary] = useState(null)
  const [businessEntity, setBusinessEntity] = useState(null)
  const [memberships, setMemberships] = useState([])
  const [currentUserRole, setCurrentUserRole] = useState(null)
  const [editingMembershipId, setEditingMembershipId] = useState(null)
  const [editingRole, setEditingRole] = useState('viewer')
  const [removingMembershipId, setRemovingMembershipId] = useState(null)
  const [formData, setFormData] = useState({
    email: '',
    role: 'approver',
  })

  useEffect(() => {
    let active = true

    const loadTeam = async () => {
      if (!selectedBusiness?.id) {
        setLoading(false)
        return
      }

      setLoading(true)
      setErrorMessage('')
      try {
        const [membersRes, summaryRes, entityRes] = await Promise.all([
          getBusinessMemberships(selectedBusiness.id),
          getBusinessApprovalSummary(selectedBusiness.id).catch(() => null),
          getBusinessEntity(selectedBusiness.id).catch(() => null),
        ])

        if (!active) return
        const data = membersRes?.data?.data || {}
        setMemberships(Array.isArray(data.memberships) ? data.memberships : [])
        setCurrentUserRole(data.current_user_role || null)
        setApprovalSummary(summaryRes?.data?.data || null)
        setBusinessEntity(entityRes?.data?.data || null)
      } catch (error) {
        if (!active) return
        setErrorMessage(error?.response?.data?.message || 'Unable to load the business team right now.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadTeam()
    return () => {
      active = false
    }
  }, [selectedBusiness?.id])

  const canManageTeam = ['owner', 'admin'].includes(String(currentUserRole || '').toLowerCase())
  const activePolicy = Array.isArray(businessEntity?.active_approval_policies)
    ? businessEntity.active_approval_policies.find((policy) => policy.active) || businessEntity.active_approval_policies[0] || null
    : null

  const roleBuckets = useMemo(() => {
    return memberships.reduce(
      (accumulator, membership) => {
        const role = String(membership.role || 'viewer').toLowerCase()
        accumulator[role] = (accumulator[role] || 0) + 1
        return accumulator
      },
      {}
    )
  }, [memberships])

  const uncoveredPolicyRoles = useMemo(() => {
    if (!activePolicy) return []
    return (activePolicy.required_roles || []).filter((role) => (roleBuckets[String(role).toLowerCase()] || 0) === 0)
  }, [activePolicy, roleBuckets])

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!selectedBusiness?.id) return

    const email = String(formData.email || '').trim()
    if (!email) {
      toast.error('Team member email is required.')
      return
    }

    setSubmitting(true)
    setErrorMessage('')
    try {
      const response = await createBusinessMembership(selectedBusiness.id, {
        membership: {
          email,
          role: formData.role,
        },
      })
      const data = response?.data?.data || {}
      setMemberships(Array.isArray(data.memberships) ? data.memberships : memberships)
      setFormData({ email: '', role: 'approver' })
      toast.success('Team member added.')
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to add the team member.'
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleStartEdit = (membership) => {
    setEditingMembershipId(membership.id)
    setEditingRole(membership.role || 'viewer')
  }

  const handleCancelEdit = () => {
    setEditingMembershipId(null)
    setEditingRole('viewer')
  }

  const handleRoleUpdate = async (membership) => {
    if (!selectedBusiness?.id) return

    setSubmitting(true)
    setErrorMessage('')
    try {
      const response = await updateBusinessMembership(selectedBusiness.id, membership.id, {
        membership: {
          role: editingRole,
        },
      })
      const data = response?.data?.data || {}
      setMemberships(Array.isArray(data.memberships) ? data.memberships : memberships)
      toast.success('Team role updated.')
      handleCancelEdit()
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to update the team role.'
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemoveMembership = async (membership) => {
    if (!selectedBusiness?.id) return
    const confirmed = window.confirm(`Remove ${membership.email || 'this member'} from ${selectedBusiness.name}?`)
    if (!confirmed) return

    setRemovingMembershipId(membership.id)
    setErrorMessage('')
    try {
      const response = await deleteBusinessMembership(selectedBusiness.id, membership.id)
      const data = response?.data?.data || {}
      setMemberships(Array.isArray(data.memberships) ? data.memberships : memberships.filter((item) => item.id !== membership.id))
      if (editingMembershipId === membership.id) handleCancelEdit()
      toast.success('Team member removed.')
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to remove the team member.'
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setRemovingMembershipId(null)
    }
  }

  if (ownerMode !== 'business') return <Navigate to="/dashboard/home" replace />

  if (!selectedBusiness) {
    return <BusinessWorkspaceRequired message="Select a business workspace from the switcher or return to the setup hub to manage the team." />
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-[28px] border border-[#FF7A18] bg-[linear-gradient(135deg,rgba(255,138,42,0.16),rgba(255,176,90,0.08)_40%,rgba(15,23,42,0.94)_100%)] p-5 md:p-7 shadow-[0_24px_60px_rgba(255,122,24,0.16)]">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#FFB05A]">Business Team</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white md:text-3xl">{selectedBusiness.name}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Manage the people who can review approvals, operate controls, and access this company account context.
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
              to="/dashboard/business/approvals"
              className="rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white"
            >
              Open approvals
            </Link>
          }
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]">
          <section className={cardClass}>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Current members</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Owners and admins can assign team roles for approvals and financial control visibility.
                </p>
              </div>
            </div>

            {errorMessage ? (
              <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
                {errorMessage}
              </div>
            ) : null}

            {loading ? (
              <div className="text-sm text-slate-400">Loading team members...</div>
            ) : memberships.length ? (
              <div className="space-y-3">
                {memberships.map((membership) => (
                  <div key={membership.id} className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white">{membership.email || 'Unknown member'}</div>
                        <div className="mt-1 text-xs text-slate-500">Added {formatDate(membership.created_at)}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {editingMembershipId === membership.id && canManageTeam && membership.role !== 'owner' ? (
                          <>
                            <select
                              value={editingRole}
                              onChange={(event) => setEditingRole(event.target.value)}
                              className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[#FFB05A]/60"
                            >
                              <option value="admin">Admin</option>
                              <option value="finance_manager">Finance manager</option>
                              <option value="approver">Approver</option>
                              <option value="viewer">Viewer</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => handleRoleUpdate(membership)}
                              disabled={submitting}
                              className="rounded-xl border border-emerald-500/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300 hover:border-slate-500 hover:text-white"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${roleTone(membership.role)}`}>
                              {membership.role}
                            </span>
                            {canManageTeam && membership.role !== 'owner' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(membership)}
                                  className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300 hover:border-slate-500 hover:text-white"
                                >
                                  Edit role
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMembership(membership)}
                                  disabled={removingMembershipId === membership.id}
                                  className="rounded-xl border border-rose-500/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-rose-200 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {removingMembershipId === membership.id ? 'Removing...' : 'Remove'}
                                </button>
                              </>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-5 text-sm text-slate-400">
                No team members have been added beyond the creator yet.
              </div>
            )}
          </section>

          <div className="flex flex-col gap-6">
            <section className={cardClass}>
              <h2 className="text-lg font-semibold text-white">Role coverage</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {['owner', 'admin', 'finance_manager', 'approver', 'viewer'].map((role) => (
                  <div key={role} className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4">
                    <div className="text-sm font-semibold text-white">{role.replace('_', ' ')}</div>
                    <div className="mt-2 text-2xl font-semibold text-[#FFD2A0]">{roleBuckets[role] || 0}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className={cardClass}>
              <h2 className="text-lg font-semibold text-white">Policy coverage</h2>
              <p className="mt-2 text-sm text-slate-400">
                Active transfer policies depend on the right business roles being present on the team.
              </p>

              {!activePolicy ? (
                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4 text-sm text-slate-400">
                  No active approval policy has been configured for this business yet.
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold capitalize text-white">{activePolicy.policy_type}</span>
                      <span
                        className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${
                          String(activePolicy.mode).toLowerCase() === 'enforce'
                            ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                            : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                        }`}
                      >
                        {activePolicy.mode}
                      </span>
                    </div>
                    <div className="mt-3 text-sm text-slate-300">
                      Threshold:{' '}
                      <span className="font-semibold text-white">
                        NGN {Number(activePolicy.threshold_amount || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(activePolicy.required_roles || []).map((role) => (
                        <span key={role} className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${roleTone(role)}`}>
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>

                  {uncoveredPolicyRoles.length ? (
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
                      Missing required role coverage for: {uncoveredPolicyRoles.join(', ')}.
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-100">
                      Current team roles cover the active policy requirements.
                    </div>
                  )}

                  <Link
                    to="/dashboard/business/policies"
                    className="inline-flex rounded-2xl border border-slate-700 bg-slate-950/45 px-4 py-3 text-sm font-medium text-slate-100 hover:border-slate-500 hover:bg-slate-950/65 transition"
                  >
                    Review approval policy
                  </Link>
                </div>
              )}
            </section>

            <section className={cardClass}>
              <h2 className="text-lg font-semibold text-white">Add team member</h2>
              <p className="mt-2 text-sm text-slate-400">
                Add existing BitBridge users to this business by email and assign their role.
              </p>

              {!canManageTeam ? (
                <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
                  Only owner and admin roles can add business team members in this phase.
                </div>
              ) : (
                <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">User email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60"
                      placeholder="teammate@company.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300">Role</label>
                    <select
                      name="role"
                      value={formData.role}
                      onChange={handleChange}
                      className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60"
                    >
                      <option value="admin">Admin</option>
                      <option value="finance_manager">Finance manager</option>
                      <option value="approver">Approver</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-2xl bg-[#FFB05A] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#ffc27d] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? 'Adding member...' : 'Add member'}
                  </button>
                </form>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BusinessTeam

