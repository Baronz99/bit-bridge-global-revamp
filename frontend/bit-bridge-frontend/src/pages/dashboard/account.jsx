import { TransactionOutlined, WalletOutlined } from '@ant-design/icons'
import { nairaFormat } from '../../utils/nairaFormat'
import AppModal from '../../components/modal/Modal'
import { useEffect, useMemo, useRef, useState } from 'react'
import AddFund from '../../components/addFund/AddFund'
import { useDispatch, useSelector } from 'react-redux'
import { createTransaction, initializeMonifyPayment } from '../../redux/actions/transaction'
import { RiUserReceived2Line } from 'react-icons/ri'
import dateFormater from '../../utils/dateFormat'
import { getWallet } from '../../redux/actions/wallet'
import { SET_LOADING } from '../../redux/app'
import PropTypes from 'prop-types'
import statusStyleCard from '../../utils/statusCard'
import MoneyTransferFlow from '../../components/fundTransfer/FundTransfer'
import { getBankList } from '../../redux/actions/account'
import { NavLink, useSearchParams } from 'react-router-dom'
import ShadowValue from '../../components/ShadowValue'
import { toast } from 'react-toastify'

// NEW
import {
  activateTunnelWallet,
  convertNgnToUsd,
  convertUsdToNgn,
  getUserTransactions,
  quoteNgnToUsd,
  quoteUsdToNgn,
} from '../../api/wallets'

const MODES = {
  BRIDGE: 'bridge',
  TUNNEL: 'tunnel',
}

const usdFormat = (n) => {
  const v = Number(n || 0)
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const Account = () => {
  const formRef = useRef(null)
  const dispatch = useDispatch()

  const { user } = useSelector((state) => state.auth)
  const { data } = useSelector((state) => state.wallet)
const wallet = data?.bridge
const tunnelWallet = data?.tunnel


  const [searchParams, setSearchParams] = useSearchParams()
  const urlMode = (searchParams.get('mode') || MODES.BRIDGE).toLowerCase()
  const initialMode = urlMode === MODES.TUNNEL ? MODES.TUNNEL : MODES.BRIDGE
  const [mode, setMode] = useState(initialMode)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isfundTransferOpen, setIsfundTransferOpen] = useState(false)
  const [isWithdrawModalOpened, setIsWithdrawalModalOpen] = useState(false)

  // Tunnel state
  const [usdWallet, setUsdWallet] = useState(null)
  const [usdTx, setUsdTx] = useState([])
  const [tunnelLoading, setTunnelLoading] = useState(false)

  // Convert modal
  const [isConvertOpen, setIsConvertOpen] = useState(false)
  const [convertAmount, setConvertAmount] = useState('')
  const [convertPin, setConvertPin] = useState('')
  const [convertQuote, setConvertQuote] = useState(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [convertDirection, setConvertDirection] = useState('ngn_to_usd')

  const address = 'Card Transfer'
  const coinType = 'bank'

  const isTunnel = mode === MODES.TUNNEL

  // Keep mode synced with URL
  useEffect(() => {
    const normalized = urlMode === MODES.TUNNEL ? MODES.TUNNEL : MODES.BRIDGE
    setMode(normalized)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlMode])

  const setModeAndUrl = (nextMode) => {
    const normalized = nextMode === MODES.TUNNEL ? MODES.TUNNEL : MODES.BRIDGE
    setMode(normalized)
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      if (normalized === MODES.TUNNEL) p.set('mode', MODES.TUNNEL)
      else p.delete('mode')
      return p
    })
  }

  useEffect(() => {
    dispatch(getBankList())
  }, [dispatch])

  // Fetch tunnel wallet + USD transactions when in Tunnel mode
  useEffect(() => {
    const run = async () => {
      if (!isTunnel) return
      setTunnelLoading(true)
      try {
        // activate returns wallet
        const w = await activateTunnelWallet()
        const wData = w?.data?.data || w?.data?.wallet || w?.data?.data?.data || w?.data
        // your backend response in pasted code:
        // { message, data: WalletSerializer.new(usd_wallet).as_json }
        setUsdWallet(w?.data?.data || wData)

        // fetch USD transactions
        const txRes = await getUserTransactions({ wallet_type: 'usd' })
        const txData = txRes?.data?.data || []
        setUsdTx(Array.isArray(txData) ? txData : txData?.data || [])
      } catch (e) {
        toast.error(e?.response?.data?.message || 'Failed to load Tunnel wallet')
      } finally {
        setTunnelLoading(false)
      }
    }
    run()
  }, [isTunnel])

  // Bridge funding (Monnify) unchanged
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
        window.location.href = result.payload.responseBody.checkoutUrl
      } else {
        dispatch(SET_LOADING(false))
      }
    })
  }

  // Bridge withdrawal unchanged
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

  // Tunnel convert
  const openConvert = () => {
    setConvertDirection(isTunnel ? 'usd_to_ngn' : 'ngn_to_usd')
    setIsConvertOpen(true)
  }

  const doConvert = async () => {
    const amount = Number(convertAmount || 0)
    const pin = String(convertPin || '').trim()

    if (!amount || amount <= 0) {
      return toast.error(
        `Enter a valid ${convertDirection === 'usd_to_ngn' ? 'USD' : 'NGN'} amount`
      )
    }
    if (!/^\d{4}$/.test(pin)) return toast.error('PIN must be 4 digits')

    setTunnelLoading(true)
    try {
      let res
      if (convertDirection === 'usd_to_ngn') {
        res = await convertUsdToNgn({ amount_usd: amount, transaction_pin: pin })
      } else {
        res = await convertNgnToUsd({ amount_ngn: amount, transaction_pin: pin })
      }
      toast.success(res?.data?.message || 'Conversion successful')

      // refresh Bridge wallet + Tunnel wallet + USD tx
      dispatch(getWallet())
      const w = await activateTunnelWallet()
      setUsdWallet(w?.data?.data)

      const txRes = await getUserTransactions({ wallet_type: 'usd' })
      const txData = txRes?.data?.data || []
      setUsdTx(Array.isArray(txData) ? txData : txData?.data || [])

      setIsConvertOpen(false)
      setConvertAmount('')
      setConvertPin('')
      setConvertQuote(null)
      setConvertDirection('ngn_to_usd')
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Conversion failed')
    } finally {
      setTunnelLoading(false)
    }
  }

  useEffect(() => {
    const amount = Number(convertAmount || 0)
    if (!isConvertOpen || !amount || amount <= 0) {
      setConvertQuote(null)
      return
    }

    let cancelled = false
    const timer = setTimeout(async () => {
      setQuoteLoading(true)
      try {
        const res =
          convertDirection === 'usd_to_ngn'
            ? await quoteUsdToNgn({ amount_usd: amount })
            : await quoteNgnToUsd({ amount_ngn: amount })
        if (!cancelled) setConvertQuote(res?.data?.data || null)
      } catch (e) {
        if (!cancelled) setConvertQuote(null)
      } finally {
        if (!cancelled) setQuoteLoading(false)
      }
    }, 400)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [convertAmount, isConvertOpen, convertDirection])

  const balance = wallet?.balance ?? 0
  const usdBalance = usdWallet?.balance ?? 0

  const pageShellClass = useMemo(() => {
    return 'min-h-screen w-full bg-slate-950 text-slate-100 p-4 md:p-6'
  }, [])

  const headerChipClass = useMemo(() => {
    return isTunnel
      ? 'inline-flex items-center gap-2 rounded-xl bg-slate-900/80 border border-orange-700/40 px-3 py-2 text-xs text-slate-200'
      : 'inline-flex items-center gap-2 rounded-xl bg-slate-900/80 border border-slate-700 px-3 py-2 text-xs text-slate-300'
  }, [isTunnel])

  const heroCardClass = useMemo(() => {
    return isTunnel
      ? 'relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-900 via-slate-950 to-slate-900 border border-orange-800/40 shadow-xl p-6 md:p-8'
      : 'relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-slate-950 to-slate-900 border border-slate-800 shadow-xl p-6 md:p-8'
  }, [isTunnel])

  const modePillClass = useMemo(() => {
    return isTunnel
      ? 'px-3 py-1 rounded-full bg-black/40 border border-orange-700/40 text-[11px] text-slate-200'
      : 'px-3 py-1 rounded-full bg-black/40 border border-slate-600 text-[11px] text-slate-200'
  }, [isTunnel])

  const activeCurrencyLabel = isTunnel ? 'USD - Tunnel' : 'NGN - Bridge'

  const txList = isTunnel ? usdTx : wallet?.transactions

  return (
    <>
      <div className={pageShellClass}>
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              {isTunnel ? 'Tunnel Wallet (USD) & Activity' : 'Wallet & Activity'}
            </h1>
            <p className="mt-1 text-sm text-slate-400 max-w-xl">
              {isTunnel
                ? 'Your Tunnel view: real USD wallet balance + conversion.'
                : 'View your Naira wallet, fund or withdraw, and track every transaction.'}
            </p>

            {/* Mode switch */}
            <div className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-slate-900/60 border border-slate-800 p-1">
              <button
                type="button"
                onClick={() => setModeAndUrl(MODES.BRIDGE)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  !isTunnel ? 'bg-slate-800 text-slate-100' : 'text-slate-300 hover:text-slate-100'
                }`}
                aria-pressed={!isTunnel}
              >
                Bridge (NGN)
              </button>
              <button
                type="button"
                onClick={() => setModeAndUrl(MODES.TUNNEL)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  isTunnel ? 'bg-orange-600 text-black' : 'text-slate-300 hover:text-slate-100'
                }`}
                aria-pressed={isTunnel}
              >
                Tunnel (USD)
              </button>
            </div>
          </div>

          <div className={headerChipClass}>
            <WalletOutlined />
            <span>
              {isTunnel ? (
                <>
                  USD balance:{' '}
                  <span className="font-semibold text-orange-300">
                    <ShadowValue placeholder="***">
                      USD {usdFormat(usdBalance)}
                    </ShadowValue>
                  </span>
                </>
              ) : (
                <>
                  NGN balance:{' '}
                  <span className="font-semibold text-emerald-400">
                    <ShadowValue>{nairaFormat(balance, 'ngn')}</ShadowValue>
                  </span>
                </>
              )}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)] gap-6">
          {/* LEFT */}
          <div className="space-y-6">
            {/* Hero */}
            <div className={heroCardClass}>
              {isTunnel ? (
                <>
                  <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-orange-600/25 blur-3xl" />
                  <div className="absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-amber-500/15 blur-3xl" />
                </>
              ) : (
                <>
                  <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-indigo-700/30 blur-3xl" />
                  <div className="absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-emerald-600/20 blur-3xl" />
                </>
              )}

              <div className="relative flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300/80">
                      {isTunnel ? 'Tunnel Wallet' : 'Naira Wallet'}
                    </p>
                    <h2 className="mt-1 text-sm text-slate-100">
                      {user?.user_profile
                        ? `${user.user_profile.first_name} ${user.user_profile.last_name}`
                        : user?.email}
                    </h2>
                  </div>
                  <div className={modePillClass}>{activeCurrencyLabel}</div>
                </div>

                <div className="mt-2">
                  <p className="text-xs text-slate-400 mb-1">Available balance</p>

                  <div className="text-3xl md:text-4xl font-semibold">
                    {isTunnel ? (
                      <ShadowValue placeholder="***">USD {usdFormat(usdBalance)}</ShadowValue>
                    ) : (
                      <ShadowValue>{nairaFormat(balance, 'ngn')}</ShadowValue>
                    )}
                  </div>

                  {!isTunnel ? (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={openConvert}
                        disabled={tunnelLoading}
                        className="px-4 py-2 rounded-xl bg-indigo-500 text-white text-xs font-semibold hover:bg-indigo-400 disabled:opacity-60"
                      >
                        Convert NGN to USD
                      </button>

                      <span className="text-xs text-slate-400">
                        Conversion requires your transaction PIN.
                      </span>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={openConvert}
                        disabled={tunnelLoading}
                        className="px-4 py-2 rounded-xl bg-orange-500 text-black text-xs font-semibold hover:bg-orange-400 disabled:opacity-60"
                      >
                        Convert USD to NGN
                      </button>

                      <span className="text-xs text-slate-400">
                        Conversion requires your transaction PIN.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Transactions */}
            <div className="px-2 lg:px-5 lg:py-6 bg-slate-900 rounded-2xl border border-slate-800 text-white overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">
                    {isTunnel ? 'Transaction History (USD)' : 'Transaction History (NGN)'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isTunnel ? 'Your USD wallet ledger' : 'Deposits, withdrawals and wallet movements.'}
                  </p>
                </div>
                <NavLink
                  to={isTunnel ? '/dashboard/transactions?wallet_type=usd' : '/dashboard/transactions?wallet_type=ngn'}
                  className={isTunnel ? 'text-xs text-orange-300 hover:text-orange-200' : 'text-xs text-indigo-300 hover:text-indigo-200'}
                >
                  View all
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
                              <th className="sticky top-0 z-10 border-b border-slate-600/50 py-3.5 pl-4 pr-3 text-left text-[11px] font-semibold text-slate-300 uppercase sm:pl-6">
                                Transaction
                              </th>
                              <th className="sticky top-0 z-10 border-b border-slate-600/50 py-3.5 px-3 text-center text-[11px] font-semibold text-slate-300 uppercase">
                                Status
                              </th>
                              <th className="sticky top-0 z-10 border-b border-slate-600/50 px-3 py-3.5 text-center text-[11px] font-semibold text-slate-300 uppercase">
                                Amount
                              </th>
                              <th className="sticky top-0 z-10 border-b border-slate-600/50 px-3 py-3.5 text-left text-[11px] font-semibold text-slate-300 uppercase">
                                Time
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {txList?.length ? (
                              txList.map((item) => (
                                <tr key={item?.id} className="bg-slate-950">
                                  <td className="whitespace-nowrap border-b border-slate-800 py-2 pl-4 pr-3 text-sm font-normal sm:pl-6">
                                    <p className="text-slate-200 leading-5 capitalize font-semibold">
                                      {item.transaction_type}
                                    </p>
                                    <p className="text-[11px] text-slate-500">
                                      {item.reference || item.description || item.address || ''}
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
                                      {isTunnel ? `USD ${usdFormat(item.amount)}` : nairaFormat(item.amount, 'ngn')}
                                    </ShadowValue>
                                  </td>

                                  <td className="whitespace-nowrap border-b border-slate-800 px-3 py-3 text-sm text-slate-300 text-left">
                                    {dateFormater(item?.created_at)}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={4} className="py-8 text-center text-sm text-slate-500">
                                  {tunnelLoading ? 'Loading...' : 'No transactions yet.'}
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

          {/* RIGHT SIDE */}
          <div className="bg-slate-900 rounded-2xl md:p-8 p-5 hidden md:flex flex-col justify-between border border-slate-800">
            <div className="min-h-[260px] flex flex-col justify-between">
              <div className="mb-4">
                <h3 className="text-sm font-semibold mb-1">Quick actions</h3>
                <p className="text-xs text-slate-400">
                  {isTunnel
                    ? 'Tunnel actions: conversion + USD layer.'
                    : 'Fund your wallet, withdraw to bank or send money instantly.'}
                </p>
              </div>

              <TransactionComp
                mode={mode}
                setIsfundTransferOpen={setIsfundTransferOpen}
                setIsModalOpen={setIsModalOpen}
                setIsWithdrawalModalOpen={setIsWithdrawalModalOpen}
            onOpenConvert={openConvert}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bridge modals (unchanged) */}
      <AppModal title={'Fund Wallet'} isModalOpen={isModalOpen} handleCancel={() => setIsModalOpen(false)}>
        <AddFund handleSubmit={handleSubmit} coin_type={coinType} address={address} ref={formRef} />
      </AppModal>

      <AppModal title={'Withdraw Funds'} isModalOpen={isWithdrawModalOpened} handleCancel={() => setIsWithdrawalModalOpen(false)}>
        <AddFund
          handleSubmit={handleWithdrawalSubmit}
          coin_type={coinType}
          disableAddress={false}
          transaction_type="withdrawal"
          ref={formRef}
          address={address}
        />
      </AppModal>

      <AppModal handleCancel={() => setIsfundTransferOpen(false)} title={'Send Money'} isModalOpen={isfundTransferOpen}>
        <MoneyTransferFlow setIsfundTransferOpen={setIsfundTransferOpen} />
      </AppModal>

      {/* Tunnel conversion modal */}
      <AppModal title={'Convert'} isModalOpen={isConvertOpen} handleCancel={() => setIsConvertOpen(false)}>
        <div className="space-y-3">
          <div className="text-xs text-slate-300">
            {convertDirection === 'usd_to_ngn' ? (
              <>
                Tunnel balance:{' '}
                <span className="font-semibold text-orange-300">USD {usdFormat(usdBalance)}</span>
              </>
            ) : (
              <>
                Bridge balance:{' '}
                <span className="font-semibold text-emerald-300">{nairaFormat(balance, 'ngn')}</span>
              </>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConvertDirection('ngn_to_usd')}
              className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold ${
                convertDirection === 'ngn_to_usd'
                  ? 'border-orange-500 bg-orange-500 text-black'
                  : 'border-slate-700 bg-slate-950 text-slate-200'
              }`}
            >
              NGN -> USD
            </button>
            <button
              type="button"
              onClick={() => setConvertDirection('usd_to_ngn')}
              className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold ${
                convertDirection === 'usd_to_ngn'
                  ? 'border-orange-500 bg-orange-500 text-black'
                  : 'border-slate-700 bg-slate-950 text-slate-200'
              }`}
            >
              USD -> NGN
            </button>
          </div>

          <label className="block text-xs text-slate-300">
            Amount ({convertDirection === 'usd_to_ngn' ? 'USD' : 'NGN'})
          </label>
          <input
            value={convertAmount}
            onChange={(e) => setConvertAmount(e.target.value)}
            className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
            placeholder={convertDirection === 'usd_to_ngn' ? '25' : '15000'}
            inputMode="decimal"
          />

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-300">
            {quoteLoading ? (
              <p>Fetching live rate...</p>
            ) : convertQuote ? (
              <div className="space-y-1">
                <p>
                  Rate: 1 {convertQuote.from} = {Number(convertQuote.rate || 0).toFixed(6)}{' '}
                  {convertQuote.to}
                </p>
                <p>
                  Fee: {convertQuote.fee_currency === 'USD'
                    ? `USD ${Number(convertQuote.fee || 0).toFixed(2)}`
                    : nairaFormat(convertQuote.fee || 0, 'ngn')}
                </p>
                <p className="text-slate-100">
                  You receive:{' '}
                  {convertQuote.to === 'USD'
                    ? `USD ${Number(convertQuote.amount_usd || 0).toFixed(2)}`
                    : nairaFormat(convertQuote.amount_ngn || 0, 'ngn')}
                </p>
              </div>
            ) : (
              <p>Enter an amount to see the rate and fee.</p>
            )}
          </div>

          <label className="block text-xs text-slate-300">Transaction PIN</label>
          <input
            value={convertPin}
            onChange={(e) => setConvertPin(e.target.value)}
            className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
            placeholder="****"
            inputMode="numeric"
            type="password"
            maxLength={4}
          />

          <button
            type="button"
            onClick={doConvert}
            disabled={tunnelLoading}
            className="w-full mt-2 px-4 py-2 rounded-xl bg-orange-500 text-black text-sm font-semibold hover:bg-orange-400 disabled:opacity-60"
          >
            {tunnelLoading ? 'Converting...' : 'Convert'}
          </button>
        </div>
      </AppModal>
    </>
  )
}

const TransactionComp = ({
  mode,
  setIsModalOpen,
  setIsWithdrawalModalOpen,
  setIsfundTransferOpen,
  onOpenConvert,
}) => {
  const isTunnel = mode === MODES.TUNNEL

  return (
    <div className="text-white flex justify-between gap-6 bg-transparent px-3">
      {!isTunnel ? (
        <>
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

          <button
            type="button"
            onClick={onOpenConvert}
            className="flex flex-col items-center justify-center gap-1 text-purple-300 hover:text-alt cursor-pointer"
            title="Convert NGN to USD"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-purple-900/40 border border-purple-600/60">
              <WalletOutlined />
            </span>
            <span className="text-[11px] text-center">Convert</span>
          </button>

        </>
      ) : (
        <>
          <button
            type="button"
            disabled
            className="flex flex-col items-center justify-center gap-1 text-orange-200/70 cursor-not-allowed"
            title="Next: Fund USD wallet"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-orange-900/30 border border-orange-700/40">
              <RiUserReceived2Line />
            </span>
            <span className="text-[11px] text-center">Fund USD</span>
          </button>

          <button
            type="button"
            className="flex flex-col items-center justify-center gap-1 text-orange-200 hover:text-orange-100 cursor-pointer"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-orange-900/30 border border-orange-700/40">
              <TransactionOutlined />
            </span>
            <NavLink to="/dashboard/virtual-cards" className="text-[11px] text-center">
              Virtual Card
            </NavLink>
          </button>

          <button
            type="button"
            className="flex flex-col items-center justify-center gap-1 text-orange-200 hover:text-orange-100 cursor-pointer"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-orange-900/30 border border-orange-700/40">
              <RiUserReceived2Line />
            </span>
            <NavLink to="/dashboard/virtual-cards" className="text-[11px] text-center">
              Card Actions
            </NavLink>
          </button>
        </>
      )}
    </div>
  )
}

TransactionComp.propTypes = {
  mode: PropTypes.string,
  setIsModalOpen: PropTypes.func,
  setIsWithdrawalModalOpen: PropTypes.func,
  setIsfundTransferOpen: PropTypes.func,
  onOpenConvert: PropTypes.func,
}

export default Account
