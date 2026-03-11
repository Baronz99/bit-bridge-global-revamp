import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import ShadowValue from '../../components/ShadowValue'
import Loading from '../../components/loader/Loading'
import { getUserCardSnapshot } from '../../api/cards'
import { getPooledFundingAccount, createFundingIntent } from '../../api/tunnel'
import { activateTunnelWallet, getUserTransactions } from '../../api/wallets'
import { getWallet } from '../../redux/actions/wallet'
import { resolveReceiptReference } from '../../utils/receiptReference'

const cardClass =
  'rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.22)]'
const actionClass =
  'rounded-2xl border border-[#FF7A18] bg-[linear-gradient(135deg,rgba(255,138,42,0.12),rgba(255,176,90,0.08)_40%,rgba(15,23,42,0.82)_100%)] px-4 py-3 text-left text-sm font-medium text-slate-100 hover:border-[#FFB05A] hover:bg-[linear-gradient(135deg,rgba(255,138,42,0.16),rgba(255,176,90,0.1)_40%,rgba(15,23,42,0.88)_100%)] transition'

const formatUsd = (value = 0) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

const formatDate = (value) => {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return date.toLocaleString()
}

const TunnelDashboard = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: walletData, loading } = useSelector((state) => state.wallet)
  const tunnelWallet =
    walletData?.data?.find?.((wallet) => wallet?.wallet_type === 'usd') || walletData?.tunnel || null

  const [cardSnapshot, setCardSnapshot] = useState(null)
  const [pooledAccount, setPooledAccount] = useState(null)
  const [fundingIntent, setFundingIntent] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [panelLoading, setPanelLoading] = useState(true)
  const [fundingLoading, setFundingLoading] = useState(false)

  const activePanel = searchParams.get('panel') || 'overview'

  useEffect(() => {
    dispatch(getWallet())
  }, [dispatch])

  useEffect(() => {
    let active = true

    const loadTunnelData = async () => {
      setPanelLoading(true)
      try {
        const [walletRes, cardRes, pooledRes, transactionRes] = await Promise.all([
          activateTunnelWallet().catch(() => null),
          getUserCardSnapshot().catch(() => null),
          getPooledFundingAccount().catch(() => null),
          getUserTransactions({ wallet_type: 'usd', limit: 5 }).catch(() => null),
        ])

        if (!active) return

        if (walletRes?.data?.data) {
          dispatch(getWallet())
        }

        setCardSnapshot(cardRes?.data?.data || null)
        setPooledAccount(pooledRes?.data?.data || null)

        const txData = transactionRes?.data?.data || []
        setTransactions((Array.isArray(txData) ? txData : []).slice(0, 5))
      } finally {
        if (active) setPanelLoading(false)
      }
    }

    loadTunnelData()
    return () => {
      active = false
    }
  }, [dispatch])

  const primaryActions = [
    { label: 'Convert funds', onClick: () => navigate('/dashboard/tunnel/fx') },
    { label: 'Open cards', onClick: () => navigate('/dashboard/virtual-cards') },
    {
      label: 'Funding instructions',
      onClick: () => navigate('/dashboard/tunnel/funding'),
    },
    { label: 'View ledger', onClick: () => navigate('/dashboard/activity?tab=transactions&wallet=usd&view=deposits') },
  ]

  const cardStatus = useMemo(() => {
    const status = String(cardSnapshot?.status || '').trim()
    if (!status) return 'No card yet'
    return status.replace(/_/g, ' ')
  }, [cardSnapshot])

  const createFundingReference = async () => {
    setFundingLoading(true)
    try {
      const response = await createFundingIntent()
      setFundingIntent(response?.data?.data || null)
      navigate('/dashboard/tunnel/funding')
    } finally {
      setFundingLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        <section className="rounded-[28px] border border-[#FF7A18] bg-[linear-gradient(135deg,rgba(255,138,42,0.16),rgba(255,176,90,0.1)_42%,rgba(15,23,42,0.9)_100%)] p-5 md:p-7 shadow-[0_24px_60px_rgba(255,176,90,0.16)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-[#FFB05A]">Tunnel</p>
              <h1 className="mt-3 text-2xl md:text-3xl font-semibold text-white">Global USD rail</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Operate the Tunnel rail from one place: hold USD balance, convert from Bridge,
                fund cards, and track dollar movement without falling back to disconnected pages.
              </p>
            </div>

            <div className="grid min-w-[18rem] grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#FF7A18] bg-[linear-gradient(135deg,rgba(255,138,42,0.12),rgba(255,176,90,0.08)_45%,rgba(15,23,42,0.88)_100%)] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500 mb-2">
                  Tunnel balance
                </div>
                {loading ? (
                  <Loading />
                ) : (
                  <div className="text-3xl font-semibold text-white">
                    <ShadowValue>{formatUsd(tunnelWallet?.balance ?? 0)}</ShadowValue>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-700 bg-slate-950/45 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500 mb-2">
                  Current card
                </div>
                <div className="text-sm font-semibold capitalize text-white">{cardStatus}</div>
                <div className="mt-1 text-xs text-slate-400">
                  {cardSnapshot?.card_id ? 'Card provisioned' : 'Ready when you are'}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={cardClass}>
          <div className="mb-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Primary actions</p>
            <h2 className="mt-1 text-lg md:text-xl font-semibold text-white">Operate the Tunnel rail</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {primaryActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                className={actionClass}
              >
                {action.label}
              </button>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)]">
          <section className={cardClass}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Rail activity</p>
                <h2 className="mt-1 text-lg md:text-xl font-semibold text-white">Recent USD movement</h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('/dashboard/activity?tab=transactions&wallet=usd&view=deposits')}
                className="text-xs text-[#FFB05A] hover:text-[#FFD08A] transition"
              >
                Open full ledger
              </button>
            </div>

            {panelLoading ? (
              <Loading />
            ) : transactions.length ? (
              <div className="space-y-3">
                {transactions.map((item) => {
                  const receiptRef = resolveReceiptReference(item, { kindHint: 'wallet', preferWallet: true })
                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-3"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-sm font-semibold capitalize text-white">
                            {item.transaction_type}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            {item.reference || item.description || item.address || 'Tunnel activity'}
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500">
                            {formatDate(item.created_at)}
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-sm font-semibold text-white">
                              <ShadowValue>{formatUsd(item.amount)}</ShadowValue>
                            </div>
                            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                              {item.status}
                            </div>
                          </div>
                          {receiptRef ? (
                            <Link
                              to={`/dashboard/receipt/${receiptRef}`}
                              className="text-xs text-[#FFB05A] hover:text-[#FFD08A]"
                            >
                              Receipt
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-5 text-sm text-slate-400">
                No Tunnel activity yet. Convert from Bridge or fund a card to start the USD ledger.
              </div>
            )}
          </section>

          <div className="flex flex-col gap-6">
            <section className={cardClass}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Cards</p>
                  <h2 className="mt-1 text-lg md:text-xl font-semibold text-white">Current card state</h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/virtual-cards')}
                  className="text-xs text-[#FFB05A] hover:text-[#FFD08A] transition"
                >
                  Open cards
                </button>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Status</div>
                <div className="mt-2 text-lg font-semibold capitalize text-white">{cardStatus}</div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-300">
                  <div>
                    <div className="text-slate-500">Cardholder</div>
                    <div className="mt-1 text-slate-100">
                      {cardSnapshot?.cardholder_id || 'Not registered'}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Provider card</div>
                    <div className="mt-1 text-slate-100">
                      {cardSnapshot?.card_id || 'Pending'}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section
              className={`${cardClass} ${activePanel === 'funding' ? 'ring-1 ring-[#FFB05A]/40' : ''}`}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Funding</p>
                  <h2 className="mt-1 text-lg md:text-xl font-semibold text-white">Pooled account rail</h2>
                </div>
                <button
                  type="button"
                  onClick={createFundingReference}
                  disabled={fundingLoading}
                  className="rounded-xl border border-[#FF7A18] bg-[#FF8A2A] px-3 py-2 text-xs font-semibold text-slate-950 shadow-[0_0_24px_rgba(255,176,90,0.2)] disabled:opacity-60"
                >
                  {fundingLoading ? 'Creating...' : 'Create reference'}
                </button>
              </div>

              {pooledAccount ? (
                <div className="space-y-3 text-sm text-slate-300">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Bank</div>
                        <div className="mt-1 text-slate-100">{pooledAccount.bank_name}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Account number</div>
                        <div className="mt-1 text-slate-100">{pooledAccount.account_number}</div>
                      </div>
                      <div className="sm:col-span-2">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Account name</div>
                        <div className="mt-1 text-slate-100">{pooledAccount.account_name}</div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-slate-400">{pooledAccount.instructions}</div>
                  </div>

                  {fundingIntent ? (
                    <div className="rounded-2xl border border-[#FF7A18] bg-[linear-gradient(135deg,rgba(255,138,42,0.12),rgba(255,176,90,0.08)_42%,rgba(15,23,42,0.84)_100%)] px-4 py-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Funding reference</div>
                      <div className="mt-2 text-base font-semibold text-white">{fundingIntent.reference}</div>
                      <div className="mt-2 text-xs text-slate-400">
                        Use this reference when transferring to the pooled account for auto-credit.
                      </div>
                      <div className="mt-2 text-[11px] text-slate-500">
                        Expires: {formatDate(fundingIntent.expires_at)}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4 text-sm text-slate-400">
                      Create a funding reference when you need to move value into the Tunnel rail from an external transfer.
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-5 text-sm text-slate-400">
                  Tunnel funding instructions are not available right now.
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TunnelDashboard
