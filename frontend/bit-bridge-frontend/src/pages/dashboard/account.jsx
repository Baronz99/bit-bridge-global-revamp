import { TransactionOutlined, WalletOutlined } from '@ant-design/icons'
import { nairaFormat } from '../../utils/nairaFormat'
import AppModal from '../../components/modal/Modal'
import { useEffect, useRef, useState } from 'react'
import AddFund from '../../components/addFund/AddFund'
import { useDispatch, useSelector } from 'react-redux'
import { createTransaction, initializeMonifyPayment } from '../../redux/actions/transaction'
import { RiUserReceived2Line } from 'react-icons/ri'
import { converter } from '../../api/currencyConverter'
import dateFormater from '../../utils/dateFormat'
import { getWallet } from '../../redux/actions/wallet'
import { SET_LOADING } from '../../redux/app'
import PropTypes from 'prop-types'
import statusStyleCard from '../../utils/statusCard'
import MoneyTransferFlow from '../../components/fundTransfer/FundTransfer'
import { getBankList } from '../../redux/actions/account'
import { NavLink } from 'react-router-dom'
import ShadowValue from '../../components/ShadowValue'

const Account = () => {
  const formRef = useRef(null)
  const { user } = useSelector((state) => state.auth)
  const { wallet } = useSelector((state) => state.wallet)

  const [convertedAmount, setConvertedAmount] = useState(null)
  const address = 'Card Transfer'
  const coinType = 'bank'

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isfundTransferOpen, setIsfundTransferOpen] = useState(false)
  const [isWithdrawModalOpened, setIsWithdrawalModalOpen] = useState(false)

  const dispatch = useDispatch()

  // NGN → USD approximate conversion
  useEffect(() => {
    const fetchConversion = async () => {
      if (!wallet?.balance) {
        setConvertedAmount(null)
        return
      }

      const result = await converter({
        fromCurr: 'ngn',
        toCurr: 'usd',
        amount: wallet.balance,
      })

      setConvertedAmount(result)
    }

    fetchConversion()
  }, [wallet?.balance])

  useEffect(() => {
    dispatch(getBankList())
  }, [dispatch])

  const handleSubmit = (values) => {
    dispatch(SET_LOADING(true))

    const redirectUrl =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:5173/checkout'
        : 'https://bitbridgeglobal.com/checkout'

    dispatch(
      initializeMonifyPayment({
        ...values,
        transaction_type: 'deposit',
        currency: 'NGN',
        email: user.email,
        customer_name: user.email,
        description: 'Fund Wallet',
        payment_purpose: 'Fund Wallet',
        redirect_url: redirectUrl,
      })
    ).then((result) => {
      if (initializeMonifyPayment.fulfilled.match(result)) {
        // Redirect to Monnify checkout
        window.location.href = result.payload.responseBody.checkoutUrl
      } else {
        dispatch(SET_LOADING(false))
      }
    })
  }

  const handleWithdrawalSubmit = (values) => {
    dispatch(SET_LOADING(true))
    dispatch(
      createTransaction({
        ...values,
        transaction_type: 'withdrawal',
        status: 'pending',
      })
    ).then((result) => {
      if (createTransaction.fulfilled.match(result)) {
        setIsWithdrawalModalOpen(false)
        dispatch(SET_LOADING(false))
        dispatch(getWallet())
        formRef.current?.resetForm()
      } else {
        dispatch(SET_LOADING(false))
      }
    })
  }

  const balance = wallet?.balance ?? 0

  return (
    <>
      <div className="min-h-screen w-full bg-slate-950 text-slate-100 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Wallet & Activity
            </h1>
            <p className="mt-1 text-sm text-slate-400 max-w-xl">
              View your Naira wallet, fund or withdraw, and track every transaction in one place.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-xl bg-slate-900/80 border border-slate-700 px-3 py-2 text-xs text-slate-300">
            <WalletOutlined />
            <span>
              Available balance:{' '}
              <span className="font-semibold text-emerald-400">
                <ShadowValue>{nairaFormat(balance, 'ngn')}</ShadowValue>
              </span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)] gap-6">
          {/* LEFT SIDE: Wallet card + history */}
          <div className="space-y-6">
            {/* Wallet hero card */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-slate-950 to-slate-900 border border-slate-800 shadow-xl p-6 md:p-8">
              <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-indigo-700/30 blur-3xl" />
              <div className="absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-emerald-600/20 blur-3xl" />

              <div className="relative flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300/80">
                      Naira Wallet
                    </p>
                    <h2 className="mt-1 text-sm text-slate-100">
                      {user?.user_profile
                        ? `${user.user_profile.first_name} ${user.user_profile.last_name}`
                        : user?.email}
                    </h2>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-black/40 border border-slate-600 text-[11px] text-slate-200">
                    NGN • Active
                  </div>
                </div>

                <div className="mt-2">
                  <p className="text-xs text-slate-400 mb-1">Available balance</p>
                  <div className="text-3xl md:text-4xl font-semibold">
                    <ShadowValue>{nairaFormat(balance, 'ngn')}</ShadowValue>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    ≈ USD{' '}
                    <ShadowValue placeholder="•••">
                      {convertedAmount?.calc ?? '0.00'}
                    </ShadowValue>
                  </p>
                </div>
              </div>
            </div>

            {/* Mobile quick actions */}
            <div className="bg-slate-900 rounded-2xl md:p-6 p-4 block md:hidden border border-slate-800">
              <h3 className="text-sm font-semibold mb-4">Quick actions</h3>
              <div className="min-h-[120px] flex items-center justify-center">
                <TransactionComp
                  setIsfundTransferOpen={setIsfundTransferOpen}
                  setIsModalOpen={setIsModalOpen}
                  setIsWithdrawalModalOpen={setIsWithdrawalModalOpen}
                />
              </div>
            </div>

            {/* Transaction history */}
            <div className="px-2 lg:px-5 lg:py-6 bg-slate-900 rounded-2xl border border-slate-800 text-white overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">
                    Transaction History (NGN)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Deposits, withdrawals and other wallet movements.
                  </p>
                </div>
                <NavLink
                  to="/dashboard/transactions"
                  className="text-xs text-indigo-300 hover:text-indigo-200"
                >
                  View all →
                </NavLink>
              </div>

              <div className="h-[450px] overflow-y-auto">
                <div className="px-2 sm:px-4 lg:px-0">
                  <div className="mt-2 flow-root">
                    <div className="-mx-2 -my-2 sm:-mx-4 lg:-mx-4">
                      <div className="inline-block min-w-full py-2 align-middle">
                        <table className="min-w-full border border-slate-700 rounded-md border-separate border-spacing-0 table-auto overflow-hidden">
                          <thead className="bg-slate-800/80">
                            <tr>
                              <th
                                scope="col"
                                className="sticky top-0 z-10 border-b border-slate-600/50 bg-opacity-75 py-3.5 pl-4 pr-3 text-left text-[11px] font-semibold text-slate-300 uppercase backdrop-blur backdrop-filter sm:pl-6 lg:pl-6"
                              >
                                Transaction
                              </th>
                              <th
                                scope="col"
                                className="sticky top-0 z-10 border-b border-slate-600/50 bg-opacity-75 py-3.5 px-3 text-center text-[11px] font-semibold text-slate-300 uppercase backdrop-blur backdrop-filter"
                              >
                                Status
                              </th>
                              <th
                                scope="col"
                                className="sticky top-0 z-10 border-b border-slate-600/50 bg-opacity-75 px-3 py-3.5 text-center text-[11px] font-semibold text-slate-300 uppercase backdrop-blur backdrop-filter"
                              >
                                Amount
                              </th>
                              <th
                                scope="col"
                                className="sticky top-0 z-10 border-b border-slate-600/50 bg-opacity-75 px-3 py-3.5 text-left text-[11px] font-semibold text-slate-300 uppercase backdrop-blur backdrop-filter lg:table-cell"
                              >
                                Time
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {wallet.transactions?.length ? (
                              wallet.transactions.map((item) => (
                                <tr key={item?.id} className="bg-slate-950">
                                  <td className="whitespace-nowrap border-b border-slate-800 py-2 pl-4 pr-3 text-sm font-normal sm:pl-6 lg:pl-6">
                                    <p className="text-slate-200 leading-5 capitalize font-semibold">
                                      {item.transaction_type}
                                    </p>
                                    <p className="text-[11px] text-slate-500">
                                      {item.reference || item.description || ''}
                                    </p>
                                  </td>
                                  <td className="whitespace-nowrap border-b border-slate-800 px-3 py-3 text-sm">
                                    <span
                                      className={`${statusStyleCard(
                                        item?.status
                                      )} py-1 w-full max-w-[200px] block text-center px-3 border rounded-3xl`}
                                    >
                                      {item?.status}
                                    </span>
                                  </td>

                                  <td className="whitespace-nowrap border-b border-slate-800 px-3 py-3 text-sm text-slate-100 text-center font-semibold">
                                    <ShadowValue>
                                      {nairaFormat(item.amount, wallet.wallet_type)}
                                    </ShadowValue>
                                  </td>

                                  <td className="whitespace-nowrap border-b border-slate-800 px-3 py-3 text-sm text-slate-300 text-left">
                                    {dateFormater(item?.created_at)}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td
                                  colSpan={4}
                                  className="py-8 text-center text-sm text-slate-500"
                                >
                                  No transactions yet.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE: Quick actions (desktop) */}
          <div className="bg-slate-900 rounded-2xl md:p-8 p-5 hidden md:flex flex-col justify-between border border-slate-800">
            <div className="min-h-[260px] flex flex-col justify-between">
              <div className="mb-4">
                <h3 className="text-sm font-semibold mb-1">Quick actions</h3>
                <p className="text-xs text-slate-400">
                  Fund your wallet, withdraw to bank or send money instantly.
                </p>
              </div>

              <TransactionComp
                setIsfundTransferOpen={setIsfundTransferOpen}
                setIsModalOpen={setIsModalOpen}
                setIsWithdrawalModalOpen={setIsWithdrawalModalOpen}
              />

              <div className="mt-6 text-xs text-slate-400 space-y-1">
                <p>• Deposits are processed via Monnify. You’ll be redirected to their secure checkout.</p>
                <p>• Withdrawals may require admin approval depending on amount.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fund wallet modal */}
      <AppModal
        title={'Fund Wallet'}
        isModalOpen={isModalOpen}
        handleOk={() => {}}
        handleCancel={() => {
          setIsModalOpen(false)
        }}
      >
        <div className="bg-purple- p-0">
          <AddFund
            handleSubmit={handleSubmit}
            coin_type={coinType}
            address={address}
            ref={formRef}
          />
        </div>
      </AppModal>

      {/* Withdraw funds modal */}
      <AppModal
        title={'Withdraw Funds'}
        isModalOpen={isWithdrawModalOpened}
        handleOk={() => {}}
        handleCancel={() => {
          setIsWithdrawalModalOpen(false)
        }}
      >
        <div className="bg-purple- p-0">
          <AddFund
            handleSubmit={handleWithdrawalSubmit}
            coin_type={coinType}
            disableAddress={false}
            transaction_type="withdrawal"
            ref={formRef}
            address={address}
          />
        </div>
      </AppModal>

      {/* Send money modal */}
      <AppModal
        handleCancel={() => setIsfundTransferOpen(false)}
        title={'Send Money'}
        isModalOpen={isfundTransferOpen}
      >
        <MoneyTransferFlow setIsfundTransferOpen={setIsfundTransferOpen} />
      </AppModal>
    </>
  )
}

const TransactionComp = ({
  setIsModalOpen,
  setIsWithdrawalModalOpen,
  setIsfundTransferOpen,
}) => {
  return (
    <div className="text-white flex justify-between gap-6 bg-transparent px-3">
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex flex-col items-center justify-center gap-1 text-purple-300 hover:text-alt cursor-pointer"
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-purple-900/40 border border-purple-600/60">
          <WalletOutlined />
        </span>
        <span className="text-[11px] text-center">Add Funds</span>
      </button>

      <button
        onClick={() => setIsWithdrawalModalOpen(true)}
        className="flex flex-col items-center justify-center gap-1 text-purple-300 hover:text-alt cursor-pointer"
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-purple-900/40 border border-purple-600/60">
          <RiUserReceived2Line />
        </span>
        <span className="text-[11px] text-center">Withdraw</span>
      </button>

      <button
        onClick={() => setIsfundTransferOpen((prev) => !prev)}
        className="flex flex-col items-center justify-center gap-1 text-purple-300 hover:text-alt cursor-pointer"
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-purple-900/40 border border-purple-600/60">
          <TransactionOutlined />
        </span>
        <span className="text-[11px] text-center">Transfer Funds</span>
      </button>

      <button className="flex flex-col items-center justify-center gap-1 text-purple-300 hover:text-alt cursor-pointer">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-purple-900/40 border border-purple-600/60">
          <RiUserReceived2Line />
        </span>
        <NavLink to="/dashboard/virtual-account" className="text-[11px] text-center">
          Virtual Card
        </NavLink>
      </button>
    </div>
  )
}

TransactionComp.propTypes = {
  setIsModalOpen: PropTypes.func,
  setIsWithdrawalModalOpen: PropTypes.func,
  setIsfundTransferOpen: PropTypes.func,
}

export default Account
