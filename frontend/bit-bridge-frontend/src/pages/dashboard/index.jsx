// src/pages/dashboard/index.jsx

import { TrophyOutlined, EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons'
import nairaFormat from '../../utils/nairaFormat'
import './style.scss'
import NavButton from '../../components/button/NavButton'
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import Loading from '../../components/loader/Loading'
import PowerComponent from '../../components/powerComponents/PowerComponent'
import MobileTopUpViewComponents from './components/MobileTopUpViewComponent'
import { getRescentPurchaseOrder, repurchaseOrder } from '../../redux/actions/purchasePower'
import { SET_LOADING, toggleShadowMode } from '../../redux/app'
import { getWallet } from '../../redux/actions/wallet'
import { useNavigate } from 'react-router-dom'
import AppModal from '../../components/modal/Modal'

import ClassicBtn from '../../components/button/ClassicButton'
import pickColorStyle from '../../utils/slect-color'
import AccountCreationWizard from '../../components/accountCreationWizard/AccountCreationWizard'
import AccountNumbers from '../../components/accountComponents/AccountComponents'
import { getAccounts, getUserAccount } from '../../redux/actions/account'

// ✅ Onboarding banner
import OnboardingBanner from '../../components/onboarding/OnboardingBanner'

import CableTvComponent from './components/cable-tv-compoent'
import { FaRegEye, FaRegEyeSlash } from 'react-icons/fa'
import { PiArrowsLeftRightBold, PiCirclesThreeBold, PiGlobeHemisphereWestBold } from 'react-icons/pi'
import ShadowValue from '../../components/ShadowValue'
import { needsTier2Access, withTier2MissingDetails } from '../../utils/kycGate'

// ✅ Toasts
import { toast } from 'react-toastify'
import { dashboardServices } from '../../data/dashboardServices'

const HomeDashboard = () => {
  const { recentOrders } = useSelector((state) => state.purchase)
  const { data: walletData, loading } = useSelector((state) => state.wallet)
  const { user } = useSelector((state) => state.auth)
  const { shadowMode } = useSelector((state) => state.app || {})
  const {
    accounts,
    altBank,
    altAccountNumber
  } = useSelector((state) => state.account)

  const dispatch = useDispatch()
  const navigate = useNavigate()

  const [open, setIsOpen] = useState(false)
  const [isAncorModal, setIsAncorModal] = useState(false)
  const [openAccount, setIsOpenAccount] = useState(false)
  const [selectedBiller, setSelectedBillier] = useState()
  const [selectedItem, setSelectedItem] = useState('Top Up')
  const [balanceMode, setBalanceMode] = useState('bridge')
  const [current, setCurrent] = useState(1)
  const [showAccountNumber, setShowAccountNumber] = useState(false)
  const [formData, setFormData] = useState({})
  const [accountDetails, setAccountDetails] = useState(null)

  // ✅ DISMISSIBLE ONBOARDING BANNER STATE (localStorage-backed)
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(() => {
    return localStorage.getItem('bb_hide_onboarding_banner') !== 'true'
  })

  const dismissBanner = () => {
    localStorage.setItem('bb_hide_onboarding_banner', 'true')
    setShowOnboardingBanner(false)
  }

  const handleRepurchase = (id) => {
    dispatch(SET_LOADING(true))
    dispatch(repurchaseOrder(id)).then((result) => {
      if (repurchaseOrder.fulfilled.match(result)) {
        const data = result.payload.data
        dispatch(SET_LOADING(false))
        setIsOpen(false)
        navigate(`/dashboard/confirm/${data?.id}`)
      } else {
        dispatch(SET_LOADING(false))
      }
    })
  }

  useEffect(() => {
    dispatch(getUserAccount())
  }, [dispatch])

  useEffect(() => {
    dispatch(getWallet())
  }, [dispatch])

  useEffect(() => {
    dispatch(getRescentPurchaseOrder())
  }, [dispatch])

  useEffect(() => {
    dispatch(getAccounts())
  }, [dispatch])

  const items = [
    {
      label: 'Mobile Top Up',
      name: 'Top Up',
      render: <MobileTopUpViewComponents />,
      btn: 'Mobile Top Up',
    },
    {
      label: 'Pay Electric Bills',
      name: 'Electric Bills',
      render: <PowerComponent />,
      btn: 'Electric Bills',
    },
    {
      label: 'Subscribe Cable Tv',
      name: 'TV Subscription',
      render: <CableTvComponent />,
      btn: 'Tv Subscription',
    },
  ]

  const { label } = items.find((item) => item.name === selectedItem)

  const getAccountDetails = () => {
    dispatch(getUserAccount())
  }

  // 🔐 KYC gate for virtual accounts
const handleGenerate = (vendor) => {
  const needsTier2 = needsTier2Access(user)

  // Monnify/Moniepoint intentionally disabled for new account creation
  if (vendor === 'monnify' || vendor === 'moniepoint') {
    toast.info('New Monnify/Moniepoint account creation is currently disabled.', {
      position: 'top-right',
      autoClose: 4000,
      pauseOnHover: true,
    })
    return
  }

  // Anchor
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
    return num.replace(/\d(?=\d{4})/g, '•')
  }

  const firstName =
    user?.user_profile?.first_name || user?.email?.split('@')[0] || 'there'

  const bridgeWallet = walletData?.bridge
  const tunnelWallet = walletData?.tunnel

  const activeWallet =
    balanceMode === 'tunnel' && tunnelWallet ? tunnelWallet : bridgeWallet
  const balance = activeWallet?.balance ?? 0
  const balanceLabel = balanceMode === 'tunnel' ? 'usd' : 'ngn'

  const formatBalance = (amount) => {
    if (balanceLabel === 'usd') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
      }).format(amount || 0)
    }
    return nairaFormat(amount, 'ngn')
  }

  const handleServiceAction = (action) => {
    if (!action) return
    if (action.type === 'select') {
      setSelectedItem(action.value)
      return
    }
    if (action.type === 'navigate' && action.to) {
      navigate(action.to)
    }
  }

  const quickServices = dashboardServices.filter((item) => item.quickLabel)
  const primaryServiceCards = dashboardServices.filter(
    (item) => item.card && !item.featured
  )
  const featuredService = dashboardServices.find((item) => item.featured)

  const bridgeActions = [
    { label: 'Send', to: '/dashboard/wallet' },
    { label: 'Receive', to: '/dashboard/virtual-accounts' },
    { label: 'Bills', to: '/dashboard/utilities' },
    { label: 'Circles', to: '/dashboard/shared-groups' },
  ]

  const tunnelActions = [
    { label: 'Convert', to: '/dashboard/tunnel/fx' },
    { label: 'Cards', to: '/dashboard/tunnel/cards' },
    { label: 'Accounts', to: '/dashboard/tunnel/virtual-accounts' },
    { label: 'Fund Card', to: '/dashboard/tunnel/cards' },
  ]

  const systemStatuses = [
    { key: 'Transfers', state: 'Ready' },
    { key: 'Cards', state: tunnelWallet ? 'Ready' : 'Setup' },
    { key: 'FX', state: tunnelWallet ? 'Available' : 'Activate' },
    { key: 'Utilities', state: 'Live' },
  ]

  const featuredServiceTitle =
    featuredService?.key === 'shared-groups' ? 'Circles' : featuredService?.label
  const featuredServiceDescription =
    featuredService?.key === 'shared-groups'
      ? 'Coordinate family, team, and trip money with shared visibility, cleaner contribution trails, and a more reliable command view.'
      : featuredService?.description
  const featuredServiceCta =
    featuredService?.key === 'shared-groups' ? 'Open circles' : featuredService?.card?.cta

  return (
    <>
      <div className="homeDashboard min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
        {/* ✅ Smart onboarding banner, driven by backend fields, now dismissible */}
        {showOnboardingBanner && (
          <div className="relative mb-3">
            <OnboardingBanner
              stage={user?.onboarding_stage}
              primaryUseCase={user?.primary_use_case}
              hasVirtualAccount={Boolean(accounts?.length)}
              onContinueClick={() => navigate('/dashboard/kyc')}
            />

            {/* Close (X) button */}
            <button
              type="button"
              onClick={dismissBanner}
              className="absolute top-2 right-3 text-slate-400 hover:text-white text-lg"
              aria-label="Dismiss onboarding"
            >
              ×
            </button>
          </div>
        )}

        {/* Top: Bridge/Tunnel command board */}
        <section className="mb-6">
          <div className="rounded-[28px] border border-slate-800 bg-[linear-gradient(135deg,rgba(2,6,23,0.96),rgba(15,23,42,0.94))] p-5 md:p-7 shadow-[0_24px_60px_rgba(2,6,23,0.45)]">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500 mb-1">
                  Rail command center
                </p>
                <h2 className="text-2xl md:text-3xl font-semibold">Hi, {firstName}</h2>
                <p className="mt-2 text-sm text-slate-400 max-w-2xl">
                  Operate Bridge for local NGN coordination, Tunnel for global USD movement,
                  and move between both rails without leaving your command view.
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
                  className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-[11px] text-slate-200 hover:border-alt/70 transition-colors"
                >
                  {shadowMode ? <EyeOutlined className="text-alt" /> : <EyeInvisibleOutlined className="text-alt" />}
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
                      Hold, send, receive, and coordinate everyday money flows across your wallet, bills, and circles.
                    </p>
                  </div>
                  <div>
                    <select
                      value={balanceMode}
                      onChange={(e) => setBalanceMode(e.target.value)}
                      className="bg-slate-950/70 border border-slate-700 text-slate-200 text-[11px] rounded-full px-3 py-1 focus:outline-none focus:border-alt"
                    >
                      <option value="bridge">Bridge (NGN)</option>
                      <option value="tunnel" disabled={!tunnelWallet}>Tunnel (USD)</option>
                    </select>
                  </div>
                </div>
                <div className="mb-5">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 mb-2">NGN balance</div>
                  {loading ? (
                    <Loading />
                  ) : (
                    <div className="text-3xl md:text-4xl font-semibold text-white">
                      <ShadowValue>{nairaFormat(bridgeWallet?.balance ?? 0, 'ngn')}</ShadowValue>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {bridgeActions.map((action) => (
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

              <div className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/tunnel/fx')}
                  className="group inline-flex flex-col items-center gap-2 rounded-full border border-slate-700 bg-slate-950/70 px-4 py-4 text-center hover:border-alt/70 transition"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-alt/15 text-alt">
                    <PiArrowsLeftRightBold className="text-xl" />
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Convert between rails</span>
                  <span className="text-xs text-slate-300 group-hover:text-white">Bridge to Tunnel</span>
                </button>
              </div>

              <div className="rounded-[24px] border border-sky-900/60 bg-sky-950/35 p-5 md:p-6">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/12 text-sky-300">
                      <PiGlobeHemisphereWestBold className="text-xl" />
                    </div>
                    <p className="mt-4 text-[11px] uppercase tracking-[0.24em] text-sky-300/80">Tunnel</p>
                    <h3 className="mt-2 text-xl font-semibold text-white">Global USD movement</h3>
                    <p className="mt-2 text-sm text-slate-300 max-w-md">
                      Convert, fund cards, and manage your global USD rail for international spending and movement.
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
                      className="rounded-2xl border border-sky-900/60 bg-slate-950/35 px-4 py-3 text-left text-sm font-medium text-slate-100 hover:border-sky-400/60 hover:bg-slate-950/60 transition"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              {systemStatuses.map((item) => (
                <div
                  key={item.key}
                  className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-3"
                >
                  <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">{item.key}</div>
                  <div className="mt-2 text-sm font-medium text-slate-100">{item.state}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Second: service launcher cards */}
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                Quick services
              </p>
              <h3 className="text-lg md:text-xl font-semibold">Pay & top up faster</h3>
            </div>
            <button
              type="button"
              onClick={() => navigate('/utility-services')}
              className="text-xs text-slate-300 hover:text-white transition"
            >
              Browse all
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {primaryServiceCards.map((item) => {
                const Icon = item.card?.icon
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleServiceAction(item.cardAction || item.action)}
                    className="group text-left relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.25)] hover:border-alt/70 hover:bg-slate-900 transition"
                  >
                    <div
                      className={`absolute -right-10 -top-10 h-24 w-24 rounded-full ${item.card?.glowClass} blur-2xl`}
                    />
                    <div
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${item.card?.iconClass}`}
                    >
                      {Icon ? <Icon /> : null}
                      {!Icon && item.card?.iconText ? (
                        <span className="text-xs font-bold">{item.card.iconText}</span>
                      ) : null}
                    </div>
                    <h3 className="font-semibold text-base mt-4">{item.label}</h3>
                    <p className="text-xs text-slate-400 mt-1">{item.description}</p>
                    <div className="mt-4 text-[11px] text-slate-400">
                      {item.card?.cta} ?
                    </div>
                  </button>
                )
              })}
            </div>

            {featuredService ? (
              <button
                type="button"
                onClick={() => handleServiceAction(featuredService.cardAction || featuredService.action)}
                className="group text-left relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.35)] hover:border-alt/70 transition"
              >
                <div
                  className={`absolute right-4 top-4 h-20 w-20 rounded-full ${featuredService.card?.glowClass} blur-2xl`}
                />
                <div
                  className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${featuredService.card?.iconClass}`}
                >
                  {featuredService.card?.icon ? (
                    <featuredService.card.icon />
                  ) : (
                    <span className="text-xs font-bold">
                      {featuredService.card?.iconText}
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-lg mt-5">{featuredServiceTitle}</h3>
                <p className="text-sm text-slate-400 mt-2 max-w-sm">
                  {featuredServiceDescription}
                </p>
                <div className="mt-6 text-xs text-slate-300">
                  {featuredServiceCta} ?
                </div>
              </button>
            ) : null}
          </div>
        </section>
        {/* Third: recent activity + accounts snapshot */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          {/* Recent transactions / purchases */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 lg:p-6 min-h-[220px]">
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-lg font-semibold">Recent activity</h5>
            </div>

            <div className="flex flex-wrap gap-4 max-w-4xl">
              {recentOrders?.length ? (
                recentOrders.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setIsOpen(true)
                      setSelectedBillier(item)
                    }}
                    className={`${pickColorStyle(
                      item.biller
                    )} cursor-pointer rounded-xl text-xs md:text-sm h-16 w-24 md:w-28 shadow-sm flex flex-col justify-center items-center transition-transform hover:scale-105`}
                  >
                    <span className="font-medium">{item.biller}</span>
                    <span className="text-[11px] md:text-xs">
                      <ShadowValue>
                        {nairaFormat(item.amount)}
                      </ShadowValue>
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">
                  No recent purchases yet. Buy power, airtime, or data to see
                  them here.
                </p>
              )}
            </div>
          </div>

          {/* Accounts snapshot (Anchor / Moniepoint) */}
          <div
            id="accounts"
            className="accounts-panel bg-slate-900 rounded-2xl border border-slate-800 p-5 lg:p-6"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h5 className="text-lg font-semibold">Your accounts</h5>
                <p className="text-xs text-slate-400">
                  Incoming transfers to these accounts will fund your BitBridge
                  wallet.
                </p>
              </div>
            </div>

            <AccountNumbers
              accounts={accounts}
              generate={handleGenerate}
              onView={(i, data) => {
                setAccountDetails(data)
                setIsOpenAccount(true)
              }}
            />
          </div>
        </div>

        {/* Fourth: services switcher (detailed forms) */}
        <section className="mb-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 lg:p-5 shadow-[0_12px_30px_rgba(15,23,42,0.28)]">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div className="flex flex-wrap items-center gap-2 text-slate-500">
                <span className="text-[10px] uppercase tracking-[0.2em]">Services</span>
                <span className="text-slate-600">/</span>
                <h4 className="text-alt text-lg md:text-xl font-semibold">
                  {label}
                </h4>
              </div>
              <ul className="flex flex-wrap gap-2">
                {items.map((item) => (
                  <li key={item.label}>
                    <NavButton
                      onClick={() => setSelectedItem(item.name)}
                      className={`${selectedItem === item.name && 'active'} block py-1.5 px-3 rounded-full text-[10px] md:text-[11px] tracking-wide uppercase`}
                    >
                      {item.btn}
                    </NavButton>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 md:p-4">
              {items.map((item) =>
                item.name === selectedItem ? (
                  <div key={item.name} className="w-full">
                    {item.render}
                  </div>
                ) : null
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Repurchase modal */}
      <AppModal
        isModalOpen={open}
        handleCancel={() => setIsOpen((prev) => !prev)}
      >
        <div>
          <h3 className="text-white text-center text-2xl font-medium">
            Confirm
          </h3>
          <h3 className="text-white text-center text-lg">
            {selectedBiller?.service_type} subscription
          </h3>
          <p
            className={`${
              selectedBiller?.biller === 'MTN'
                ? 'text-alt'
                : selectedBiller?.biller === 'GLO'
                ? 'text-green-500'
                : 'text-white'
            } font-semibold text-center text-lg my-6`}
          >
            {selectedBiller?.biller}
          </p>
          <p className="text-2xl font-medium text-white text-center my-2">
            {selectedBiller?.meter_number}
          </p>
          <p className="text-3xl text-white text-center my-4">
            <ShadowValue>
              {nairaFormat(selectedBiller?.amount ?? 0)}
            </ShadowValue>
          </p>
          <div className="flex justify-center gap-6">
            <ClassicBtn onclick={() => handleRepurchase(selectedBiller.id)}>
              Confirm
            </ClassicBtn>
            <ClassicBtn onclick={() => setIsOpen(false)} type="cancel">
              Cancel
            </ClassicBtn>
          </div>
        </div>
      </AppModal>

      {/* Account details modal */}
      <AppModal
        isModalOpen={openAccount}
        handleCancel={() => setIsOpenAccount((prev) => !prev)}
      >
        <div>
          <h2 className="text-xl font-bold mb-4 text-gray-200">
            Account Details
          </h2>
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
                  accountDetails?.active ||
                  accountDetails?.status === 'completed'
                    ? 'text-green-500'
                    : 'text-red-500'
                } font-medium`}
              >
                {accountDetails?.active ||
                accountDetails?.status === 'completed'
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
              onclick={getAccountDetails}
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

      {/* Anchor KYC / account creation wizard */}
      <AppModal
        title={'Generate Account'}
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

