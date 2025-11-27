// src/pages/dashboard/index.jsx

import { TrophyOutlined, EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons'
import { nairaFormat } from '../../utils/nairaFormat'
import './style.scss'
import NavButton from '../../components/button/NavButton'
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import Loading from '../../components/loader/Loading'
import PowerComponent from '../../components/powerComponents/PowerComponent'
import MobileTopUpViewComponents from './components/MobileTopUpViewComponent'
import { MdAddCard, MdOutlineSell } from 'react-icons/md'
import { PiHandWithdraw } from 'react-icons/pi'
import { getRescentPurchaseOrder, repurchaseOrder } from '../../redux/actions/purchasePower'
import { SET_LOADING, toggleShadowMode } from '../../redux/app'
import { useNavigate } from 'react-router-dom'
import AppModal from '../../components/modal/Modal'

import ClassicBtn from '../../components/button/ClassicButton'
import pickColorStyle from '../../utils/slect-color'
import AccountCreationWizard from '../../components/accountCreationWizard/AccountCreationWizard'
import AccountNumbers from '../../components/accountComponents/AccountComponents'
import { createAccount, getAccounts, getUserAccount } from '../../redux/actions/account'
import { userProfile } from '../../redux/actions/auth'

// ✅ Onboarding banner
import OnboardingBanner from '../../components/onboarding/OnboardingBanner'

import { Button, Form } from 'antd'
import FormInput from '../../components/formInput/FormInput'
import CableTvComponent from './components/cable-tv-compoent'
import { FaRegEye, FaRegEyeSlash } from 'react-icons/fa'
import ShadowValue from '../../components/ShadowValue'

// ✅ Toasts
import { toast } from 'react-toastify'

const HomeDashboard = () => {
  const { recentOrders } = useSelector((state) => state.purchase)
  const { wallet, loading } = useSelector((state) => state.wallet)
  const { user } = useSelector((state) => state.auth)
  const { shadowMode } = useSelector((state) => state.app || {})
  const {
    accounts,
    account,
    altBank,
    altAccountNumber,
    loading: accountLoading,
  } = useSelector((state) => state.account)

  const dispatch = useDispatch()
  const navigate = useNavigate()

  const [open, setIsOpen] = useState(false)
  const [openMonify, setIsOpenMonify] = useState(false)
  const [isAncorModal, setIsAncorModal] = useState(false)
  const [openAccount, setIsOpenAccount] = useState(false)
  const [selectedBiller, setSelectedBillier] = useState()
  const [selectedItem, setSelectedItem] = useState('Top Up')
  const [current, setCurrent] = useState(1)
  const [showAccountNumber, setShowAccountNumber] = useState(false)
  const [formData, setFormData] = useState({})
  const [accountDetails, setAccountDetails] = useState(null)

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
    dispatch(getRescentPurchaseOrder())
  }, [dispatch])

  useEffect(() => {
    dispatch(getAccounts())
  }, [dispatch])

  const handleSubmit = (values) => {
    dispatch(SET_LOADING(true))
    dispatch(createAccount({ account: values }))
      .unwrap()
      .then(() => {
        dispatch(userProfile())
        dispatch(SET_LOADING(false))
        setIsOpenMonify(false)
      })
      .catch((error) => {
        dispatch(SET_LOADING(false))
        console.error('Error creating account:', error)
      })
  }

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
  const handleGenerate = (i, data = {}) => {
    const userKyc = (user?.kyc_level || 'nil').toString().toLowerCase()

    // i === 0 => Moniepoint (leave behaviour as-is)
    if (i === 0) {
      setIsOpenMonify(true)
      return
    }

    // i !== 0 => Anchor – require at least Tier 1
    if (['nil', '', 'tier_0'].includes(userKyc)) {
      // 🔔 Explain *why* then redirect to KYC center
      toast.info('Complete Tier 1 verification to generate an Anchor account.', {
        position: 'top-right',
        autoClose: 4000,
        pauseOnHover: true,
      })

      navigate('/dashboard/kyc')
      return
    }

    // Passed KYC gate → open Anchor wizard
    setFormData(data)
    setCurrent(
      data?.status === 'verifying'
        ? 2
        : data?.status === 'unverified'
        ? 1
        : 0
    )
    setIsAncorModal(true)
  }

  const maskAccountNumber = (num) => {
    if (!num) return ''
    return num.replace(/\d(?=\d{4})/g, '•')
  }

  const firstName =
    user?.user_profile?.first_name || user?.email?.split('@')[0] || 'there'

  const balance = wallet?.balance ?? 0

  return (
    <>
      <div className="homeDashboard min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
        {/* ✅ Smart onboarding banner, driven by backend fields */}
        <OnboardingBanner
          stage={user?.onboarding_stage}
          primaryUseCase={user?.primary_use_case}
          hasVirtualAccount={Boolean(accounts?.length)}
          onContinueClick={() => navigate('/dashboard/kyc')}
        />

        {/* Top: welcome + balance chip + quick actions */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-1">
              Dashboard
            </p>
            <h2 className="text-2xl md:text-3xl font-semibold">
              Hi, {firstName} 👋
            </h2>
            <p className="mt-1 text-sm text-slate-400 max-w-xl">
              Welcome back to BitBridge. Top up, pay bills, and manage your
              virtual accounts in one place.
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-3">
            <div className="inline-flex items-center gap-3 rounded-full bg-slate-900/80 border border-slate-700 px-4 py-2">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  Wallet balance
                </span>
                {loading ? (
                  <div className="pt-1">
                    <Loading />
                  </div>
                ) : (
                  <span className="text-lg md:text-xl font-semibold">
                    <ShadowValue>{nairaFormat(balance, 'ngn')}</ShadowValue>
                  </span>
                )}
              </div>
            </div>

            <div className="inline-flex items-center gap-2 text-xs text-slate-300">
              <TrophyOutlined className="text-yellow-500" />
              <span>
                Commission earned:{' '}
                <span className="font-semibold text-emerald-400">
                  <ShadowValue>
                    {nairaFormat(wallet?.commission ?? 0, 'ngn')}
                  </ShadowValue>
                </span>
              </span>
            </div>

            {/* 🔒 Hide mode toggle */}
            <div className="inline-flex items-center gap-2 text-xs text-slate-300">
              <button
                type="button"
                onClick={() => dispatch(toggleShadowMode())}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-700 text-[11px] text-slate-200 hover:border-alt/70 transition-colors"
              >
                {shadowMode ? (
                  <EyeOutlined className="text-alt" />
                ) : (
                  <EyeInvisibleOutlined className="text-alt" />
                )}
                <span>{shadowMode ? 'Show balances' : 'Hide balances'}</span>
              </button>
            </div>

            {/* Quick actions */}
            <div className="flex flex-wrap gap-2 mt-1">
              <button
                type="button"
                onClick={() => navigate('/dashboard/wallet')}
                className="px-3 py-1.5 text-xs rounded-full bg-alt/90 text-black font-medium hover:bg-alt transition-colors"
              >
                Fund wallet
              </button>
              <button
                type="button"
                onClick={() => setSelectedItem('Top Up')}
                className="px-3 py-1.5 text-xs rounded-full bg-slate-900 border border-slate-700 text-slate-200 hover:border-alt/70 transition-colors"
              >
                Buy airtime / data
              </button>
              <button
                type="button"
                onClick={() => setSelectedItem('Electric Bills')}
                className="px-3 py-1.5 text-xs rounded-full bg-slate-900 border border-slate-700 text-slate-200 hover:border-alt/70 transition-colors"
              >
                Pay electricity
              </button>
            </div>
          </div>
        </div>

        {/* Second: service launcher cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <button
            type="button"
            onClick={() => setSelectedItem('Top Up')}
            className="group text-left bg-slate-900 rounded-2xl border border-slate-800 p-4 hover:border-alt/70 hover:bg-slate-900/80 transition-colors"
          >
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/20 text-sky-300 mb-3">
              <MdAddCard />
            </div>
            <h3 className="font-semibold text-sm mb-1">Airtime & Data</h3>
            <p className="text-xs text-slate-400">
              Top up MTN, GLO and more in seconds.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedItem('Electric Bills')}
            className="group text-left bg-slate-900 rounded-2xl border border-slate-800 p-4 hover:border-alt/70 hover:bg-slate-900/80 transition-colors"
          >
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/20 text-amber-300 mb-3">
              <PiHandWithdraw />
            </div>
            <h3 className="font-semibold text-sm mb-1">Electricity</h3>
            <p className="text-xs text-slate-400">
              Pay your power bills across major DISCOs.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedItem('TV Subscription')}
            className="group text-left bg-slate-900 rounded-2xl border border-slate-800 p-4 hover:border-alt/70 hover:bg-slate-900/80 transition-colors"
          >
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-fuchsia-500/20 text-fuchsia-300 mb-3">
              <MdOutlineSell />
            </div>
            <h3 className="font-semibold text-sm mb-1">Cable TV</h3>
            <p className="text-xs text-slate-400">
              Renew DSTV, GOTV and others with a few taps.
            </p>
          </button>

          <button
            type="button"
            onClick={() => navigate('/dashboard/virtual-account')}
            className="group text-left bg-slate-900 rounded-2xl border border-slate-800 p-4 hover:border-alt/70 hover:bg-slate-900/80 transition-colors"
          >
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 mb-3">
              <span className="text-xs font-bold">VA</span>
            </div>
            <h3 className="font-semibold text-sm mb-1">Virtual accounts</h3>
            <p className="text-xs text-slate-400">
              Receive transfers into BitBridge via Anchor / Moniepoint.
            </p>
          </button>
        </div>

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
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 lg:p-6">
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
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 lg:p-6 min-h-[260px]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <h4 className="text-alt md:text-2xl text-lg font-medium">
              {label}
            </h4>
            <ul className="flex flex-wrap gap-2">
              {items.map((item) => (
                <li key={item.label}>
                  <NavButton
                    onClick={() => setSelectedItem(item.name)}
                    className={`${
                      selectedItem === item.name && 'active'
                    } block py-1.5 px-3 rounded-xl text-xs md:text-sm`}
                  >
                    {item.btn}
                  </NavButton>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-center items-center h-full">
            {items.map((item) =>
              item.name === selectedItem ? (
                <div key={item.name} className="w-full">
                  {item.render}
                </div>
              ) : null
            )}
          </div>
        </div>
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
        />
      </AppModal>

      {/* Monnify / Moniepoint account creation */}
      <AppModal
        title={'Create Account Number'}
        handleCancel={() => setIsOpenMonify(false)}
        isModalOpen={openMonify}
      >
        <Form
          layout="vertical"
          initialValues={{
            bvn: '',
            currency: 'ngn',
            vendor: 'moniepoint',
            account_name: '',
          }}
          onFinish={(values) => {
            handleSubmit({ ...values, currency: 'ngn', vendor: 'moniepoint' })
          }}
        >
          <FormInput
            required={true}
            className="add-fund"
            name="bvn"
            type="text"
            label={`BVN`}
          />

          <Form.Item label={null}>
            <Button
              className="border-alt m-auto block w-full h-12 md:h-14 bg-primary text-white rounded-lg border shadow-md font-medium text-lg"
              type="primary"
              htmlType="submit"
            >
              Generate Account
            </Button>
          </Form.Item>
        </Form>
      </AppModal>
    </>
  )
}

export default HomeDashboard
