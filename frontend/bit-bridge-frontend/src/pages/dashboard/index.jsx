import { TrophyOutlined, EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { FaRegEye, FaRegEyeSlash } from 'react-icons/fa'
import {
  PiArrowsLeftRightBold,
  PiCirclesThreeBold,
  PiGlobeHemisphereWestBold,
} from 'react-icons/pi'
import { toast } from 'react-toastify'
import nairaFormat from '../../utils/nairaFormat'
import './style.scss'
import Loading from '../../components/loader/Loading'
import AppModal from '../../components/modal/Modal'
import ClassicBtn from '../../components/button/ClassicButton'
import AccountCreationWizard from '../../components/accountCreationWizard/AccountCreationWizard'
import AccountNumbers from '../../components/accountComponents/AccountComponents'
import OnboardingBanner from '../../components/onboarding/OnboardingBanner'
import ShadowValue from '../../components/ShadowValue'
import { getAccountSummary } from '../../redux/actions/account'
import { toggleShadowMode } from '../../redux/app'
import { getTimelinePreview, getServiceAvailability } from '../../api/home'
import { getSectionCatalog } from '../../api/catalog'
import { resolveReceiptReference } from '../../utils/receiptReference'
import { needsTier2Access, withTier2MissingDetails } from '../../utils/kycGate'
import {
  getBridgeServicePresentation,
  isBridgeCatalogServiceType,
} from '../../utils/bridgeCatalogPresentation'

const serviceStateStyles = {
  operational: 'text-emerald-300 border-emerald-900/60',
  degraded: 'text-amber-300 border-amber-900/60',
  outage: 'text-rose-300 border-rose-900/60',
  unknown: 'text-slate-300 border-slate-700',
}

const uniqueBy = (items, getKey) => {
  const seen = new Set()
  return items.filter((item) => {
    const key = getKey(item)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const formatTimelineAmount = (item) => {
  const amountCents = Number(item?.amount_cents || 0)
  const currency =
    String(item?.meta?.currency || '').toUpperCase() === 'USD' ||
    String(item?.meta?.wallet_type || '').toLowerCase() === 'usd'
      ? 'USD'
      : 'NGN'
  const amount = amountCents / 100

  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  return nairaFormat(amount, 'ngn')
}

const formatTimelineDate = (value) => {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return date.toLocaleString()
}

const HomeDashboard = () => {
  const { data: walletData, loading } = useSelector((state) => state.wallet)
  const { user } = useSelector((state) => state.auth)
  const { shadowMode } = useSelector((state) => state.app || {})
  const { accountSummary, altBank, altAccountNumber } = useSelector((state) => state.account)

  const dispatch = useDispatch()
  const navigate = useNavigate()

  const [isAncorModal, setIsAncorModal] = useState(false)
  const [openAccount, setIsOpenAccount] = useState(false)
  const [balanceMode, setBalanceMode] = useState('bridge')
  const [current, setCurrent] = useState(1)
  const [showAccountNumber, setShowAccountNumber] = useState(false)
  const [formData, setFormData] = useState({})
  const [accountDetails, setAccountDetails] = useState(null)
  const [timelineItems, setTimelineItems] = useState([])
  const [timelineLoading, setTimelineLoading] = useState(true)
  const [serviceSnapshot, setServiceSnapshot] = useState(null)
  const [serviceLoading, setServiceLoading] = useState(true)
  const [catalogItems, setCatalogItems] = useState([])

  const [showOnboardingBanner, setShowOnboardingBanner] = useState(
    () => localStorage.getItem('bb_hide_onboarding_banner') !== 'true'
  )
  const homeBootstrapRef = useRef(false)

  const dismissBanner = () => {
    localStorage.setItem('bb_hide_onboarding_banner', 'true')
    setShowOnboardingBanner(false)
  }

  useEffect(() => {
    if (homeBootstrapRef.current) return
    homeBootstrapRef.current = true
    dispatch(getAccountSummary())
  }, [dispatch])

  useEffect(() => {
    let active = true

    const loadHomeData = async () => {
      setTimelineLoading(true)
      setServiceLoading(true)

      try {
        const [timelineRes, serviceRes, catalogRes] = await Promise.all([
          getTimelinePreview({ limit: 5 }).catch(() => null),
          getServiceAvailability().catch(() => null),
          getSectionCatalog('bridge').catch(() => null),
        ])

        if (!active) return

        setTimelineItems(Array.isArray(timelineRes?.data?.items) ? timelineRes.data.items : [])
        setServiceSnapshot(serviceRes?.data?.data || null)
        setCatalogItems(Array.isArray(catalogRes?.data?.data) ? catalogRes.data.data : [])
      } finally {
        if (!active) return
        setTimelineLoading(false)
        setServiceLoading(false)
      }
    }

    loadHomeData()

    return () => {
      active = false
    }
  }, [])

  const handleGenerate = (vendor) => {
    const needsTier2 = needsTier2Access(user)

    if (vendor === 'monnify' || vendor === 'moniepoint') {
      toast.info('New Monnify/Moniepoint account creation is currently disabled.', {
        position: 'top-right',
        autoClose: 4000,
        pauseOnHover: true,
      })
      return
    }

    if (vendor === 'anchor') {
      if (needsTier2) {
        toast.info(withTier2MissingDetails(user, 'Complete Tier 2 verification'), {
          position: 'top-right',
          autoClose: 4000,
          pauseOnHover: true,
        })
        return
      }

      navigate('/dashboard/virtual-accounts')
      return
    }

    toast.info('Only Anchor virtual account creation is currently enabled.', {
      position: 'top-right',
      autoClose: 4000,
      pauseOnHover: true,
    })
  }

  const maskAccountNumber = (num) => {
    if (!num) return ''
    return num.replace(/\d(?=\d{4})/g, '*')
  }

  const firstName = user?.user_profile?.first_name || user?.email?.split('@')[0] || 'there'
  const bridgeWallet = walletData?.bridge
  const tunnelWallet = walletData?.tunnel

  const canonicalAnchorAccount = useMemo(() => {
    const summaryAnchorAccount = accountSummary?.data?.anchor_account || null
    if (!summaryAnchorAccount) return null

    return {
      ...summaryAnchorAccount,
      active: Boolean(summaryAnchorAccount?.active),
      status: summaryAnchorAccount?.status || accountSummary?.flow?.state || 'completed',
    }
  }, [accountSummary])

  const bridgeCatalogActions = useMemo(() => {
    return uniqueBy(
      catalogItems
        .filter((item) => isBridgeCatalogServiceType(item?.service_type))
        .map((item) => {
          const serviceType = String(item?.service_type || '').toUpperCase()
          const presentation = getBridgeServicePresentation(serviceType)
          return {
            key: serviceType,
            label: presentation?.label || item?.label || 'Open service',
            to: item?.launcher_route || presentation?.route || '/dashboard/bridge/utilities',
          }
        }),
      (item) => item.key
    )
  }, [catalogItems])

  const bridgeActions = [
    { label: 'Send', to: '/dashboard/bridge/send' },
    { label: 'Receive', to: '/dashboard/virtual-accounts' },
    bridgeCatalogActions[0] || { label: 'Utilities', to: '/dashboard/bridge/utilities' },
    { label: 'Circles', to: '/dashboard/bridge/circles' },
  ]

  const tunnelActions = [
    { label: 'Convert', to: '/dashboard/tunnel/fx' },
    { label: 'Cards', to: '/dashboard/tunnel/cards' },
    { label: 'Funding', to: '/dashboard/tunnel/funding' },
    { label: 'Fund Card', to: '/dashboard/tunnel/cards' },
  ]

  const actionShortcuts = useMemo(() => {
    const explicit = [
      { label: 'Send money', to: '/dashboard/bridge/send' },
      { label: 'Receive', to: '/dashboard/virtual-accounts' },
      { label: 'Convert', to: '/dashboard/tunnel/fx' },
      { label: 'Fund card', to: '/dashboard/tunnel/cards' },
      { label: 'View activity', to: '/dashboard/activity' },
    ]

    const catalogShortcuts = bridgeCatalogActions.slice(0, 2).map((item) => ({
      label: item.label,
      to: item.to,
    }))

    return [...explicit.slice(0, 3), ...catalogShortcuts, ...explicit.slice(3)]
  }, [bridgeCatalogActions])

  const serviceStatuses = useMemo(() => {
    return Array.isArray(serviceSnapshot?.services) ? serviceSnapshot.services.slice(0, 4) : []
  }, [serviceSnapshot])

  return (
    <>
      <div className="homeDashboard min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
        {showOnboardingBanner && (
          <div className="relative mb-3">
            <OnboardingBanner
              stage={user?.onboarding_stage}
              primaryUseCase={user?.primary_use_case}
              hasVirtualAccount={Boolean(
                canonicalAnchorAccount?.account_number || accountSummary?.extra?.has_deposit_account
              )}
              onContinueClick={() => navigate('/dashboard/kyc')}
            />

            <button
              type="button"
              onClick={dismissBanner}
              className="absolute top-2 right-3 text-slate-400 hover:text-white text-lg"
              aria-label="Dismiss onboarding"
            >
              x
            </button>
          </div>
        )}

        <section className="mb-6">
          <div className="rounded-[28px] border border-slate-800 bg-[linear-gradient(135deg,rgba(2,6,23,0.96),rgba(15,23,42,0.94))] p-5 md:p-7 shadow-[0_24px_60px_rgba(2,6,23,0.45)]">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500 mb-1">
                  Rail command center
                </p>
                <h2 className="text-2xl md:text-3xl font-semibold">Hi, {firstName}</h2>
                <p className="mt-2 text-sm text-slate-400 max-w-2xl">
                  Operate local and global money rails from one dashboard.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1.5">
                  <TrophyOutlined className="text-yellow-500" />
                  <span>
                    Bonus:{' '}
                    <span className="font-semibold text-emerald-400">
                      <ShadowValue>{nairaFormat(bridgeWallet?.commission ?? 0, 'ngn')}</ShadowValue>
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => dispatch(toggleShadowMode())}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-[11px] text-slate-200 hover:border-emerald-400/50 transition-colors"
                >
                  {shadowMode ? (
                    <EyeOutlined className="text-alt" />
                  ) : (
                    <EyeInvisibleOutlined className="text-alt" />
                  )}
                  <span>{shadowMode ? 'Show balances' : 'Hide balances'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-4 items-stretch">
              <div className="rounded-[24px] border border-emerald-900/60 bg-emerald-950/40 p-5 md:p-6">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-300">
                      <PiCirclesThreeBold className="text-xl" />
                    </div>
                    <p className="mt-4 text-[11px] uppercase tracking-[0.24em] text-emerald-300/80">Bridge</p>
                    <h3 className="mt-2 text-xl font-semibold text-white">Local NGN coordination</h3>
                    <p className="mt-2 text-sm text-slate-300 max-w-md">
                      Send, receive, and manage your local wallet activity.
                    </p>
                    <div className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-full border border-emerald-900/70 bg-slate-950/40 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-emerald-200/80">
                      <span>Primary rail</span>
                      <span className="text-emerald-500/60">&middot;</span>
                      <span>NGN ledger</span>
                      <span className="text-emerald-500/60">&middot;</span>
                      <span>Local settlement</span>
                    </div>
                  </div>
                  <div>
                    <select
                      value={balanceMode}
                      onChange={(e) => setBalanceMode(e.target.value)}
                      className="bg-slate-950/70 border border-slate-700 text-slate-200 text-[11px] rounded-full px-3 py-1 focus:outline-none focus:border-alt"
                    >
                      <option value="bridge">Bridge (NGN)</option>
                      <option value="tunnel" disabled={!tunnelWallet}>
                        Tunnel (USD)
                      </option>
                    </select>
                  </div>
                </div>
                <div className="mb-5">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 mb-2">NGN balance</div>
                  {loading ? (
                    <Loading />
                  ) : (
                    <div className="text-4xl md:text-5xl font-semibold tracking-[-0.03em] text-white">
                      <ShadowValue>{nairaFormat(bridgeWallet?.balance ?? 0, 'ngn')}</ShadowValue>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard/bridge/send')}
                    className="rounded-2xl bg-emerald-400 px-4 py-3 text-left text-sm font-semibold text-black hover:bg-emerald-300 transition"
                  >
                    Send money
                  </button>
                  <div className="grid grid-cols-3 gap-3">
                    {bridgeActions
                      .filter((action) => action.label !== 'Send')
                      .map((action) => (
                        <button
                          key={action.label}
                          type="button"
                          onClick={() => navigate(action.to)}
                          className="rounded-2xl border border-emerald-900/60 bg-slate-950/35 px-4 py-3 text-left text-sm font-medium text-slate-100 hover:border-emerald-400/60 hover:bg-slate-950/60 transition"
                        >
                          {action.label}
                        </button>
                      ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/tunnel/fx')}
                  className="group inline-flex flex-col items-center gap-3 rounded-[24px] border border-slate-700 bg-slate-950/70 px-4 py-5 text-center hover:border-slate-500 transition"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-800 text-slate-200">
                    <PiArrowsLeftRightBold className="text-xl" />
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                    Convert between rails
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                    <span>Bridge NGN</span>
                    <span className="text-slate-400">-&gt;</span>
                    <span>Tunnel USD</span>
                  </span>
                  <span className="max-w-[9rem] text-xs text-slate-300 group-hover:text-white">
                    Move value between both rails without leaving the dashboard.
                  </span>
                  <span className="text-sm font-semibold text-slate-100">Convert now</span>
                </button>
              </div>

              <div className="rounded-[24px] border border-[#FF7A18] bg-[linear-gradient(135deg,rgba(255,138,42,0.16),rgba(255,176,90,0.1)_42%,rgba(15,23,42,0.9)_100%)] p-5 md:p-6">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(255,176,90,0.18)] text-[#FFB05A] shadow-[0_0_24px_rgba(255,176,90,0.12)]">
                      <PiGlobeHemisphereWestBold className="text-xl" />
                    </div>
                    <p className="mt-4 text-[11px] uppercase tracking-[0.24em] text-[#FFB05A]">Tunnel</p>
                    <h3 className="mt-2 text-xl font-semibold text-white">Global USD movement</h3>
                    <p className="mt-2 text-sm text-slate-300 max-w-md">
                      Convert, fund cards, and manage your global USD rail.
                    </p>
                  </div>
                </div>
                <div className="mb-5">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 mb-2">USD balance</div>
                  {loading ? (
                    <Loading />
                  ) : (
                    <div className="text-3xl md:text-4xl font-semibold text-white">
                      <ShadowValue>
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          minimumFractionDigits: 2,
                        }).format(tunnelWallet?.balance ?? 0)}
                      </ShadowValue>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {tunnelActions.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => navigate(action.to)}
                      className="rounded-2xl border border-[#FF7A18] bg-[rgba(255,138,42,0.08)] px-4 py-3 text-left text-sm font-medium text-slate-100 hover:border-[#FFB05A] hover:bg-[rgba(255,138,42,0.14)] transition"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
              {serviceLoading ? (
                <div className="md:col-span-4 rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-5">
                  <Loading />
                </div>
              ) : (
                serviceStatuses.map((item) => {
                  const state = String(item?.state || 'unknown').toLowerCase()
                  return (
                    <div
                      key={item.key || item.label}
                      className={`rounded-2xl border bg-slate-950/45 px-4 py-3 ${serviceStateStyles[state] || serviceStateStyles.unknown}`}
                    >
                      <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                        {item.label || item.key}
                      </div>
                      <div className="mt-2 text-sm font-medium capitalize text-slate-100">{state}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {item?.advice?.message || item?.reason || 'Status unavailable.'}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </section>

        <section className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-4">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.28)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Action shortcuts</p>
                  <h3 className="text-lg md:text-xl font-semibold">Operate the rails faster</h3>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/activity')}
                  className="text-xs text-slate-300 hover:text-white transition"
                >
                  Open ledger
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {actionShortcuts.map((item) => (
                  <button
                    key={`${item.label}-${item.to}`}
                    type="button"
                    onClick={() => navigate(item.to)}
                    className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-4 text-left text-sm font-medium text-slate-100 hover:border-slate-600 hover:bg-slate-950/65 transition"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          <div className="bg-slate-900/85 rounded-3xl border border-slate-800 p-5 lg:p-6 min-h-[220px] shadow-[0_16px_40px_rgba(15,23,42,0.2)]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h5 className="text-lg font-semibold">Recent activity</h5>
                <p className="text-xs text-slate-400">Unified ledger preview across Bridge, Tunnel, bills, and cards.</p>
              </div>
              <Link to="/dashboard/activity" className="text-xs text-alt hover:text-white transition">
                Open Activity
              </Link>
            </div>

            {timelineLoading ? (
              <Loading />
            ) : timelineItems.length ? (
              <div className="space-y-3">
                {timelineItems.map((item) => {
                  const receiptRef = resolveReceiptReference(item)
                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-3"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-white">{item.label || 'Activity'}</div>
                          <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                            {(item.kind || 'activity').replace(/_/g, ' ')}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">{formatTimelineDate(item.occurred_at)}</div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-sm font-semibold text-white">
                              <ShadowValue>{formatTimelineAmount(item)}</ShadowValue>
                            </div>
                            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                              {item.status || 'posted'}
                            </div>
                          </div>
                          {receiptRef ? (
                            <Link
                              to={`/dashboard/receipt/${receiptRef}`}
                              className="text-xs text-alt hover:text-white transition"
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
              <p className="text-sm text-slate-400">
                No ledger activity yet. Start with Bridge send, Tunnel convert, or bill payment.
              </p>
            )}
          </div>

          <div
            id="accounts"
            className="accounts-panel bg-slate-900/85 rounded-3xl border border-slate-800 p-5 lg:p-6 shadow-[0_16px_40px_rgba(15,23,42,0.2)]"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h5 className="text-lg font-semibold">Your accounts</h5>
                <p className="text-xs text-slate-400">
                  Incoming transfers to these accounts will fund your BitBridge wallet.
                </p>
              </div>
            </div>

            <AccountNumbers
              accounts={[]}
              anchorAccount={canonicalAnchorAccount}
              generate={handleGenerate}
              onView={(i, data) => {
                const resolvedDetails =
                  String(data?.vendor || '').toLowerCase() === 'anchor' && canonicalAnchorAccount
                    ? canonicalAnchorAccount
                    : data
                setAccountDetails(resolvedDetails)
                setIsOpenAccount(true)
              }}
            />
          </div>
        </div>
      </div>

      <AppModal
        isModalOpen={openAccount}
        handleCancel={() => setIsOpenAccount((prev) => !prev)}
      >
        <div>
          <h2 className="text-xl font-bold mb-4 text-gray-200">Account Details</h2>
          <div className="space-y-3 text-gray-200">
            <div className="flex gap-4">
              <span className="font-semibold">Bank:</span>
              <span>{accountDetails?.bank_name}</span>
            </div>
            <div className="flex gap-4">
              <span className="font-semibold">Name:</span>
              <span>{accountDetails?.account_name}</span>
            </div>
            <div className="flex gap-4 justify-between items-center">
              <div className="space-x-2">
                <span className="font-semibold">Account Number:</span>
                <span>
                  {showAccountNumber
                    ? accountDetails?.account_number
                    : maskAccountNumber(accountDetails?.account_number)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowAccountNumber((prev) => !prev)}
                className="cursor-pointer text-xl text-slate-200 hover:text-slate-100"
              >
                {showAccountNumber ? <FaRegEyeSlash /> : <FaRegEye />}
              </button>
            </div>

            <div className="flex gap-4">
              <span className="font-semibold">Status:</span>
              <span
                className={`${
                  accountDetails?.active || accountDetails?.status === 'completed'
                    ? 'text-green-500'
                    : 'text-red-500'
                } font-medium`}
              >
                {accountDetails?.active || accountDetails?.status === 'completed'
                  ? 'Active'
                  : 'In-Active'}
              </span>
            </div>

            {altBank && (
              <div className="border-t border-slate-700 py-4 space-y-3">
                <div className="flex gap-4">
                  <span className="font-semibold">Alt Bank:</span>
                  <span>{altBank}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-semibold">Alt Account Number:</span>
                  <span>{altAccountNumber}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-center gap-6 mt-6">
            <ClassicBtn
              className="!text-emerald-300 border !border-emerald-400"
              onclick={() => navigate('/dashboard/virtual-accounts')}
              type="cancel"
            >
              View More Details
            </ClassicBtn>
            <ClassicBtn onclick={() => setIsOpenAccount(false)} type="cancel">
              Close
            </ClassicBtn>
          </div>
        </div>
      </AppModal>

      <AppModal
        title="Generate Account"
        isModalOpen={isAncorModal}
        handleCancel={() => setIsAncorModal((prev) => !prev)}
      >
        <AccountCreationWizard
          setFormData={setFormData}
          formData={formData}
          current={current}
          setCurrent={setCurrent}
          setIsOpenAccount={setIsOpenAccount}
          openAccount={openAccount}
          setIsAncorModal={setIsAncorModal}
          user={user}
        />
      </AppModal>
    </>
  )
}

export default HomeDashboard
