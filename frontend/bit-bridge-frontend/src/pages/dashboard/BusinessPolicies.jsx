import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import BusinessWorkspaceNav from '../../components/business/BusinessWorkspaceNav'
import useSelectedBusiness from '../../hooks/useSelectedBusiness'
import BusinessWorkspaceRequired from '../../components/business/BusinessWorkspaceRequired'
import {
  createBusinessApprovalPolicy,
  disableBusinessApprovalPolicy,
  getBusinessApprovalPolicies,
  getBusinessApprovalSummary,
  getBusinessMemberships,
  updateBusinessApprovalPolicy,
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

const modeTone = (mode) =>
  String(mode || '').toLowerCase() === 'enforce'
    ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
    : 'border-amber-500/30 bg-amber-500/10 text-amber-200'

const formatNgn = (value = 0) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

const initialForm = {
  policy_type: 'transfer',
  threshold_amount: '',
  mode: 'monitor',
  active: true,
  required_roles: ['admin', 'approver'],
}

const BusinessPolicies = () => {
  const { ownerMode, selectedBusiness } = useSelectedBusiness()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [approvalSummary, setApprovalSummary] = useState(null)
  const [policies, setPolicies] = useState([])
  const [memberships, setMemberships] = useState([])
  const [currentUserRole, setCurrentUserRole] = useState(null)
  const [editingPolicyId, setEditingPolicyId] = useState(null)
  const [formData, setFormData] = useState(initialForm)

  useEffect(() => {
    let active = true

    const loadPolicies = async () => {
      if (!selectedBusiness?.id) {
        setLoading(false)
        return
      }

      setLoading(true)
      setErrorMessage('')
      try {
        const [policiesRes, membersRes, summaryRes] = await Promise.all([
          getBusinessApprovalPolicies(selectedBusiness.id),
          getBusinessMemberships(selectedBusiness.id).catch(() => null),
          getBusinessApprovalSummary(selectedBusiness.id).catch(() => null),
        ])

        if (!active) return
        setPolicies(Array.isArray(policiesRes?.data?.data) ? policiesRes.data.data : [])
        setMemberships(Array.isArray(membersRes?.data?.data?.memberships) ? membersRes.data.data.memberships : [])
        setCurrentUserRole(membersRes?.data?.data?.current_user_role || null)
        setApprovalSummary(summaryRes?.data?.data || null)
      } catch (error) {
        if (!active) return
        setErrorMessage(error?.response?.data?.message || 'Unable to load approval policies right now.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadPolicies()
    return () => {
      active = false
    }
  }, [selectedBusiness?.id])

  const canManagePolicies = ['owner', 'admin'].includes(String(currentUserRole || '').toLowerCase())

  const roleBuckets = useMemo(() => {
    return memberships.reduce((accumulator, membership) => {
      const role = String(membership.role || 'viewer').toLowerCase()
      accumulator[role] = (accumulator[role] || 0) + 1
      return accumulator
    }, {})
  }, [memberships])

  const unmetRoles = useMemo(() => {
    const activePolicy = policies.find((policy) => policy.active)
    if (!activePolicy) return []

    return (activePolicy.required_roles || []).filter((role) => (roleBuckets[role] || 0) === 0)
  }, [policies, roleBuckets])

  const resetForm = () => {
    setEditingPolicyId(null)
    setFormData(initialForm)
  }

  const handleFieldChange = (event) => {
    const { name, value, type, checked } = event.target
    setFormData((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const toggleRole = (role) => {
    setFormData((current) => {
      const exists = current.required_roles.includes(role)
      return {
        ...current,
        required_roles: exists
          ? current.required_roles.filter((item) => item !== role)
          : [...current.required_roles, role],
      }
    })
  }

  const handleEdit = (policy) => {
    setEditingPolicyId(policy.id)
    setFormData({
      policy_type: policy.policy_type || 'transfer',
      threshold_amount: String(policy.threshold_amount || ''),
      mode: policy.mode || 'monitor',
      active: Boolean(policy.active),
      required_roles: Array.isArray(policy.required_roles) ? policy.required_roles : [],
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!selectedBusiness?.id) return
    if (!formData.required_roles.length) {
      toast.error('Select at least one required role.')
      return
    }

    setSaving(true)
    setErrorMessage('')
    try {
      const payload = {
        approval_policy: {
          policy_type: formData.policy_type,
          threshold_amount: Number(formData.threshold_amount || 0),
          required_roles: formData.required_roles,
          mode: formData.mode,
          active: formData.active,
        },
      }

      const response = editingPolicyId
        ? await updateBusinessApprovalPolicy(selectedBusiness.id, editingPolicyId, payload)
        : await createBusinessApprovalPolicy(selectedBusiness.id, payload)

      const saved = response?.data?.data
      setPolicies((current) => {
        const withoutCurrent = current.filter((policy) => policy.id !== saved?.id)
        return saved ? [saved, ...withoutCurrent].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)) : current
      })
      toast.success(editingPolicyId ? 'Approval policy updated.' : 'Approval policy created.')
      resetForm()
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to save the approval policy.'
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDisable = async (policyId) => {
    if (!selectedBusiness?.id) return

    setSaving(true)
    setErrorMessage('')
    try {
      const response = await disableBusinessApprovalPolicy(selectedBusiness.id, policyId)
      const saved = response?.data?.data
      setPolicies((current) => current.map((policy) => (policy.id === saved?.id ? saved : policy)))
      toast.success('Approval policy disabled.')
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to disable the approval policy.'
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  if (ownerMode !== 'business') return <Navigate to="/dashboard/home" replace />

  if (!selectedBusiness) {
    return <BusinessWorkspaceRequired message="Select a business workspace from the switcher or return to the setup hub to manage approval policies." />
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-[28px] border border-[#FF7A18] bg-[linear-gradient(135deg,rgba(255,138,42,0.16),rgba(255,176,90,0.08)_40%,rgba(15,23,42,0.94)_100%)] p-5 md:p-7 shadow-[0_24px_60px_rgba(255,122,24,0.16)]">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#FFB05A]">Approval Policies</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white md:text-3xl">{selectedBusiness.name}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Configure when transfers are monitored, when they are blocked for review, and which team roles must act.
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
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-white">Configured policies</h2>
              <p className="mt-2 text-sm text-slate-400">
                One active policy per action type is enforced by the backend. This screen manages the transfer policy surface.
              </p>
            </div>

            {errorMessage ? (
              <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
                {errorMessage}
              </div>
            ) : null}

            {loading ? (
              <div className="text-sm text-slate-400">Loading approval policies...</div>
            ) : policies.length ? (
              <div className="space-y-3">
                {policies.map((policy) => (
                  <div key={policy.id} className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-white capitalize">{policy.policy_type}</div>
                          {policy.active ? (
                            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-emerald-200">
                              Active
                            </span>
                          ) : (
                            <span className="rounded-full border border-slate-700 bg-slate-950/45 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300">
                              Disabled
                            </span>
                          )}
                          <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${modeTone(policy.mode)}`}>
                            {policy.mode}
                          </span>
                        </div>
                        <div className="mt-3 text-sm text-slate-300">
                          Threshold: <span className="font-semibold text-white">{formatNgn(policy.threshold_amount)}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(policy.required_roles || []).map((role) => (
                            <span key={role} className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${roleTone(role)}`}>
                              {role}
                            </span>
                          ))}
                        </div>
                      </div>
                      {canManagePolicies ? (
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => handleEdit(policy)}
                            className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white"
                          >
                            Edit
                          </button>
                          {policy.active ? (
                            <button
                              type="button"
                              onClick={() => handleDisable(policy.id)}
                              disabled={saving}
                              className="rounded-xl border border-rose-500/30 px-4 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Disable
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-5 text-sm text-slate-400">
                No approval policy has been configured for this business yet.
              </div>
            )}
          </section>

          <div className="flex flex-col gap-6">
            <section className={cardClass}>
              <h2 className="text-lg font-semibold text-white">{editingPolicyId ? 'Edit policy' : 'Create policy'}</h2>
              <p className="mt-2 text-sm text-slate-400">
                Monitor creates approval records without blocking execution. Enforce requires approval before money moves.
              </p>

              {!canManagePolicies ? (
                <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
                  Only owner and admin roles can manage approval policies.
                </div>
              ) : (
                <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">Policy type</label>
                    <select
                      name="policy_type"
                      value={formData.policy_type}
                      onChange={handleFieldChange}
                      className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60"
                    >
                      <option value="transfer">Transfer</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300">Threshold amount</label>
                    <input
                      type="number"
                      name="threshold_amount"
                      value={formData.threshold_amount}
                      onChange={handleFieldChange}
                      className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60"
                      placeholder="25000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300">Mode</label>
                    <select
                      name="mode"
                      value={formData.mode}
                      onChange={handleFieldChange}
                      className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60"
                    >
                      <option value="monitor">Monitor</option>
                      <option value="enforce">Enforce</option>
                    </select>
                  </div>

                  <div>
                    <div className="block text-sm font-medium text-slate-300">Required roles</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {['admin', 'approver', 'finance_manager', 'owner'].map((role) => {
                        const selected = formData.required_roles.includes(role)
                        return (
                          <button
                            key={role}
                            type="button"
                            onClick={() => toggleRole(role)}
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

                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      name="active"
                      checked={formData.active}
                      onChange={handleFieldChange}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-950/60 text-[#FFB05A]"
                    />
                    Keep this policy active
                  </label>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-2xl bg-[#FFB05A] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#ffc27d] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? 'Saving policy...' : editingPolicyId ? 'Update policy' : 'Create policy'}
                    </button>
                    {editingPolicyId ? (
                      <button
                        type="button"
                        onClick={resetForm}
                        className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white"
                      >
                        Cancel edit
                      </button>
                    ) : null}
                  </div>
                </form>
              )}
            </section>

            <section className={cardClass}>
              <h2 className="text-lg font-semibold text-white">Policy-to-team guidance</h2>
              <p className="mt-2 text-sm text-slate-400">
                Enforced policies are only useful if the required roles actually exist on the business team.
              </p>

              {unmetRoles.length ? (
                <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
                  Missing coverage for: {unmetRoles.join(', ')}. Add or update team roles before relying on this policy.
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-100">
                  Current team roles cover the active policy requirements.
                </div>
              )}

              <div className="mt-4 flex flex-col gap-3">
                <Link
                  to="/dashboard/business/team"
                  className="rounded-2xl border border-slate-700 bg-slate-950/45 px-4 py-4 text-sm font-medium text-slate-100 hover:border-slate-500 hover:bg-slate-950/65 transition"
                >
                  Review team roles
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BusinessPolicies

