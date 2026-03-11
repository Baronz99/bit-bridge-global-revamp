import { TransactionOutlined, WalletOutlined } from '@ant-design/icons'
import nairaFormat from '../../utils/nairaFormat'
import AppModal from '../../components/modal/Modal'
import { useEffect, useMemo, useRef, useState } from 'react'
import AddFund from '../../components/addFund/AddFund'
import { useDispatch, useSelector } from 'react-redux'
import { initializeMonifyPayment } from '../../redux/actions/transaction'
import { RiUserReceived2Line } from 'react-icons/ri'
import dateFormater from '../../utils/dateFormat'
import { getWallet } from '../../redux/actions/wallet'
import { SET_LOADING } from '../../redux/app'
import PropTypes from 'prop-types'
import statusStyleCard from '../../utils/statusCard'
import MoneyTransferFlow from '../../components/fundTransfer/FundTransfer'
import { getBankList } from '../../redux/actions/account'
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import ShadowValue from '../../components/ShadowValue'
import { toast } from 'react-toastify'
import { needsTier2Access, withTier2MissingDetails } from '../../utils/kycGate'
import { resolveReceiptReference } from '../../utils/receiptReference'

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

const DirectionToggle = ({ value, onChange }) => {
  return (
    <div className="flex items-center gap-1 rounded-full border border-slate-800 bg-slate-950/80 p-1">
      <button
        type="button"
        onClick={() => onChange('ngn_to_usd')}
        className={`flex-1 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition ${
          value === 'ngn_to_usd'
            ? 'bg-orange-500 text-black shadow-[0_0_12px_rgba(249,115,22,0.45)]'
            : 'text-slate-400 hover:text-slate-100'
        }`}
      >
        NGN → USD
      </button>
      <button
        type="button"
        onClick={() => onChange('usd_to_ngn')}
        className={`flex-1 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition ${
          value === 'usd_to_ngn'
            ? 'bg-orange-500 text-black shadow-[0_0_12px_rgba(249,115,22,0.45)]'
            : 'text-slate-400 hover:text-slate-100'
        }`}
      >
        USD → NGN
      </button>
    </div>
  )
}

const QuoteBreakdownCard = ({
  loading,
  error,
  stale,
  quote,
  fromCurrency,
  toCurrency,
  formatAmount,
  onRetry,
}) => {
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
        <p className="text-xs text-slate-400">Fetching live rate...</p>
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-40 rounded bg-slate-800/80" />
          <div className="h-3 w-52 rounded bg-slate-800/60" />
          <div className="h-3 w-44 rounded bg-slate-800/60" />
          <div className="h-3 w-56 rounded bg-slate-800/60" />
          <div className="h-3 w-32 rounded bg-slate-800/60" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-200">
        <p className="font-semibold">Couldn't fetch rate.</p>
        <p className="text-rose-200/80 mt-1">{error}</p>
        <div className="mt-3">
          <button
            type="button"
            onClick={onRetry}
            className="text-[11px] font-semibold text-rose-100 underline underline-offset-2 hover:text-white"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (stale) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-400">
        Updating quote with the latest rate...
      </div>
    )
  }

  if (!quote) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-400">
        Enter an amount to see the live rate and fee breakdown.
      </div>
    )
  }

  const feeAmount = Number(quote?.fee_amount || 0)
  const amountAfterFee = Number(quote?.amount_after_fee || 0)
  const executionRate = Number(quote?.execution_rate || 0)
  const amountOut = Number(quote?.amount_out || 0)
  const asOf = quote?.as_of

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-300 space-y-2">
      <div className="flex items-center justify-between">
        <span>Conversion fee (1%)</span>
        <span className="text-slate-100">- {formatAmount(feeAmount, fromCurrency)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>Amount we'll convert</span>
        <span className="text-slate-100">= {formatAmount(amountAfterFee, fromCurrency)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>Todays rate</span>
        <span className="text-slate-100">1 USD = {executionRate.toFixed(2)} NGN</span>
      </div>
      <div className="flex items-center justify-between text-slate-100 font-semibold">
        <span>You receive</span>
        <span>{formatAmount(amountOut, toCurrency)}</span>
      </div>
      {asOf ? (
        <div className="text-[11px] text-slate-500">As of {new Date(asOf).toLocaleString()}</div>
      ) : null}
    </div>
  )
}

const Account = () => {
  const formRef = useRef(null)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()

  const { user } = useSelector((state) => state.auth)
  const { data } = useSelector((state) => state.wallet)
  const wallet = data?.bridge
  const tunnelWallet = data?.tunnel


  const [searchParams, setSearchParams] = useSearchParams()
  const isFxRoute = location.pathname.endsWith('/dashboard/tunnel/fx')
  const urlMode = (searchParams.get('mode') || MODES.BRIDGE).toLowerCase()
  const initialMode = isFxRoute || urlMode === MODES.TUNNEL ? MODES.TUNNEL : MODES.BRIDGE
  const [mode, setMode] = useState(initialMode)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isfundTransferOpen, setIsfundTransferOpen] = useState(false)

  // Tunnel state
  const [usdWallet, setUsdWallet] = useState(null)
  const [usdTx, setUsdTx] = useState([])
  const [ngnTx, setNgnTx] = useState([])
  const [tunnelLoading, setTunnelLoading] = useState(false)
  const [txLoading, setTxLoading] = useState(false)

  // Convert modal
  const [isConvertOpen, setIsConvertOpen] = useState(false)
  const [convertAmount, setConvertAmount] = useState('')
  const [convertPin, setConvertPin] = useState('')
  const [convertQuote, setConvertQuote] = useState(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState('')
  const [convertLoading, setConvertLoading] = useState(false)
  const [convertDirection, setConvertDirection] = useState('ngn_to_usd')
  const amountInputRef = useRef(null)

  const address = 'Card Transfer'
  const coinType = 'bank'

  const needsTier2 = needsTier2Access(user)

  const isTunnel = mode === MODES.TUNNEL

  // Keep mode synced with URL
  useEffect(() => {
    const normalized = isFxRoute || urlMode === MODES.TUNNEL ? MODES.TUNNEL : MODES.BRIDGE
    if (normalized === MODES.TUNNEL && needsTier2) {
      toast.info(withTier2MissingDetails(user, 'Complete Tier 2 verification to use the Tunnel wallet.'), {
        position: 'top-right',
        autoClose: 4000,
        pauseOnHover: true,
      })
      navigate('/dashboard/kyc')
      setMode(MODES.BRIDGE)
      if (!isFxRoute) {
        setSearchParams((prev) => {
          const p = new URLSearchParams(prev)
          p.delete('mode')
          return p
        })
      }
      return
    }
    setMode(normalized)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFxRoute, urlMode, needsTier2, navigate, setSearchParams])

  const setModeAndUrl = (nextMode) => {
    const normalized = nextMode === MODES.TUNNEL ? MODES.TUNNEL : MODES.BRIDGE
    if (normalized === MODES.TUNNEL && needsTier2) {
      toast.info(withTier2MissingDetails(user, 'Complete Tier 2 verification to use the Tunnel wallet.'), {
        position: 'top-right',
        autoClose: 4000,
        pauseOnHover: true,
      })
      navigate('/dashboard/kyc')
      return
    }
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
      if (needsTier2) return
      setTunnelLoading(true)
      try {
        // activate returns wallet
        const w = await activateTunnelWallet()
        const wData = w?.data?.data || w?.data?.wallet || w?.data?.data?.data || w?.data
        // your backend response in pasted code:
        // { message, data: WalletSerializer.new(usd_wallet).as_json }
        setUsdWallet(w?.data?.data || wData)
      } catch (e) {
        toast.error(e?.response?.data?.message || 'Failed to load Tunnel wallet')
      } finally {
        setTunnelLoading(false)
      }
    }
    run()
  }, [isTunnel, needsTier2])

  // Fetch wallet history from transactions API for both modes.
  useEffect(() => {
    const run = async () => {
      setTxLoading(true)
      try {
        const walletType = isTunnel ? 'usd' : 'ngn'
        const txRes = await getUserTransactions({ wallet_type: walletType })
        const txData = txRes?.data?.data || []
        const normalized = Array.isArray(txData) ? txData : txData?.data || []
        if (isTunnel) setUsdTx(normalized)
        else setNgnTx(normalized)
      } catch (e) {
        toast.error(e?.response?.data?.message || 'Failed to load transaction history')
      } finally {
        setTxLoading(false)
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

  // Tunnel convert
  useEffect(() => {
    if (!isFxRoute || needsTier2) return
    setMode(MODES.TUNNEL)
    setConvertDirection('ngn_to_usd')
    setIsConvertOpen(true)
  }, [isFxRoute, needsTier2])

  const openConvert = () => {
    if (needsTier2) {
      toast.info(withTier2MissingDetails(user, 'Complete Tier 2 verification to use the Tunnel wallet.'), {
        position: 'top-right',
        autoClose: 4000,
        pauseOnHover: true,
      })
      navigate('/dashboard/kyc')
      return
    }
    setConvertDirection(isTunnel ? 'usd_to_ngn' : 'ngn_to_usd')
    setIsConvertOpen(true)
  }

  const handleDirectionChange = (nextDirection) => {
    setConvertDirection(nextDirection)
    setConvertAmount('')
    setConvertPin('')
    setConvertQuote(null)
    setQuoteError('')
    requestAnimationFrame(() => amountInputRef.current?.focus())
  }

  const doConvert = async () => {
    const amount = Number(convertAmount || 0)
    const pin = String(convertPin || '').trim()
    const quoteToken = convertQuote?.quote_token

    if (!amount || amount <= 0) {
      return toast.error(
        `Enter a valid ${convertDirection === 'usd_to_ngn' ? 'USD' : 'NGN'} amount`
      )
    }
    if (!/^[0-9]{4}$/.test(pin)) return toast.error('PIN must be 4 digits')

    setConvertLoading(true)
    try {
      let res
      if (convertDirection === 'usd_to_ngn') {
        res = await convertUsdToNgn({ amount_usd: amount, transaction_pin: pin, quote_token: quoteToken })
      } else {
        res = await convertNgnToUsd({ amount_ngn: amount, transaction_pin: pin, quote_token: quoteToken })
      }
      toast.success(res?.data?.message || res?.message || 'Conversion successful')

      // refresh Bridge wallet + Tunnel wallet + USD tx
      dispatch(getWallet())
      const w = await activateTunnelWallet()
      setUsdWallet(w?.data?.data)
      const [usdRes, ngnRes] = await Promise.all([
        getUserTransactions({ wallet_type: 'usd' }),
        getUserTransactions({ wallet_type: 'ngn' }),
      ])
      const usdData = usdRes?.data?.data || []
      const ngnData = ngnRes?.data?.data || []
      setUsdTx(Array.isArray(usdData) ? usdData : usdData?.data || [])
      setNgnTx(Array.isArray(ngnData) ? ngnData : ngnData?.data || [])

      if (isFxRoute) navigate('/dashboard/tunnel', { replace: true })
      else setIsConvertOpen(false)
      setConvertAmount('')
      setConvertPin('')
      setConvertQuote(null)
      setQuoteError('')
      setConvertDirection('ngn_to_usd')
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Conversion failed')
    } finally {
      setConvertLoading(false)
    }
  }

  useEffect(() => {
    const amount = Number(convertAmount || 0)
    if (!isConvertOpen || !amount || amount <= 0) {
      setConvertQuote(null)
      setQuoteError('')
      setQuoteLoading(false)
      return
    }

    let cancelled = false
    const timer = setTimeout(async () => {
      setQuoteLoading(true)
      setQuoteError('')
      try {
        const res =
          convertDirection === 'usd_to_ngn'
            ? await quoteUsdToNgn({ amount_usd: amount })
            : await quoteNgnToUsd({ amount_ngn: amount })
        if (!cancelled) setConvertQuote(res?.data || null)
      } catch (e) {
        if (!cancelled) {
          const msg = e?.response?.data?.message || 'Unable to fetch live rate.'
          toast.error(msg)
          setQuoteError(msg)
          setConvertQuote(null)
        }
      } finally {
        if (!cancelled) setQuoteLoading(false)
      }
    }, 450)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [convertAmount, isConvertOpen, convertDirection])

  const refetchQuote = () => {
    if (!isConvertOpen) return
    const amount = Number(convertAmount || 0)
    if (!amount || amount <= 0) return
    setQuoteLoading(true)
    setQuoteError('')
    const run = async () => {
      try {
        const res =
          convertDirection === 'usd_to_ngn'
            ? await quoteUsdToNgn({ amount_usd: amount })
            : await quoteNgnToUsd({ amount_ngn: amount })
        setConvertQuote(res?.data || null)
      } catch (e) {
        const msg = e?.response?.data?.message || 'Unable to fetch live rate.'
        toast.error(msg)
        setQuoteError(msg)
        setConvertQuote(null)
      } finally {
        setQuoteLoading(false)
      }
    }
    run()
  }

  const balance = wallet?.balance ?? 0
  const usdBalance = usdWallet?.balance ?? 0

  const quoteFrom = convertDirection === 'usd_to_ngn' ? 'USD' : 'NGN'
  const quoteTo = convertDirection === 'usd_to_ngn' ? 'NGN' : 'USD'
  const directionLabel = `${quoteFrom} → ${quoteTo}`

  const formatQuoteAmount = (value, currency) => {
    if (currency === 'USD') return `USD ${usdFormat(value)}`
    return nairaFormat(value, 'ngn')
  }

  const amountValue = Number(convertAmount || 0)
  const hasValidAmount = Number.isFinite(amountValue) && amountValue > 0
  const hasValidPin = /^\d{4}$/.test(String(convertPin || '').trim())
  const quoteAmount = Number(convertQuote?.amount_in || 0)
  const quoteTolerance = quoteFrom === 'USD' ? 0.01 : 1
  const quoteMatchesAmount = Math.abs(quoteAmount - amountValue) <= quoteTolerance
  const quoteMatchesDirection = convertQuote?.from === quoteFrom && convertQuote?.to === quoteTo
  const isQuoteStale = Boolean(convertQuote && (!quoteMatchesAmount || !quoteMatchesDirection))
  const hasValidQuote = Boolean(
    convertQuote && !quoteError && quoteMatchesAmount && quoteMatchesDirection
  )
  const availableBalance = convertDirection === 'usd_to_ngn' ? usdBalance : balance
  const hasSufficientBalance = amountValue <= Number(availableBalance || 0)

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

  const txList = isTunnel ? usdTx : ngnTx

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

            {/* Quick actions (mobile) */}
            <div className="bg-slate-900 rounded-2xl p-5 md:hidden border border-slate-800">
              <div className="mb-4">
                <h3 className="text-sm font-semibold mb-1">Quick actions</h3>
                <p className="text-xs text-slate-400">
                  {isTunnel
                    ? 'Tunnel actions: conversion + USD layer.'
                    : 'Add money or send money to banks and BitBridge users instantly.'}
                </p>
              </div>
              <TransactionComp
                mode={mode}
                setIsfundTransferOpen={setIsfundTransferOpen}
                setIsModalOpen={setIsModalOpen}
                onOpenConvert={openConvert}
              />
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
                              <th className="sticky top-0 z-10 border-b border-slate-600/50 px-3 py-3.5 text-center text-[11px] font-semibold text-slate-300 uppercase">
                                Receipt
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {txList?.length ? (
                              txList.map((item) => {
                                const receiptRef = resolveReceiptReference(item, { kindHint: 'wallet', preferWallet: true })
                                return (
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
                                  <td className="whitespace-nowrap border-b border-slate-800 px-3 py-3 text-xs text-center">
                                    {receiptRef ? (
                                      <NavLink
                                        to={`/dashboard/receipt/${receiptRef}`}
                                        className="text-indigo-300 hover:text-indigo-200"
                                      >
                                        View receipt
                                      </NavLink>
                                    ) : (
                                      <span className="text-slate-500 text-xs">Receipt unavailable</span>
                                    )}
                                  </td>
                                </tr>
                                )
                              })
                            ) : (
                              <tr>
                                <td colSpan={5} className="py-8 text-center text-sm text-slate-500">
                                  {tunnelLoading || txLoading ? 'Loading...' : 'No transactions yet.'}
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
                    : 'Add money or send money to banks and BitBridge users instantly.'}
                </p>
              </div>

              <TransactionComp
                mode={mode}
                setIsfundTransferOpen={setIsfundTransferOpen}
                setIsModalOpen={setIsModalOpen}
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

      <AppModal handleCancel={() => setIsfundTransferOpen(false)} title={'Send Money'} isModalOpen={isfundTransferOpen}>
        <MoneyTransferFlow setIsfundTransferOpen={setIsfundTransferOpen} />
      </AppModal>

      {/* Tunnel conversion modal */}
      <AppModal title={'Convert'} isModalOpen={isConvertOpen} handleCancel={() => { if (isFxRoute) navigate('/dashboard/tunnel', { replace: true }); else setIsConvertOpen(false) }}>
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">
                {directionLabel} · Available:{' '}
                <span className="text-slate-200">
                  {quoteFrom === 'USD'
                    ? `USD ${usdFormat(usdBalance)}`
                    : nairaFormat(balance, 'ngn')}
                </span>
              </p>
              {convertQuote && !quoteError && !quoteLoading ? (
                <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[10px] font-semibold text-emerald-200">
                  Live rate
                </span>
              ) : null}
            </div>
          </div>

          <DirectionToggle value={convertDirection} onChange={handleDirectionChange} />

          <div className="space-y-2">
            <label className="block text-xs text-slate-300">Amount ({quoteFrom})</label>
            <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
              <span className="rounded-lg bg-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-200">
                {quoteFrom}
              </span>
              <input
                ref={amountInputRef}
                value={convertAmount}
                onChange={(e) => setConvertAmount(e.target.value)}
                className="flex-1 bg-transparent text-sm text-slate-100 focus:outline-none"
                placeholder={quoteFrom === 'USD' ? '25.00' : '15000'}
                inputMode="decimal"
              />
            </div>
          </div>

          <QuoteBreakdownCard
            loading={quoteLoading}
            error={quoteError}
            stale={isQuoteStale}
            quote={convertQuote}
            fromCurrency={quoteFrom}
            toCurrency={quoteTo}
            formatAmount={formatQuoteAmount}
            onRetry={refetchQuote}
          />

          <div className="space-y-2">
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
          </div>

          <button
            type="button"
            onClick={doConvert}
            disabled={
              quoteLoading ||
              convertLoading ||
              !hasValidQuote ||
              !hasValidAmount ||
              !hasValidPin ||
              !hasSufficientBalance
            }
            className="w-full mt-2 px-4 py-2 rounded-xl bg-orange-500 text-black text-sm font-semibold hover:bg-orange-400 disabled:opacity-60"
          >
            {convertLoading ? 'Converting...' : 'Convert'}
          </button>
        </div>
      </AppModal>
    </>
  )
}

const TransactionComp = ({
  mode,
  setIsModalOpen,
  setIsfundTransferOpen,
  onOpenConvert,
}) => {
  const isTunnel = mode === MODES.TUNNEL

  return (
    <div className="quick-actions text-white flex justify-between gap-6 bg-transparent px-3">
      {!isTunnel ? (
        <>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex flex-col items-center justify-center gap-1 text-purple-300 hover:text-alt cursor-pointer"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-purple-900/40 border border-purple-600/60">
              <WalletOutlined />
            </span>
            <span className="text-[11px] text-center">Add Money</span>
          </button>

          <button
            onClick={() => setIsfundTransferOpen((prev) => !prev)}
            className="flex flex-col items-center justify-center gap-1 text-purple-300 hover:text-alt cursor-pointer"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-purple-900/40 border border-purple-600/60">
              <TransactionOutlined />
            </span>
            <span className="text-[11px] text-center">Send Money</span>
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
  setIsfundTransferOpen: PropTypes.func,
  onOpenConvert: PropTypes.func,
}

export default Account


