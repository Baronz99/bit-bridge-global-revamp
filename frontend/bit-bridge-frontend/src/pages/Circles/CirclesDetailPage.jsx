// src/pages/Circles/CirclesDetailPage.jsx

import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import ClassicBtn from '../../components/button/ClassicButton'
import { API_BASE_URL } from '../../api/config'
import DisputeModal from '../../components/DisputeModal'


const API_BASE = (API_BASE_URL || '').replace(/\/$/, '')
const getSessionToken = () => localStorage.getItem('bitglobal') || ''

const formatNaira = (amount) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(amount || 0)

const CirclesDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()

  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const currentUser = useSelector((state) => state.auth.user)
  const isMine = currentUser?.id && tx.user?.id === currentUser.id



  // funding state
  const [fundAmount, setFundAmount] = useState('5000')
  const [fundNote, setFundNote] = useState('')
  const [funding, setFunding] = useState(false)
  const [fundError, setFundError] = useState(null)
  const [fundSuccess, setFundSuccess] = useState(null)

  // withdraw state
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawNote, setWithdrawNote] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawError, setWithdrawError] = useState(null)
  const [withdrawSuccess, setWithdrawSuccess] = useState(null)

  // membership state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState(null)
  const [inviteSuccess, setInviteSuccess] = useState(null)
  const [activeDisputeTx, setActiveDisputeTx] = useState(null)


  // ---------- fetch circle (details + members + activity) ----------
  useEffect(() => {
    const fetchCircle = async () => {
      try {
        setLoading(true)
        setError(null)

        if (!API_BASE) {
          setError('Missing API_BASE_URL. Please check src/api/config.js.')
          return
        }

        const token = getSessionToken()
        if (!token) {
          setError('Your session has expired. Please log in again.')
          return
        }

        const res = await fetch(`${API_BASE}/api/v1/circles/${id}`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        })

        const contentType = res.headers.get('content-type') || ''

        if (!res.ok) {
          if (res.status === 404) {
            setError('This group could not be found.')
            return
          }
          if (res.status === 401) {
            setError('You are not authorised to view this group. Please log in again.')
            return
          }

          const text = await res.text().catch(() => '')
          console.error('[CircleDetail] error:', res.status, text.slice(0, 200))
          throw new Error('Unable to load this group.')
        }

        if (!contentType.includes('application/json')) {
          const text = await res.text().catch(() => '')
          console.error('[CircleDetail] non-JSON response:', text.slice(0, 200))
          throw new Error('Unexpected server response while loading this group.')
        }

        const data = await res.json()
        setGroup(data)
        setMembers(data.members || [])
        setActivity(data.recent_transactions || [])
      } catch (err) {
        console.error('[CircleDetail] fetchCircle error:', err)
        setError(err.message || 'Something went wrong while loading this group.')
      } finally {
        setLoading(false)
      }
    }

    if (id) fetchCircle()
  }, [id])

  const createdLabel = group?.created_at
    ? new Date(group.created_at).toLocaleDateString('en-NG', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : ''

  const balanceNaira = (group?.balance_cents || 0) / 100
  const canWithdraw = Boolean(group?.can_withdraw)

  // ---------- lightweight summary from recent activity (front-end only) ----------
  const recentTotalInNaira =
    activity
      ?.filter((tx) => tx.direction === 'credit' || tx.direction === 'in')
      .reduce((sum, tx) => sum + (tx.amount_cents || 0), 0) / 100 || 0

  const recentTotalOutNaira =
    activity
      ?.filter((tx) => tx.direction === 'debit' || tx.direction === 'out')
      .reduce((sum, tx) => sum + (tx.amount_cents || 0), 0) / 100 || 0

  // ---------- fund mini-wallet ----------
  const handleFund = async (e) => {
    e.preventDefault()
    if (!group) return

    const amountValue = parseFloat(fundAmount.toString().replace(/,/g, ''))
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      setFundError('Enter an amount greater than zero.')
      setFundSuccess(null)
      return
    }

    try {
      setFunding(true)
      setFundError(null)
      setFundSuccess(null)

      const token = getSessionToken()
      if (!token) {
        setFundError('Your session has expired. Please log in again.')
        return
      }

      const res = await fetch(`${API_BASE}/api/v1/circles/${group.id}/fund`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount_cents: Math.round(amountValue * 100),
          note: fundNote,
        }),
      })

      const contentType = res.headers.get('content-type') || ''

      if (!res.ok) {
        if (contentType.includes('application/json')) {
          const body = await res.json().catch(() => null)
          const message = body?.errors?.join(', ') || 'Unable to fund this group.'
          setFundError(message)
        } else {
          const text = await res.text().catch(() => '')
          console.error('[CircleDetail] fund error:', text.slice(0, 200))
          setFundError('Unable to fund this group.')
        }
        return
      }

      const body = contentType.includes('application/json')
        ? await res.json().catch(() => ({}))
        : {}

      const newBalanceCents =
        typeof body.balance_cents === 'number'
          ? body.balance_cents
          : group.balance_cents + Math.round(amountValue * 100)

      const newGroup = { ...group, balance_cents: newBalanceCents }
      setGroup(newGroup)

      setActivity((prev) => [
        {
          id: `local-fund-${Date.now()}`,
          amount_cents: Math.round(amountValue * 100),
          direction: 'credit',
          kind: 'fund',
          description: fundNote || 'Funding from main wallet',
          occurred_at: new Date().toISOString(),
          user: { email: 'You' },
        },
        ...prev,
      ])

      setFundSuccess(`Money added to ${group.name}.`)
      setFundError(null)
    } catch (err) {
      console.error('[CircleDetail] handleFund error:', err)
      setFundError(err.message || 'Unable to fund this group.')
      setFundSuccess(null)
    } finally {
      setFunding(false)
    }
  }

  // ---------- move money OUT of group (withdraw) ----------
  const handleWithdraw = async (e) => {
    e.preventDefault()
    if (!group || !canWithdraw) return

    const amountValue = parseFloat(withdrawAmount.toString().replace(/,/g, ''))
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      setWithdrawError('Enter an amount greater than zero.')
      setWithdrawSuccess(null)
      return
    }

    const maxAvailable = (group.balance_cents || 0) / 100
    if (amountValue > maxAvailable) {
      setWithdrawError('This group does not have enough balance for that payout.')
      setWithdrawSuccess(null)
      return
    }

    try {
      setWithdrawing(true)
      setWithdrawError(null)
      setWithdrawSuccess(null)

      const token = getSessionToken()
      if (!token) {
        setWithdrawError('Your session has expired. Please log in again.')
        return
      }

      const res = await fetch(`${API_BASE}/api/v1/circles/${group.id}/withdraw`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount_cents: Math.round(amountValue * 100),
          note: withdrawNote,
        }),
      })

      const contentType = res.headers.get('content-type') || ''

      if (!res.ok) {
        if (contentType.includes('application/json')) {
          const body = await res.json().catch(() => null)
          const message =
            body?.errors?.join(', ') ||
            'Unable to move money out of this group.'
          setWithdrawError(message)
        } else {
          const text = await res.text().catch(() => '')
          console.error('[CircleDetail] withdraw error:', text.slice(0, 200))
          setWithdrawError('Unable to move money out of this group.')
        }
        return
      }

      const body = contentType.includes('application/json')
        ? await res.json().catch(() => ({}))
        : {}

      const newBalanceCents =
        typeof body.balance_cents === 'number'
          ? body.balance_cents
          : group.balance_cents - Math.round(amountValue * 100)

      const newGroup = { ...group, balance_cents: newBalanceCents }
      setGroup(newGroup)

      setActivity((prev) => [
        {
          id: `local-withdraw-${Date.now()}`,
          amount_cents: Math.round(amountValue * 100),
          direction: 'debit', // or 'out' – matches backend enum
          kind: 'payout',
          description: withdrawNote || 'Payout to main wallet',
          occurred_at: new Date().toISOString(),
          user: { email: 'You' },
        },
        ...prev,
      ])

      setWithdrawSuccess(`Money moved back to your BitBridge wallet.`)
      setWithdrawError(null)
    } catch (err) {
      console.error('[CircleDetail] handleWithdraw error:', err)
      setWithdrawError(err.message || 'Unable to move money out of this group.')
      setWithdrawSuccess(null)
    } finally {
      setWithdrawing(false)
    }
  }

  // ---------- invite member ----------
  const handleInvite = async (e) => {
    e.preventDefault()
    if (!group) return

    const email = inviteEmail.trim()
    if (!email) {
      setInviteError('Enter an email to add.')
      setInviteSuccess(null)
      return
    }

    try {
      setInviting(true)
      setInviteError(null)
      setInviteSuccess(null)

      const token = getSessionToken()
      if (!token) {
        setInviteError('Your session has expired. Please log in again.')
        return
      }

      const res = await fetch(
        `${API_BASE}/api/v1/circles/${group.id}/memberships`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            membership: {
              email,
              role: 'member',
            },
          }),
        }
      )

      const contentType = res.headers.get('content-type') || ''

      if (!res.ok) {
        if (contentType.includes('application/json')) {
          const body = await res.json().catch(() => null)
          const message = (body?.errors || []).join(', ') || 'Unable to add this person.'

          const lower = message.toLowerCase()
          let uiMessage = message

          if (lower.includes('no bitbridge account') || lower.includes('user not found')) {
            uiMessage =
              'No BitBridge account found for this email. Ask them to sign up first, then try again.'
          } else if (lower.includes('already in this group') || lower.includes('already')) {
            uiMessage = 'This person is already in this group.'
          } else if (lower.includes('only the group owner')) {
            uiMessage = 'Only the group owner can add people to this group right now.'
          }

          setInviteError(uiMessage)
        } else {
          const text = await res.text().catch(() => '')
          console.error('[CircleDetail] invite error:', text.slice(0, 200))
          setInviteError('Unable to add this person.')
        }
        setInviteSuccess(null)
        return
      }

      const newMembership = await res.json()

      setMembers((prev) => [...prev, newMembership])
      setInviteEmail('')
      setInviteError(null)
      setInviteSuccess(`Added ${email} to this group.`)
    } catch (err) {
      console.error('[CircleDetail] handleInvite error:', err)
      setInviteError(err.message || 'Unable to add this person.')
      setInviteSuccess(null)
    } finally {
      setInviting(false)
    }
  }

  // ---------- render ----------

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-6 md:py-8">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header / back */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard/shared-groups')}
            className="text-xs text-slate-300 hover:text-white inline-flex items-center gap-1"
          >
            ← Back to shared groups
          </button>

          <span className="text-[11px] text-slate-500">
            Shared group details
          </span>
        </div>

        {/* Main card */}
        <section className="rounded-3xl bg-gradient-to-r from-[#050816] via-slate-950 to-black border border-slate-800/70 px-5 py-5 md:px-7 md:py-7 shadow-[0_18px_60px_rgba(0,0,0,0.6)]">
          {loading ? (
            <p className="text-xs text-slate-400">Loading group…</p>
          ) : error ? (
            <p className="text-xs text-red-400">{error}</p>
          ) : !group ? (
            <p className="text-xs text-slate-400">Group not found.</p>
          ) : (
            <>
              <p className="text-[11px] tracking-[0.26em] uppercase text-sky-300/80 mb-2">
                SHARED GROUP
              </p>

              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
                <div className="space-y-2">
                  <h1 className="text-2xl md:text-3xl font-semibold">
                    {group.name}
                  </h1>
                  <div className="flex flex-wrap gap-2 text-[10px] mt-1">
                    {group.purpose && (
                      <span className="inline-flex items-center rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-[2px] uppercase tracking-[0.16em] text-sky-200">
                        {group.purpose}
                      </span>
                    )}
                    <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-[2px] uppercase tracking-[0.16em] text-emerald-200">
                      Circle mini-wallet
                    </span>
                  </div>
                  {group.description && (
                    <p className="text-sm text-slate-200 max-w-xl mt-2">
                      {group.description}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400 mt-1">
                    Created {createdLabel || 'recently'} • Owner:{' '}
                    <span className="text-slate-200">
                      {group.owner?.email || 'You'}
                    </span>
                  </p>
                  <p className="mt-2 text-[11px] text-slate-400">
                    {members.length + 1} person
                    {members.length + 1 === 1 ? '' : 's'} in this group · shared
                    mini-wallet for bills and goals.
                  </p>

                  {/* ✅ Group summary strip (from recent moves) */}
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    <div className="flex flex-col rounded-2xl bg-slate-900/70 border border-slate-700/80 px-3 py-2 min-w-[130px]">
                      <span className="uppercase tracking-[0.18em] text-slate-500">
                        Money added (recent)
                      </span>
                      <span className="mt-1 font-semibold text-emerald-300">
                        {formatNaira(recentTotalInNaira)}
                      </span>
                    </div>
                    <div className="flex flex-col rounded-2xl bg-slate-900/70 border border-slate-700/80 px-3 py-2 min-w-[130px]">
                      <span className="uppercase tracking-[0.18em] text-slate-500">
                        Money moved out (recent)
                      </span>
                      <span className="mt-1 font-semibold text-rose-300">
                        {formatNaira(recentTotalOutNaira)}
                      </span>
                    </div>
                    <div className="flex flex-col rounded-2xl bg-slate-900/70 border border-slate-700/80 px-3 py-2 min-w-[130px]">
                      <span className="uppercase tracking-[0.18em] text-slate-500">
                        Current balance
                      </span>
                      <span className="mt-1 font-semibold text-sky-300">
                        {formatNaira(balanceNaira)}
                      </span>
                    </div>
                  </div>

                  <p className="mt-1 text-[10px] text-slate-500">
                    Based on the last few moves inside this group. Every member can see
                    this summary.
                  </p>
                </div>

                <div className="flex flex-col items-end gap-3">
                  <div className="text-right">
                    <p className="text-[11px] text-slate-400 mb-1">
                      Group balance
                    </p>
                    <p className="text-xl font-semibold text-emerald-300">
                      {formatNaira(balanceNaira)}
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-400 max-w-[260px] text-right">
                    Every top-up, bill payment and payout connected to this group will
                    show up in the live activity timeline so everyone stays in the loop.
                  </p>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Funding + activity */}
        <div className="grid md:grid-cols-3 gap-4 items-start">
          {/* LEFT – funding + (maybe) withdraw forms */}
          <section className="md:col-span-2 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-5">
            {/* Add money */}
            <div>
              <h2 className="text-sm font-semibold mb-1">Add money from your wallet</h2>
              <p className="text-[11px] text-slate-400 mb-3">
                Move money from your BitBridge wallet into this shared mini-wallet. It&apos;s
                an internal transfer, so funds move instantly.
              </p>

              <form onSubmit={handleFund} className="space-y-3">
                <div className="grid md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-4">
                    <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-1">
                      Amount
                    </label>
                    <div className="flex rounded-lg border border-slate-700 bg-slate-950/70 overflow-hidden">
                      <span className="px-3 py-2 text-xs text-slate-300 border-r border-slate-700">
                        ₦
                      </span>
                      <input
                        value={fundAmount}
                        onChange={(e) => setFundAmount(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm bg-transparent text-slate-100 outline-none"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-5">
                    <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-1">
                      Note (optional)
                    </label>
                    <input
                      value={fundNote}
                      onChange={(e) => setFundNote(e.target.value)}
                      placeholder="Eg. December PHCN, rent top-up…"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
                    />
                  </div>

                  <div className="md:col-span-3 flex items-end">
                    <ClassicBtn
                      htmlType="submit"
                      className="w-full h-10 text-sm"
                      disabled={funding}
                    >
                      {funding ? 'Adding…' : 'Add money to group'}
                    </ClassicBtn>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500">
                  We&apos;ll debit your main BitBridge wallet and credit this group
                  instantly. The movement will appear in your main transaction history and
                  in this group&apos;s timeline.
                </p>

                {fundError && (
                  <p className="text-[11px] text-red-400">
                    {fundError}
                  </p>
                )}
                {fundSuccess && (
                  <p className="text-[11px] text-emerald-400">
                    {fundSuccess}
                  </p>
                )}
              </form>
            </div>

            {/* Divider + withdraw area */}
            <div className="border-t border-slate-800/80 pt-4">
              {canWithdraw ? (
                <>
                  <h2 className="text-sm font-semibold mb-1">
                    Move money back to your wallet
                  </h2>
                  <p className="text-[11px] text-slate-400 mb-3">
                    Send money out of this shared mini-wallet into your personal BitBridge
                    wallet. Great for refunds after a bill is paid.
                  </p>

                  <form onSubmit={handleWithdraw} className="space-y-3">
                    <div className="grid md:grid-cols-12 gap-3 items-center">
                      <div className="md:col-span-4">
                        <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-1">
                          Amount
                        </label>
                        <div className="flex rounded-lg border border-slate-700 bg-slate-950/70 overflow-hidden">
                          <span className="px-3 py-2 text-xs text-slate-300 border-r border-slate-700">
                            ₦
                          </span>
                          <input
                            value={withdrawAmount}
                            onChange={(e) => setWithdrawAmount(e.target.value)}
                            placeholder="0.00"
                            className="flex-1 px-3 py-2 text-sm bg-transparent text-slate-100 outline-none"
                          />
                        </div>
                        <p className="mt-1 text-[10px] text-slate-500">
                          Max available: {formatNaira(balanceNaira)}
                        </p>
                      </div>

                      <div className="md:col-span-5">
                        <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-1">
                          Note (optional)
                        </label>
                        <input
                          value={withdrawNote}
                          onChange={(e) => setWithdrawNote(e.target.value)}
                          placeholder="Eg. Refund after PHCN bill…"
                          className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
                        />
                      </div>

                      <div className="md:col-span-3 flex items-end">
                        <ClassicBtn
                          htmlType="submit"
                          className="w-full h-10 text-sm !bg-slate-800 hover:!bg-slate-700"
                          disabled={withdrawing}
                        >
                          {withdrawing ? 'Moving…' : 'Move money out'}
                        </ClassicBtn>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500">
                      We&apos;ll debit this group and credit your main BitBridge wallet.
                      This payout will also appear in the group&apos;s timeline so everyone
                      can see what happened.
                    </p>

                    {withdrawError && (
                      <p className="text-[11px] text-red-400">
                        {withdrawError}
                      </p>
                    )}
                    {withdrawSuccess && (
                      <p className="text-[11px] text-emerald-400">
                        {withdrawSuccess}
                      </p>
                    )}
                  </form>
                </>
              ) : (
                <>
                  <h2 className="text-sm font-semibold mb-1">
                    Move money back to your wallet
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Only the group owner or an admin can move money out of this shared
                    mini-wallet. You can still see every payout in the live activity
                    timeline above.
                  </p>
                </>
              )}
            </div>
          </section>

          {/* RIGHT – activity timeline */}
          <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold">Live activity timeline</h2>
              <span className="text-[11px] text-slate-500">
                Last {activity.length} move{activity.length === 1 ? '' : 's'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">
              See how money is moving inside this group.
            </p>

            {activity.length === 0 ? (
              <div className="mt-3 text-[11px] text-slate-400">
                <p className="font-medium mb-1">No activity yet.</p>
                <p>
                  Fund this group from your main wallet to see the first entries in this
                  timeline.
                </p>
              </div>
            ) : (
              <ul className="mt-3 space-y-3 text-xs">
                {activity.map((tx) => {
                  const amount = (tx.amount_cents || 0) / 100
                  const when = tx.occurred_at
                    ? new Date(tx.occurred_at).toLocaleString('en-NG', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : ''

                  const isCredit =
                    tx.direction === 'credit' || tx.direction === 'in'

                  const directionLabel =
                    tx.kind === 'payout'
                      ? 'Payout to wallet'
                      : isCredit
                      ? 'Money added'
                      : 'Money moved out'

                  const pillLabel =
                    tx.kind === 'payout'
                      ? 'GROUP → WALLET'
                      : isCredit
                      ? 'WALLET → GROUP'
                      : 'GROUP → WALLET'

                  return (
                    <li
                      key={tx.id}
                      className="relative rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-950 to-slate-900 px-3 py-3 overflow-hidden"
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-emerald-400/70 via-sky-500/70 to-transparent" />

                      <div className="ml-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-[10px] font-semibold border border-slate-950/80">
                              {tx.user?.email
                                ? tx.user.email[0].toUpperCase()
                                : 'BB'}
                            </div>
                            <div>
                              <p className="text-[11px] text-slate-300">
                                {directionLabel}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {tx.user?.email || 'Someone in this group'}
                              </p>
                            </div>
                          </div>
                          <span className="text-[11px] text-slate-500">
                            {when}
                          </span>
                        </div>

                        <p className="text-sm text-slate-100">
                          {formatNaira(amount)}{' '}
                          {tx.description && (
                            <span className="text-[11px] text-slate-300">
                              — {tx.description}
                            </span>
                          )}
                        </p>

                        <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-[2px] text-[10px] tracking-[0.16em] uppercase text-emerald-200">
                          {pillLabel}
                          <div className="mt-2 flex items-center justify-between">
  {tx.dispute ? (
    <span className="text-[11px] text-amber-400">
      ⚠ Review requested • {tx.dispute.status}
    </span>
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

                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Members card */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">People in this group</h2>
            <span className="text-[11px] text-slate-500">
              Owner &amp; current members
            </span>
          </div>

          {members.length === 0 ? (
            <p className="text-[11px] text-slate-400 mb-3">
              Right now it&apos;s just you. Add people using their BitBridge email so they
              can see and use this shared mini-wallet.
            </p>
          ) : (
            <ul className="mb-3 space-y-2 text-xs">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                >
                  <div>
                    <p className="text-slate-100">{m.user?.email}</p>
                    <p className="text-[11px] text-slate-500">
                      Role: <span className="capitalize">{m.role}</span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form
            onSubmit={handleInvite}
            className="flex flex-col md:flex-row gap-2 items-start md:items-center"
          >
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="friend@example.com"
              className="w-full md:flex-1 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
            />
            <ClassicBtn
              htmlType="submit"
              className="h-9 px-4 text-xs whitespace-nowrap"
              disabled={inviting}
            >
              {inviting ? 'Adding…' : 'Add person'}
            </ClassicBtn>
          </form>

          {inviteError && (
            <p className="mt-2 text-[11px] text-red-400">
              {inviteError}
            </p>
          )}
          {inviteSuccess && (
            <p className="mt-2 text-[11px] text-emerald-400">
              {inviteSuccess}
            </p>
          )}
        </section>
      </div>
      {activeDisputeTx && (
  <DisputeModal
    tx={activeDisputeTx}
    onClose={() => setActiveDisputeTx(null)}
    onCreated={(dispute) => {
      setActivity((prev) =>
        prev.map((t) =>
          t.id === activeDisputeTx.id ? { ...t, dispute } : t
        )
      )
    }}
  />
)}

    </div>
  )
}

export default CirclesDetailPage
