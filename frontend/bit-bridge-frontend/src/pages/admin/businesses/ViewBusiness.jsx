import { useEffect, useMemo, useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import {
  getAdminBusinessAccount,
  getAdminBusinessApprovalPolicies,
  getAdminBusinessApprovalRequests,
  getAdminBusinessEntity,
  getAdminBusinessKyb,
  getAdminBusinessMemberships,
  getAdminBusinessTransactions,
  getAdminBusinessWallet,
} from '../../../api/adminBusiness'
import dateFormater from '../../../utils/dateFormat'
import nairaFormat from '../../../utils/nairaFormat'
import Loading from '../../../components/loader/Loading'

const formatAmount = (amount, currency = 'NGN') => {
  const value = Number(amount || 0)
  if (Number.isNaN(value)) return '--'
  if (String(currency).toUpperCase() === 'NGN') return nairaFormat(value, 'ngn')
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: String(currency).toUpperCase(),
    minimumFractionDigits: 2,
  }).format(value)
}

const Section = ({ eyebrow, title, aside, children }) => (
  <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-sm">
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
      <div>
        <p className="text-[11px] tracking-[0.2em] uppercase text-slate-500">{eyebrow}</p>
        <h2 className="text-lg font-semibold text-slate-100 mt-1">{title}</h2>
      </div>
      {aside ? <div className="text-sm text-slate-400">{aside}</div> : null}
    </div>
    {children}
  </div>
)

const InfoGrid = ({ items }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
    {items.map((item) => (
      <div key={item.label} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">{item.label}</p>
        <p className="text-sm text-slate-100 mt-2 break-words">{item.value}</p>
      </div>
    ))}
  </div>
)

const ViewBusiness = () => {
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [entity, setEntity] = useState(null)
  const [wallet, setWallet] = useState(null)
  const [account, setAccount] = useState(null)
  const [kyb, setKyb] = useState(null)
  const [memberships, setMemberships] = useState([])
  const [approvalRequests, setApprovalRequests] = useState([])
  const [approvalPolicies, setApprovalPolicies] = useState([])
  const [transactions, setTransactions] = useState([])

  useEffect(() => {
    let active = true

    const loadBusiness = async () => {
      try {
        setLoading(true)
        setError('')

        const [
          entityResponse,
          walletResponse,
          accountResponse,
          kybResponse,
          membershipsResponse,
          approvalRequestsResponse,
          approvalPoliciesResponse,
          transactionsResponse,
        ] = await Promise.all([
          getAdminBusinessEntity(id),
          getAdminBusinessWallet(id),
          getAdminBusinessAccount(id),
          getAdminBusinessKyb(id),
          getAdminBusinessMemberships(id),
          getAdminBusinessApprovalRequests(id),
          getAdminBusinessApprovalPolicies(id),
          getAdminBusinessTransactions(id, { limit: 20 }),
        ])

        if (!active) return

        setEntity(entityResponse?.data || null)
        setWallet(walletResponse?.data || null)
        setAccount(accountResponse?.data || null)
        setKyb(kybResponse?.data || null)
        setMemberships(Array.isArray(membershipsResponse?.data) ? membershipsResponse.data : [])
        setApprovalRequests(Array.isArray(approvalRequestsResponse?.data) ? approvalRequestsResponse.data : [])
        setApprovalPolicies(Array.isArray(approvalPoliciesResponse?.data) ? approvalPoliciesResponse.data : [])
        setTransactions(Array.isArray(transactionsResponse?.data) ? transactionsResponse.data : [])
      } catch (err) {
        if (!active) return
        setError(err?.response?.data?.message || 'Unable to load business entity details.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadBusiness()

    return () => {
      active = false
    }
  }, [id])

  const overviewItems = useMemo(
    () => [
      { label: 'Business name', value: entity?.name || 'Not available' },
      { label: 'Business ID', value: entity?.id || id },
      { label: 'Status', value: entity?.status || 'unknown' },
      { label: 'Creator', value: entity?.creator?.email || 'Not available' },
      { label: 'Creator role', value: entity?.creator_membership_role || 'owner' },
      { label: 'Created', value: dateFormater(entity?.created_at) },
    ],
    [entity, id]
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
        <Loading />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 overflow-y-auto">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Admin business</p>
          <h1 className="text-2xl font-semibold mt-1">{entity?.name || 'Business entity'}</h1>
          <p className="text-slate-400 mt-1">
            Separate legal-entity view for KYB, accounts, team access, approvals, and business money flows.
          </p>
        </div>
        <NavLink
          to="/admin/businesses"
          className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 transition-colors"
        >
          Back to businesses
        </NavLink>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-950/30 text-rose-200 px-4 py-3 mb-6">
          {error}
        </div>
      ) : null}

      <div className="space-y-6">
        <Section eyebrow="Overview" title="Business identity" aside={entity?.status ? `Status: ${entity.status}` : null}>
          <InfoGrid items={overviewItems} />
        </Section>

        <Section eyebrow="Compliance" title="KYB and provider state" aside={kyb?.status ? `KYB: ${kyb.status}` : null}>
          <InfoGrid
            items={[
              { label: 'KYB status', value: kyb?.status || entity?.kyb?.status || 'not_started' },
              { label: 'Provider status', value: kyb?.provider_status || 'Not available' },
              { label: 'Provider reference', value: kyb?.provider_reference || 'Not available' },
              { label: 'Review note', value: kyb?.review_note || 'Not available' },
              { label: 'Submitted', value: kyb?.submitted_at ? dateFormater(kyb.submitted_at) : 'Not submitted' },
              { label: 'Last sync', value: kyb?.synced_at ? dateFormater(kyb.synced_at) : 'Not synced' },
            ]}
          />
        </Section>

        <Section eyebrow="Money" title="Wallet and account" aside={wallet?.currency || account?.currency || null}>
          <InfoGrid
            items={[
              { label: 'Wallet balance', value: formatAmount(wallet?.balance || wallet?.wallet_balance, wallet?.currency) },
              { label: 'Available balance', value: formatAmount(wallet?.available_balance, wallet?.currency) },
              { label: 'Wallet ID', value: wallet?.id || 'Not available' },
              { label: 'Account number', value: account?.account_number || account?.masked_account_number || 'Not available' },
              { label: 'Bank', value: account?.bank_name || account?.bank || 'Not available' },
              { label: 'Account status', value: account?.status || 'Not available' },
            ]}
          />
        </Section>

        <Section eyebrow="Team" title="Memberships" aside={`${memberships.length} member(s)`}>
          {memberships.length === 0 ? (
            <p className="text-sm text-slate-400">No memberships found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-800">
                    <th className="py-2 px-3">User</th>
                    <th className="py-2 px-3">Role</th>
                    <th className="py-2 px-3 hidden md:table-cell">Status</th>
                    <th className="py-2 px-3 hidden md:table-cell">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {memberships.map((membership) => (
                    <tr key={membership?.id || `${membership?.user_id}-${membership?.role}`} className="border-b border-slate-800">
                      <td className="py-2 px-3">
                        <p className="text-slate-200">{membership?.email || membership?.user_email || 'Unknown user'}</p>
                        {membership?.user_id ? (
                          <NavLink to={`/admin/users/${membership.user_id}`} className="text-xs text-sky-400 hover:text-sky-300">
                            Open user
                          </NavLink>
                        ) : null}
                      </td>
                      <td className="py-2 px-3 capitalize text-slate-300">{membership?.role || 'member'}</td>
                      <td className="py-2 px-3 hidden md:table-cell text-slate-300 capitalize">{membership?.status || 'active'}</td>
                      <td className="py-2 px-3 hidden md:table-cell text-slate-300">{dateFormater(membership?.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section eyebrow="Controls" title="Approval policies" aside={`${approvalPolicies.length} policy item(s)`}>
          {approvalPolicies.length === 0 ? (
            <p className="text-sm text-slate-400">No approval policies configured.</p>
          ) : (
            <InfoGrid
              items={approvalPolicies.map((policy, index) => ({
                label: policy?.rule_name || policy?.name || `Policy ${index + 1}`,
                value: [
                  policy?.action_type ? `Action: ${policy.action_type}` : null,
                  policy?.min_approvals ? `Min approvals: ${policy.min_approvals}` : null,
                  policy?.status ? `Status: ${policy.status}` : null,
                ]
                  .filter(Boolean)
                  .join(' | '),
              }))}
            />
          )}
        </Section>

        <Section eyebrow="Approvals" title="Approval requests" aside={`${approvalRequests.length} request(s)`}>
          {approvalRequests.length === 0 ? (
            <p className="text-sm text-slate-400">No approval requests found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-800">
                    <th className="py-2 px-3">Reference</th>
                    <th className="py-2 px-3">Action</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 hidden md:table-cell">Requested</th>
                  </tr>
                </thead>
                <tbody>
                  {approvalRequests.map((request) => (
                    <tr key={request?.id || request?.reference} className="border-b border-slate-800">
                      <td className="py-2 px-3 text-slate-200">{request?.reference || request?.id}</td>
                      <td className="py-2 px-3 text-slate-300 capitalize">{request?.action_type || request?.request_type || 'approval'}</td>
                      <td className="py-2 px-3 text-slate-300 capitalize">{request?.status || 'pending'}</td>
                      <td className="py-2 px-3 hidden md:table-cell text-slate-300">{dateFormater(request?.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section eyebrow="Ledger" title="Business transactions" aside={`${transactions.length} transaction(s)`}>
          {transactions.length === 0 ? (
            <p className="text-sm text-slate-400">No business transactions found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-800">
                    <th className="py-2 px-3">Reference</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Amount</th>
                    <th className="py-2 px-3 hidden md:table-cell">Status</th>
                    <th className="py-2 px-3 hidden md:table-cell">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction?.id || transaction?.reference} className="border-b border-slate-800">
                      <td className="py-2 px-3 text-slate-200">{transaction?.reference || transaction?.id}</td>
                      <td className="py-2 px-3 text-slate-300 capitalize">{transaction?.transaction_type || transaction?.kind || 'transaction'}</td>
                      <td className="py-2 px-3 text-slate-300">{formatAmount(transaction?.amount, transaction?.currency)}</td>
                      <td className="py-2 px-3 hidden md:table-cell text-slate-300 capitalize">{transaction?.status || 'unknown'}</td>
                      <td className="py-2 px-3 hidden md:table-cell text-slate-300">{dateFormater(transaction?.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}

export default ViewBusiness
