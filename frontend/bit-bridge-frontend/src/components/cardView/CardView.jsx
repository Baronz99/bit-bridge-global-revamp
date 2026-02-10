import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import states from '../../data/states.json'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { createCard, getUserCard, registerCardHolder } from '../../redux/actions/account'
import { getWallet } from '../../redux/actions/wallet'
import ShadowValue from '../../components/ShadowValue'
import client from '../../api/client'
import { toast } from 'react-toastify'
import { needsTier2Access, withTier2MissingDetails } from '../../utils/kycGate'
import SelfieCapture from '../Kyc/SelfieCapture'

//  Use your reusable masked PIN input (4 digits)
import TransactionPinInput from '../../components/pin/TransactionPinInput' // adjust if needed

const PIN_LENGTH = 4
const CARD_CREATION_FEE_USD = 4
const CARD_MIN_FUNDING_USD = 5
const DEBUG_STRIP = false

export default function VirtualCardApplication() {
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const { user } = useSelector((state) => state.auth)
  const { card, loading: accountLoading } = useSelector((state) => state.account)

  //  NEW: wallet slice shape is state.wallet.data.bridge/tunnel
  const { data: walletData, loading: walletLoading } = useSelector((state) => state.wallet)
  const tunnelWallet = walletData?.tunnel || null // USD wallet
  const tunnelUsdBalance = useMemo(() => {
    const b = tunnelWallet?.balance
    if (b === null || b === undefined || Number.isNaN(Number(b))) return 0
    return Number(b)
  }, [tunnelWallet?.balance])

  const [cardType, setCardType] = useState('virtual') // 'virtual' or 'physical'
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(null)
  const [successCreate, setSuccessCreate] = useState(null)
  const [availableStates, setAvailableStates] = useState(states)
  const [copiedCardId, setCopiedCardId] = useState(false)
  const [copiedCardholderId, setCopiedCardholderId] = useState(false)
  const [animatedUsdBalance, setAnimatedUsdBalance] = useState(0)
  const [cardTilt, setCardTilt] = useState({ x: 0, y: 0 })
  const [cardDetails, setCardDetails] = useState(null)
  const [cardBalance, setCardBalance] = useState(null)
  const [cardInfoLoading, setCardInfoLoading] = useState(false)
  const [showCardDetails, setShowCardDetails] = useState(false)
  const [cardReveal, setCardReveal] = useState(null)
  const [cardRevealLoading, setCardRevealLoading] = useState(false)
  const [cardRevealError, setCardRevealError] = useState(null)
  const [cardHistory, setCardHistory] = useState([])
  const [cardInsights, setCardInsights] = useState(null)
  const [cardHistoryLoading, setCardHistoryLoading] = useState(false)
  const [historyTick, setHistoryTick] = useState(0)
  const [revealCooldownUntil, setRevealCooldownUntil] = useState(0)
  const [copiedPan, setCopiedPan] = useState(false)
  const [freezeLoading, setFreezeLoading] = useState(false)
  const [freezeError, setFreezeError] = useState(null)
  const [showInlineFund, setShowInlineFund] = useState(false)
  const [showInlineWithdraw, setShowInlineWithdraw] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawResult, setWithdrawResult] = useState(null)
  const [creationFeeUsd, setCreationFeeUsd] = useState(CARD_CREATION_FEE_USD)
  const [cardholderCameraError, setCardholderCameraError] = useState('')
  const [refreshingVerification, setRefreshingVerification] = useState(false)
  const gateToastShownRef = useRef(false)
    const [showRevealPinModal, setShowRevealPinModal] = useState(false)
  const [revealPin, setRevealPin] = useState('') // PIN used ONLY for reveal


  const [formData, setFormData] = useState({
    // cardholder fields
    first_name: '',
    last_name: '',
    phone: '',
    email_address: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postal_code: '',
    house_no: '',
    id_type: 'NIGERIAN_BVN_VERIFICATION',
    bvn: '',
    selfie_image: '',
    meta_data: { any_key: '' },
    email: '',
    limit: 5000,
    deliveryAddress: '',
    design: 'midnight',
    agreeTos: false,

    // card creation fields
    card_brand: 'Mastercard',
    card_currency: 'USD',
    card_type: 'Virtual',
    card_limit: 5000,

    // funding fields
    amount: '',
    transaction_pin: '', //  backend expects 4 digits
    wallet_type: 'usd',   //  force tunnel
  })

  const designs = [
    { id: 'midnight', label: 'Midnight' },
    { id: 'aurora', label: 'Aurora' },
    { id: 'graphite', label: 'Graphite' },
  ]

  const hasCardholder = Boolean(card?.cardholder_id)
  const hasCardId = Boolean(card?.card_id)
  const showCardholderForm = !hasCardholder
  const showCreateForm = hasCardholder && !hasCardId
  const requiresSelfie =
    String(formData.id_type || '').toUpperCase() === 'NIGERIAN_BVN_VERIFICATION'
  const lastFunding = Number(cardInsights?.last_funding_amount || 0)
  const hasLastFunding = lastFunding > 0
  const todaysSpend = 0
  const failedAttempts = 0
  const lastMerchant = null
  const hasLastMerchant = Boolean(lastMerchant)
  const spendTrend = [0, 0, 0, 0, 0, 0, 0]
  const hasTrend = spendTrend.some((value) => value > 0)
  const hasInsights =
    hasLastFunding ||
    todaysSpend > 0 ||
    failedAttempts > 0 ||
    hasLastMerchant ||
    hasTrend ||
    cardHistory.length > 0

  const statusFromApi =
    card?.status || cardDetails?.status || cardDetails?.card_status || ''
  const normalizedStatus = statusFromApi.toString().toLowerCase()
  const isPendingFunding = normalizedStatus === 'pending_funding'
  const cardholderKycStatus = String(card?.meta_data?.cardholder_kyc_status || '').toLowerCase()
  const cardholderStatusUpdatedAt = card?.meta_data?.cardholder_status_updated_at || null
  const cardholderVerificationPending = ['pending_verification', 'manual_review'].includes(cardholderKycStatus)
  const cardholderVerificationFailed = cardholderKycStatus === 'failed'
  const cardholderVerificationBlockedCreate =
    cardholderVerificationPending || cardholderVerificationFailed
  const cardholderStatusLabel =
    cardholderKycStatus === 'pending_verification'
      ? 'Pending verification'
      : cardholderKycStatus === 'manual_review'
      ? 'Manual review'
      : cardholderKycStatus === 'failed'
      ? 'Verification failed'
      : cardholderKycStatus === 'verified'
      ? 'Verified'
      : null
  const frozenBy = card?.frozen_by || card?.frozenBy || ''
  const frozenReason = card?.frozen_reason || card?.frozenReason || ''
  const creationFeeCharged = Boolean(card?.meta_data?.creation_fee_charged)
  const fundingAmount = Number(formData.amount || 0)
  const feeAmount = Number(creationFeeUsd || 0)
  const isExistingCard = hasCardId && !isPendingFunding
  const feeDue = isExistingCard ? 0 : creationFeeCharged ? 0 : feeAmount
  const minFunding = CARD_MIN_FUNDING_USD
  const totalDebit = feeDue + (fundingAmount > 0 ? fundingAmount : 0)
  const fundingBelowMin = fundingAmount > 0 && fundingAmount < minFunding
  const withdrawAmountValue = Number(withdrawAmount || 0)
  const requiredBalance = isExistingCard
    ? fundingAmount
    : feeDue + (fundingAmount >= minFunding ? fundingAmount : 0)

  const needsTier2 = needsTier2Access(user)

  useEffect(() => {
    dispatch(getUserCard())
    dispatch(getWallet()) //  ensure we have tunnel wallet status/balance
  }, [dispatch])

  useEffect(() => {
    let active = true

    const loadFees = async () => {
      try {
        const res = await client.get('/fees')
        const feeValue = res?.data?.data?.cards?.creation_fee_usd
        if (!active) return
        if (feeValue !== undefined && feeValue !== null && !Number.isNaN(Number(feeValue))) {
          setCreationFeeUsd(Number(feeValue))
        }
      } catch (_) {
        // fallback to default constant
      }
    }

    loadFees()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!card?.id) return
    let active = true

    const loadHistory = async () => {
      setCardHistoryLoading(true)
      try {
        const [historyRes, insightsRes] = await Promise.all([
          client.get(`/cards/${card.id}/history`),
          client.get(`/cards/${card.id}/insights`),
        ])
        if (!active) return
        setCardHistory(Array.isArray(historyRes?.data) ? historyRes.data : [])
        setCardInsights(insightsRes?.data?.data || null)
      } catch (error) {
        if (!active) return
        setCardHistory([])
        setCardInsights(null)
      } finally {
        if (!active) return
        setCardHistoryLoading(false)
      }
    }

    loadHistory()
    return () => {
      active = false
    }
  }, [card?.id, historyTick])

  useEffect(() => {
    if (!needsTier2) return
    if (gateToastShownRef.current) {
      navigate('/dashboard/kyc')
      return
    }

    let shouldToast = true
    try {
      const key = 'bb_tier1_gate_cards'
      if (sessionStorage.getItem(key)) {
        shouldToast = false
      } else {
        sessionStorage.setItem(key, '1')
      }
    } catch (_) {
      // no-op
    }

    gateToastShownRef.current = true
    if (shouldToast) {
      toast.info(withTier2MissingDetails(user, 'Complete Tier 2 verification to use cards.'), {
        position: 'top-right',
        autoClose: 4000,
        pauseOnHover: true,
      })
    }
    navigate('/dashboard/kyc')
  }, [navigate, needsTier2])

  useEffect(() => {
    const start = animatedUsdBalance
    const end = tunnelUsdBalance
    if (start === end) return

    const duration = 800
    const startTime = performance.now()
    let raf

    const step = (now) => {
      const progress = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setAnimatedUsdBalance(start + (end - start) * eased)
      if (progress < 1) raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tunnelUsdBalance])

  useEffect(() => {
    if (!card?.id || !card?.card_id) return

    let isMounted = true
    setCardInfoLoading(true)

    const loadCardInfo = async () => {
      try {
        const [detailsRes, balanceRes] = await Promise.all([
          client.get(`/cards/${card?.id}/details`),
          client.get(`/cards/${card?.id}/balance`),
        ])

        if (!isMounted) return
        const detailsData = detailsRes?.data?.data || null
        const balanceData = balanceRes?.data?.data || null
        
        setCardDetails(detailsData)
        setCardBalance(balanceData)
      } catch (error) {
        if (!isMounted) return
        setCardDetails(null)
        setCardBalance(null)
      } finally {
        if (!isMounted) return
        setCardInfoLoading(false)
      }
    }

    loadCardInfo()

    return () => {
      isMounted = false
    }
  }, [card?.id, card?.card_id])

  useEffect(() => {
    if (!DEBUG_STRIP) return
  }, [])

  useEffect(() => {
    let isMounted = true

    const normalizeStates = (payload) => {
      if (!payload) return null
      if (Array.isArray(payload)) {
        return payload
          .map((item) => (typeof item === 'string' ? item : item.state || item.name || item.label))
          .filter(Boolean)
      }

      if (payload.states) return normalizeStates(payload.states)
      if (payload.data) return normalizeStates(payload.data)
      if (payload.items) return normalizeStates(payload.items)

      return null
    }

    const loadStates = async () => {
      try {
        const response = await client.get('/cards/get_all_states', { params: { country: 'NG' } })
        const normalized = normalizeStates(response.data.data)

        if (isMounted && normalized.length) {
          setAvailableStates(normalized)
        }
      } catch (error) {
        // Fallback to local states list
      }
    }

    loadStates()

    return () => {
      isMounted = false
    }
  }, [])

  // Prefill from logged-in user
  useEffect(() => {
    if (!user) return
    setFormData((prev) => ({
      ...prev,
      first_name: user.user_profile.first_name || '',
      last_name: user.user_profile.last_name || '',
      phone: user.user_profile.phone_number || '',
      email_address: user.email || '',
      country: 'Nigeria',
      selfie_image: user?.user_profile?.selfie_image || prev.selfie_image || '',
    }))
  }, [user])

  // Prefill from existing cardholder profile (if any)
  useEffect(() => {
    if (!card) return
    setFormData((prev) => ({
      ...prev,
      city: card?.city || '',
      state: card?.state || '',
      bvn: card?.bvn || '',
      selfie_image: card?.selfie_image || prev.selfie_image || '',
      address: card?.address || '',
      house_no: card?.house_no || '',
      postal_code: card?.postal_code || '',
      card_brand: 'Mastercard',
      card_currency: 'USD',
      card_type: 'Virtual',
      card_limit: 5000,
      wallet_type: 'usd',
    }))
  }, [card])

  function handleChange(e) {
    const { name, value, type, checked } = e.target

    if (name === 'meta_data.any_key') {
      setFormData((prev) => ({
        ...prev,
        meta_data: { ...prev.meta_data, any_key: value },
      }))
      return
    }

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

const setPin = (nextPin) => {
  const clean = String(nextPin || '').replace(/\D/g, '').slice(0, PIN_LENGTH)
  setFormData((prev) => ({ ...prev, transaction_pin: clean }))
  if (clean.length === PIN_LENGTH) setCardRevealError(null)
}


  const setRevealPinValue = (nextPin) => {
    const clean = String(nextPin || '').replace(/\D/g, '').slice(0, PIN_LENGTH)
    setRevealPin(clean)
    if (clean.length === PIN_LENGTH) setCardRevealError(null)
  }


  function validateCardholder() {
    if (requiresSelfie && !String(formData.selfie_image || '').trim()) {
      return 'Selfie image is required for BVN cardholder verification.'
    }
    if (!formData.agreeTos) return 'You must agree to the terms.'
    return null
  }

  // Register cardholder
  async function handleSubmitCardholder(e) {
    e.preventDefault()
    setCardholderCameraError('')
    const err = validateCardholder()
    if (err) return setSuccess({ ok: false, message: err })

    setSubmitting(true)
    setSuccess(null)

    dispatch(registerCardHolder({ card: formData }))
      .unwrap()
      .then(() => {
        setSuccess({
          ok: true,
          message:
            'Cardholder profile submitted. Verification is in progress and can take a few minutes before card creation is enabled.',
        })
        dispatch(getUserCard())
      })
      .catch((err) => {
        setSuccess({
          ok: false,
          message: `Cardholder submission failed. ${err.message || ''}`,
        })
      })
      .finally(() => setSubmitting(false))
  }

  // Create / fund card
  async function handleSubmitCreateCard(e) {
    e.preventDefault()

    if (cardholderVerificationBlockedCreate && !isExistingCard) {
      return setSuccessCreate({
        ok: false,
        message:
          cardholderVerificationFailed
            ? 'Cardholder verification failed. Re-submit cardholder details before card creation.'
            : 'Cardholder verification is still in progress. Refresh status and retry when verified.',
      })
    }

    setSubmitting(true)
    setSuccessCreate(null)

    //  Require tunnel wallet activated
    if (!tunnelWallet?.id) {
      setSubmitting(false)
      return setSuccessCreate({
        ok: false,
        message: 'Tunnel wallet (USD) is not active yet. Open Tunnel wallet and activate it first.',
      })
    }

    const amt = Number(formData.amount || 0)
    if (Number.isNaN(amt) || amt < 0) {
      setSubmitting(false)
      return setSuccessCreate({ ok: false, message: 'Enter a valid funding amount.' })
    }

    if (!isExistingCard && amt > 0 && amt < minFunding) {
      setSubmitting(false)
      return setSuccessCreate({
        ok: false,
        message: `Minimum funding to activate is USD ${minFunding}. Leave it at 0 to activate later.`,
      })
    }

    if (tunnelUsdBalance < requiredBalance) {
      setSubmitting(false)
      return setSuccessCreate({
        ok: false,
        message: isExistingCard
          ? 'Insufficient Tunnel balance to cover the funding amount.'
          : creationFeeCharged
          ? 'Insufficient Tunnel balance to cover the funding amount.'
          : `Insufficient Tunnel balance to cover the USD ${feeAmount} card creation fee and funding.`,
      })
    }

    if ((formData.transaction_pin || '').length !== PIN_LENGTH) {
      setSubmitting(false)
      return setSuccessCreate({ ok: false, message: `Enter your ${PIN_LENGTH}-digit transaction PIN.` })
    }

    if (isExistingCard) {
      client
        .post('/cards/fund_wallet', {
          card: {
            card_id: card?.card_id,
            amount: amt,
            currency: 'USD',
            transaction_pin: formData.transaction_pin,
            wallet_type: 'usd',
          },
        })
        .then((response) => {
          setSuccessCreate({
            ok: true,
            message: response?.data?.message || 'Funding submitted successfully.',
          })
          dispatch(getWallet())
          setHistoryTick((value) => value + 1)
        })
        .catch((err) => {
          setSuccessCreate({
            ok: false,
            message: `Card funding failed. ${err.message || ''}`,
          })
        })
        .finally(() => setSubmitting(false))
      return
    }

    dispatch(
      createCard({
        card: {
          ...formData,
          card_currency: 'USD',
          wallet_type: 'usd',
        },
      })
    )
      .unwrap()
      .then((result) => {
        setSuccessCreate({
          ok: true,
          message: result?.message || 'Card request submitted successfully.',
        })
        dispatch(getWallet())
      })
      .catch((err) => {
        setSuccessCreate({
          ok: false,
          message: `Card creation failed. ${err.message || ''}`,
        })
      })
      .finally(() => setSubmitting(false))
  }

  const formatStatusTime = (value) => {
    if (!value) return null
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleString()
  }

  const handleRefreshCardholderStatus = async () => {
    if (refreshingVerification) return
    setRefreshingVerification(true)
    try {
      await dispatch(getUserCard())
    } finally {
      setRefreshingVerification(false)
    }
  }

  async function handleSubmitUnloadCard(e) {
    e.preventDefault()
    setSubmitting(true)
    setWithdrawResult(null)

    if (!hasCardId || !card?.card_id) {
      setSubmitting(false)
      return setWithdrawResult({ ok: false, message: 'Card not available for withdrawal yet.' })
    }

    const amt = Number(withdrawAmount || 0)
    if (Number.isNaN(amt) || amt <= 0) {
      setSubmitting(false)
      return setWithdrawResult({ ok: false, message: 'Enter a valid withdrawal amount.' })
    }

    if ((formData.transaction_pin || '').length !== PIN_LENGTH) {
      setSubmitting(false)
      return setWithdrawResult({ ok: false, message: `Enter your ${PIN_LENGTH}-digit transaction PIN.` })
    }

    client
      .post('/cards/unload_wallet', {
        card: {
          card_id: card?.card_id,
          amount: amt,
          currency: 'USD',
          transaction_pin: formData.transaction_pin,
          wallet_type: 'usd',
        },
      })
      .then((response) => {
        setWithdrawResult({
          ok: true,
          message: response?.data?.message || 'Withdrawal submitted. Pending confirmation.',
        })
        setHistoryTick((value) => value + 1)
      })
      .catch((err) => {
        setWithdrawResult({
          ok: false,
          message: `Withdrawal failed. ${err.message || ''}`,
        })
      })
      .finally(() => setSubmitting(false))
  }

  const canCreate =
    !!tunnelWallet?.id &&
    (isExistingCard || !cardholderVerificationBlockedCreate) &&
    (formData.transaction_pin || '').length === PIN_LENGTH &&
    (isExistingCard ? fundingAmount > 0 : !fundingBelowMin) &&
    tunnelUsdBalance >= requiredBalance
  const canWithdraw =
    (formData.transaction_pin || '').length === PIN_LENGTH &&
    withdrawAmountValue > 0 &&
    hasCardId

  const onCardMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 10
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * -10
    setCardTilt({ x, y })
  }

  const onCardLeave = () => setCardTilt({ x: 0, y: 0 })

  const isEncryptedValue = (value) => {
    if (!value) return false
    return String(value).startsWith('ev:')
  }

  const expiryValue = useMemo(() => {
    const month = cardDetails?.expiry_month || cardDetails?.expiryMonth
    const year = cardDetails?.expiry_year || cardDetails?.expiryYear
    if (month && year && !isEncryptedValue(month) && !isEncryptedValue(year)) {
      const paddedMonth = String(month).padStart(2, '0')
      const shortYear = String(year).slice(-2)
      return `${paddedMonth}/${shortYear}`
    }

    const raw = cardDetails?.expiry || cardDetails?.expiry_date
    if (isEncryptedValue(raw)) return null
    if (!raw) return null
    const digits = String(raw).replace(/\D/g, '')
    if (digits.length === 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
    if (digits.length === 6) return `${digits.slice(0, 2)}/${digits.slice(4)}`
    return String(raw)
  }, [cardDetails])

  const last4Value = cardDetails?.last_4 || cardDetails?.last4 || cardDetails?.last_four
  const revealLast4 = cardReveal?.last_4 || cardReveal?.last4 || cardReveal?.last_four

  const maskedPanValue = useMemo(() => {
    if (cardDetails?.masked_pan && !isEncryptedValue(cardDetails.masked_pan)) return cardDetails.masked_pan
    if (cardDetails?.card_pan && !isEncryptedValue(cardDetails.card_pan)) return cardDetails.card_pan
    if (last4Value) return `**** **** **** ${last4Value}`
    return null
  }, [cardDetails, last4Value])

  const revealPanValue = useMemo(() => {
    if (cardReveal?.card_number && !isEncryptedValue(cardReveal.card_number)) return cardReveal.card_number
    if (cardReveal?.card_pan && !isEncryptedValue(cardReveal.card_pan)) return cardReveal.card_pan
    if (revealLast4) return `**** **** **** ${revealLast4}`
    if (last4Value) return `**** **** **** ${last4Value}`
    return null
  }, [cardReveal, revealLast4, last4Value])

  const revealExpiryValue = useMemo(() => {
    if (!cardReveal) return null
    const month = cardReveal.expiry_month || cardReveal.expiryMonth
    const year = cardReveal.expiry_year || cardReveal.expiryYear
    if (month && year && !isEncryptedValue(month) && !isEncryptedValue(year)) {
      const paddedMonth = String(month).padStart(2, '0')
      const shortYear = String(year).slice(-2)
      return `${paddedMonth}/${shortYear}`
    }

    const raw = cardReveal.expiry || cardReveal.expiry_date
    if (isEncryptedValue(raw)) return null
    if (!raw) return null
    const digits = String(raw).replace(/\D/g, '')
    if (digits.length === 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
    if (digits.length === 6) return `${digits.slice(0, 2)}/${digits.slice(4)}`
    return String(raw)
  }, [cardReveal])

  const revealCvvValue = useMemo(() => {
    if (!cardReveal?.cvv || isEncryptedValue(cardReveal.cvv)) return null
    return String(cardReveal.cvv)
  }, [cardReveal])

  const isCardActive = normalizedStatus
    ? normalizedStatus === 'active'
    : typeof cardDetails?.is_active === 'boolean'
      ? cardDetails.is_active
      : true

  const cardStatusLabel = isPendingFunding
    ? 'Pending funding'
    : isCardActive
      ? 'Active'
      : 'Frozen'

  const detailItems = [
    { label: 'Status', value: cardStatusLabel },
    { label: 'Brand', value: cardDetails?.card_brand || cardDetails?.brand },
    { label: 'Type', value: cardDetails?.card_type },
    { label: 'Currency', value: cardDetails?.card_currency || cardDetails?.currency },
  ].filter((item) => item.value)

  const normalizeUsdLimit = (value) => {
    if (value === null || value === undefined || value === '') return null
    const amount = Number(value)
    if (Number.isNaN(amount)) return null
    return amount > 100000 ? amount / 100 : amount
  }

  const displayCardLimit =
    card?.card_limit_usd ??
    cardDetails?.card_limit_usd ??
    normalizeUsdLimit(card?.card_limit || cardDetails?.card_limit) ??
    formData.card_limit

  const fundingTitle = 'Create / Fund Card'
  const fundingCta = isExistingCard ? 'Add funds' : isPendingFunding ? 'Activate card' : 'Create card'

  const balanceAmountCents =
    cardBalance?.balance ??
    cardBalance?.available_balance ??
    cardBalance?.ledger_balance ??
    null

  const balanceAmount =
    balanceAmountCents === null || balanceAmountCents === undefined
      ? null
      : Number(balanceAmountCents) / 100

  const cardPanDisplay = useMemo(() => {
    if (cardDetails?.masked_pan) return cardDetails.masked_pan
    const last4 = cardDetails?.last4 || cardDetails?.last_four
    if (last4) return `**** **** **** ${last4}`
    return '**** **** **** ****'
  }, [cardDetails])


  if (accountLoading && !card) {
    return (
      <div className="virtual-card-page min-h-screen px-4 py-8">
        <div className="vc-page-shell max-w-6xl mx-auto space-y-8">
          <section className="vc-surface rounded-2xl p-6 md:p-7 border border-slate-800 shadow-lg">
            <p className="text-sm text-slate-300">Loading your card details...</p>
          </section>
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap');

        .virtual-card-page {
          background-color: var(--bb-bg);
          background-image: none;
          color: #e2e8f0;
          font-family: 'Sora', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          position: relative;
        }

        .bb-user-theme[data-theme='dark'] .virtual-card-page {
          background:
            radial-gradient(1200px 800px at 10% -10%, rgba(37, 99, 235, 0.25), transparent 60%),
            radial-gradient(900px 700px at 90% -15%, rgba(14, 165, 233, 0.2), transparent 65%),
            radial-gradient(700px 500px at 50% 20%, rgba(15, 23, 42, 0.4), transparent 70%),
            linear-gradient(180deg, #0b1120 0%, #0f172a 45%, #0b1220 100%);
          background-image: none;
        }

        .virtual-card-page::before {
          content: '';
          position: fixed;
          inset: 0;
          background: transparent;
          opacity: 0;
          pointer-events: none;
          z-index: 0;
        }

        .bb-user-theme[data-theme='dark'] .virtual-card-page::before {
          background: radial-gradient(1200px 800px at 10% -10%, rgba(37, 99, 235, 0.18), transparent 60%);
          opacity: 1;
        }

        .virtual-card-page > * {
          position: relative;
          z-index: 1;
        }

        .virtual-card-page h1,
        .virtual-card-page h2,
        .virtual-card-page h3 {
          font-family: 'Space Grotesk', 'Sora', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          letter-spacing: -0.01em;
        }

        .bb-user-theme[data-theme='light'] .virtual-card-page {
          background: #f5efe6 !important;
          background-image: none !important;
          color: var(--bb-text) !important;
        }

        .bb-user-theme[data-theme='light'] .virtual-card-page::before {
          opacity: 0 !important;
          background-image: none !important;
        }

        .bb-user-theme[data-theme='light'] .virtual-card-page h1,
        .bb-user-theme[data-theme='light'] .virtual-card-page h2,
        .bb-user-theme[data-theme='light'] .virtual-card-page h3,
        .bb-user-theme[data-theme='light'] .virtual-card-page header p {
          color: var(--bb-text) !important;
        }

        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-hero {
          background: var(--bb-panel-bg) !important;
          border: 1px solid var(--bb-panel-border) !important;
          border-radius: 18px;
          box-shadow: none !important;
        }

        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-hero::after {
          background: transparent !important;
          backdrop-filter: none !important;
          opacity: 0 !important;
          display: none !important;
        }

        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-surface,
        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-dark-surface {
          background: #f6f1e8 !important;
          border-color: #e6dccd !important;
          color: #2b2a26 !important;
          box-shadow: 0 16px 35px -30px rgba(70, 45, 18, 0.25) !important;
        }

        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-inset,
        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-chip {
          background: #fbf7f1 !important;
          border-color: #e6dccd !important;
          color: #2b2a26 !important;
        }

        .bb-user-theme[data-theme='light'] .virtual-card-page input,
        .bb-user-theme[data-theme='light'] .virtual-card-page select,
        .bb-user-theme[data-theme='light'] .virtual-card-page textarea {
          background: #fffaf3 !important;
          border-color: #e2d7c6 !important;
          color: #2b2a26 !important;
        }

        .bb-user-theme[data-theme='light'] .virtual-card-page input::placeholder,
        .bb-user-theme[data-theme='light'] .virtual-card-page textarea::placeholder {
          color: #7b7063 !important;
        }

        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-nav {
          background: #f7f2ea !important;
          border-color: #e6dccd !important;
        }

        .bb-user-theme[data-theme='light'] .virtual-card-page .bg-slate-900,
        .bb-user-theme[data-theme='light'] .virtual-card-page .bg-slate-800,
        .bb-user-theme[data-theme='light'] .virtual-card-page .bg-slate-950 {
          background: #f6f1e8 !important;
        }

        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-preview {
          background: linear-gradient(145deg, #efe4d5, #f8f3ec) !important;
          color: #2b2a26 !important;
          box-shadow: inset 0 0 0 1px rgba(120, 90, 55, 0.08);
          border: 1px solid rgba(120, 90, 55, 0.12);
        }

        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-preview .text-white,
        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-preview .text-slate-200\/80,
        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-preview .text-slate-200\/90 {
          color: #2b2a26 !important;
        }

        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-preview .text-slate-200\/80,
        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-preview .text-slate-200\/90,
        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-preview .text-slate-200\/70 {
          color: #5f5447 !important;
        }

        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-glass {
          background: linear-gradient(160deg, #efe0ce 0%, #f6efe6 55%, #efe0ce 100%) !important;
        }

        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-glass .text-slate-200\/70,
        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-glass .text-slate-200\/80,
        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-glass .text-slate-200\/90,
        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-glass .text-slate-100,
        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-glass .text-slate-200,
        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-glass .text-white {
          color: #2b2a26 !important;
        }

        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-glass .text-slate-300,
        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-glass .text-slate-400,
        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-glass .text-slate-300\/70 {
          color: #5f5447 !important;
        }

        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-glass {
          background: linear-gradient(145deg, #efe4d5, #f8f3ec) !important;
          color: #2b2a26 !important;
          border-color: #e6dccd !important;
          box-shadow: 0 18px 35px -28px rgba(60, 40, 20, 0.3) !important;
        }

        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-glass .text-slate-200\/70,
        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-glass .text-slate-200\/80,
        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-glass .text-slate-200\/90,
        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-glass .text-slate-100,
        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-glass .text-slate-200,
        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-glass .text-white {
          color: #2b2a26 !important;
        }

        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-glass .text-slate-300,
        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-glass .text-slate-400,
        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-glass .text-slate-300\/70 {
          color: #5f5447 !important;
        }

        .bb-user-theme[data-theme='light'] .virtual-card-page .text-slate-100,
        .bb-user-theme[data-theme='light'] .virtual-card-page .text-slate-200,
        .bb-user-theme[data-theme='light'] .virtual-card-page .text-white {
          color: #2b2a26 !important;
        }

        .bb-user-theme[data-theme='light'] .virtual-card-page .text-slate-300,
        .bb-user-theme[data-theme='light'] .virtual-card-page .text-slate-400,
        .bb-user-theme[data-theme='light'] .virtual-card-page .text-slate-500,
        .bb-user-theme[data-theme='light'] .virtual-card-page .text-slate-300/70,
        .bb-user-theme[data-theme='light'] .virtual-card-page .text-slate-300/80,
        .bb-user-theme[data-theme='light'] .virtual-card-page .text-slate-400/70 {
          color: #5f5447 !important;
        }

        .virtual-card-page .vc-nav {
          background: rgba(15, 23, 42, 0.55);
          border: 1px solid rgba(148, 163, 184, 0.2);
          backdrop-filter: blur(18px);
        }

        .virtual-card-page .vc-hero {
          background: rgba(15, 23, 42, 0.65);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 18px;
        }

        .virtual-card-page .vc-surface {
          background: rgba(15, 23, 42, 0.62) !important;
          border-color: rgba(148, 163, 184, 0.2) !important;
          backdrop-filter: blur(16px);
          box-shadow: 0 28px 60px -48px rgba(2, 6, 23, 0.9);
        }

        .virtual-card-page .vc-inset {
          background: rgba(30, 41, 59, 0.7) !important;
          border-color: rgba(148, 163, 184, 0.2) !important;
        }

        .virtual-card-page .vc-chip {
          background: rgba(15, 23, 42, 0.55) !important;
          border-color: rgba(148, 163, 184, 0.2) !important;
          backdrop-filter: blur(12px);
        }

        .virtual-card-page .vc-button-primary {
          background: linear-gradient(135deg, #2563eb, #38bdf8);
          color: #f8fafc;
          box-shadow: 0 14px 30px -18px rgba(37, 99, 235, 0.8);
        }

        .virtual-card-page .vc-button-secondary {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(148, 163, 184, 0.2);
          color: #cbd5f5;
        }

        .virtual-card-page .vc-card-glass {
          background: linear-gradient(135deg, rgba(56, 189, 248, 0.35), rgba(15, 23, 42, 0.9));
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 40px 90px -60px rgba(2, 6, 23, 0.9);
          background-size: 140% 140%;
          animation: cardGlow 8s ease infinite;
          color: #e2e8f0;
        }

        .virtual-card-page .vc-card-frozen {
          animation: none;
          background-position: 50% 50%;
          filter: saturate(0.6);
        }

        .virtual-card-page .vc-card-frozen .vc-shimmer {
          animation: none;
          opacity: 0;
        }

        .virtual-card-page .vc-card-frozen::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(140deg, rgba(15, 23, 42, 0.7), rgba(30, 41, 59, 0.45));
          mix-blend-mode: multiply;
          pointer-events: none;
        }

        .virtual-card-page .vc-neon-edge {
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1), 0 0 30px rgba(56, 189, 248, 0.35);
        }

        .virtual-card-page .vc-glow-ring {
          box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.2), 0 0 28px rgba(56, 189, 248, 0.35), inset 0 0 18px rgba(56, 189, 248, 0.2);
        }

        .virtual-card-page .vc-tilt {
          transform: perspective(900px) rotateX(var(--tilt-x)) rotateY(var(--tilt-y));
          transition: transform 0.3s ease;
        }

        .virtual-card-page .vc-shimmer {
          background: linear-gradient(120deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.2) 40%, rgba(255, 255, 255, 0.05) 70%);
          animation: shimmer 3.2s ease-in-out infinite;
        }

        .virtual-card-page .vc-reflection {
          background: radial-gradient(circle at 20% 20%, rgba(255,255,255,0.35), transparent 60%);
        }

        .virtual-card-page .vc-pulse {
          animation: pulse 1.6s ease-in-out infinite;
        }

        .virtual-card-page .vc-switch {
          position: relative;
          width: 44px;
          height: 24px;
          border-radius: 999px;
          background: #1e293b;
          transition: background 0.2s ease;
        }

        .virtual-card-page .vc-switch::after {
          content: '';
          position: absolute;
          top: 3px;
          left: 3px;
          width: 18px;
          height: 18px;
          border-radius: 999px;
          background: #f8fafc;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.5);
          transition: transform 0.2s ease;
        }

        .virtual-card-page .vc-switch-input:checked + .vc-switch {
          background: #2563eb;
        }

        .virtual-card-page .vc-switch-input:checked + .vc-switch::after {
          transform: translateX(20px);
        }

        .virtual-card-page .vc-input {
          background: rgba(15, 23, 42, 0.7);
          border: 1px solid rgba(148, 163, 184, 0.2);
          color: #e2e8f0;
        }

        .virtual-card-page .vc-input::placeholder {
          color: rgba(148, 163, 184, 0.7);
        }

        .virtual-card-page .vc-chart-bar {
          background: linear-gradient(180deg, rgba(56, 189, 248, 0.9), rgba(56, 189, 248, 0.1));
        }

        .virtual-card-page .vc-tooltip {
          position: relative;
        }

        .virtual-card-page .vc-tooltip:hover::after {
          content: attr(data-tip);
          position: absolute;
          left: 50%;
          top: 115%;
          transform: translateX(-50%);
          background: #0f172a;
          color: #f8fafc;
          font-size: 11px;
          padding: 6px 10px;
          border-radius: 999px;
          white-space: nowrap;
          z-index: 10;
        }

        .virtual-card-page .vc-card-label {
          color: rgba(226, 232, 240, 0.75);
        }

        .virtual-card-page .vc-card-value {
          color: #f8fafc;
        }

        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-glass {
          background: linear-gradient(160deg, #e5d6c4 0%, #f3ece2 55%, #e7d8c5 100%) !important;
          border: 1px solid #d6c5b1 !important;
          box-shadow: 0 18px 45px -30px rgba(93, 66, 30, 0.35) !important;
          color: #2b2a26 !important;
        }

        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-glass .text-white {
          color: inherit !important;
        }

        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-glass .text-slate-200\/70,
        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-glass .text-slate-200\/80,
        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-glass .text-slate-200\/90 {
          color: #5f5447 !important;
        }

        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-label {
          color: #5f5447 !important;
        }

        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-card-value {
          color: #2b2a26 !important;
        }

        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-button-secondary {
          background: #fbf4ea !important;
          border: 1px solid #dccbb7 !important;
          color: #2f261c !important;
          box-shadow: 0 12px 24px -20px rgba(74, 49, 20, 0.35);
        }

        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-page-shell {
          background: #f7f4ef !important;
        }

        .bb-user-theme[data-theme='dark'] .virtual-card-page .vc-page-shell {
          background: #0b1220 !important;
        }

        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-grid-shell,
        .bb-user-theme[data-theme='light'] .virtual-card-page .vc-grid-shell .vc-grid-col {
          background: #f7f4ef !important;
        }

        .bb-user-theme[data-theme='dark'] .virtual-card-page .vc-grid-shell,
        .bb-user-theme[data-theme='dark'] .virtual-card-page .vc-grid-shell .vc-grid-col {
          background: #0b1220 !important;
        }

        @keyframes shimmer {
          0% { transform: translateX(-40%); }
          50% { transform: translateX(40%); }
          100% { transform: translateX(-40%); }
        }

        @keyframes cardGlow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.45); }
          70% { box-shadow: 0 0 0 12px rgba(56, 189, 248, 0); }
          100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0); }
        }

      `}</style>
      <div className="virtual-card-page min-h-screen px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
        <header className="vc-hero px-2 md:px-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Virtual Cards</h1>
            <p className="mt-1 text-sm text-slate-400 max-w-xl">
              Create a secure virtual dollar (USD) card for online payments. Cardholder details are verified once, then you can create and fund cards.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="vc-chip relative overflow-hidden rounded-2xl border border-slate-800 px-4 py-3 text-xs text-slate-300">
              <div className="absolute right-3 top-2 text-[40px] font-semibold text-slate-200/20">
                USD
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-slate-300">Tunnel balance</p>
                  {walletLoading ? (
                    <p className="text-slate-500">Loading...</p>
                  ) : tunnelWallet?.id ? (
                    <p className="text-base font-semibold text-slate-100">
                      <ShadowValue placeholder="****">USD {animatedUsdBalance.toFixed(2)}</ShadowValue>
                    </p>
                  ) : (
                    <p className="text-sm text-red-400">Not activated</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>


        <section className="vc-surface rounded-2xl p-6 md:p-7 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">My cards</h2>
              <p className="text-xs text-slate-400 mt-1">
                Your active cards will appear here.
              </p>
            </div>
            <span className="text-xs text-slate-400">
              {hasCardId ? '1 card' : 'No cards'}
            </span>
          </div>

          {hasCardId ? (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-slate-200">
              <div className="vc-inset rounded-xl border border-slate-800 px-4 py-3">
                <p className="text-xs text-slate-400">Card ID</p>
                <p className="mt-1 font-mono text-[13px] break-all">
                  {card?.card_id || 'Not available'}
                </p>
              </div>
              <div className="vc-inset rounded-xl border border-slate-800 px-4 py-3">
                <p className="text-xs text-slate-400">Status</p>
                <p className="mt-1 font-semibold">{cardStatusLabel}</p>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-xs text-slate-400">
              {isPendingFunding
                ? `Card created. Fund at least USD ${minFunding} to activate it.`
                : 'No cards yet. Create a card below to get started.'}
            </p>
          )}

          {isPendingFunding && (
            <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
              Your card is pending activation. Fund at least USD {minFunding} to activate it.
            </div>
          )}
        </section>

        {hasCardId && (
          <section className="vc-grid-shell grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-8">
            <div className="vc-grid-col flex flex-col gap-6">
              <div className="vc-surface rounded-2xl p-7 md:p-8 border border-slate-800 shadow-lg">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-xl font-semibold">Card Management</h2>
                    <p className="text-xs text-slate-400 mt-1">Control limits, permissions, and card identity.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm text-slate-200 items-stretch">
                  <div className="vc-inset rounded-xl border border-slate-800 p-5">
                    <div className="flex items-center justify-between gap-3 min-w-0">
                      <p className="text-xs text-slate-400">Cardholder ID</p>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!card?.cardholder_id) return
                          try {
                            await navigator.clipboard.writeText(card?.cardholder_id)
                            setCopiedCardholderId(true)
                            setTimeout(() => setCopiedCardholderId(false), 1500)
                          } catch (e) {
                            setCopiedCardholderId(false)
                          }
                        }}
                        className="flex items-center justify-center h-7 w-7 rounded-lg border border-slate-600 bg-slate-900 text-slate-300 hover:text-slate-100"
                        aria-label="Copy cardholder ID"
                        title={copiedCardholderId ? 'Copied' : 'Copy'}
                      >
                        <span className="sr-only">Copy</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path
                            d="M9 9h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z"
                            stroke="currentColor"
                            strokeWidth="1.6"
                          />
                          <path
                            d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                            stroke="currentColor"
                            strokeWidth="1.6"
                          />
                        </svg>
                      </button>
                    </div>
                    <p className="mt-2 font-mono text-[13px] break-all sm:break-normal sm:truncate" title={card?.cardholder_id || ''}>
                      {card?.cardholder_id || ''}
                    </p>
                  </div>
                  <div className="vc-inset rounded-xl border border-slate-800 p-5">
                    <div className="flex items-center justify-between gap-3 min-w-0">
                      <p className="text-xs text-slate-400">Card ID</p>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!card?.card_id) return
                          try {
                            await navigator.clipboard.writeText(card?.card_id)
                            setCopiedCardId(true)
                            setTimeout(() => setCopiedCardId(false), 1500)
                          } catch (e) {
                            setCopiedCardId(false)
                          }
                        }}
                        className="flex items-center justify-center h-7 w-7 rounded-lg border border-slate-600 bg-slate-900 text-slate-300 hover:text-slate-100"
                        aria-label="Copy card ID"
                        title={copiedCardId ? 'Copied' : 'Copy'}
                      >
                        <span className="sr-only">Copy</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path
                            d="M9 9h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z"
                            stroke="currentColor"
                            strokeWidth="1.6"
                          />
                          <path
                            d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                            stroke="currentColor"
                            strokeWidth="1.6"
                          />
                        </svg>
                      </button>
                    </div>
                    <p className="mt-2 font-mono text-[13px] break-all sm:break-normal sm:truncate" title={card?.card_id || ''}>
                      {card?.card_id || ''}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="block text-[11px] uppercase tracking-[0.2em] text-slate-400 mb-2">Card nickname</label>
                    <input
                      value={formData.first_name ? `${formData.first_name}'s Card` : 'Primary USD Card'}
                      readOnly
                      className="vc-input w-full rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase tracking-[0.2em] text-slate-400 mb-2">Monthly limit (USD)</label>
                    <input
                      value={displayCardLimit}
                      readOnly
                      className="vc-input w-full rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase tracking-[0.2em] text-slate-400 mb-2">Card type</label>
                    <input value={card?.card_type || 'Virtual'} readOnly className="vc-input w-full rounded-xl px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase tracking-[0.2em] text-slate-400 mb-2">Currency</label>
                    <input value={card?.card_currency || 'USD'} readOnly className="vc-input w-full rounded-xl px-3 py-2 text-sm" />
                  </div>
                </div>

                  {normalizedStatus === 'frozen' && (
                    <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                      <div className="font-semibold">Card frozen</div>
                      <div className="mt-1 text-[11px] text-red-200/90">
                        {frozenReason || 'Your card is temporarily frozen.'}
                      </div>
                      {frozenBy && (
                        <div className="mt-1 text-[11px] text-red-200/80">Frozen by: {frozenBy}</div>
                      )}
                    </div>
                  )}
                  <div className="mt-6 flex flex-wrap gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setShowInlineFund((prev) => {
                        if (!prev) setShowInlineWithdraw(false)
                        return !prev
                      })
                    }
                    className="vc-button-secondary px-4 py-2 rounded-xl font-semibold"
                  >
                    {showInlineFund
                      ? 'Hide funding'
                      : isPendingFunding
                      ? 'Activate card'
                      : 'Add funds'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setShowInlineWithdraw((prev) => {
                        if (!prev) setShowInlineFund(false)
                        return !prev
                      })
                    }
                    className="vc-button-secondary px-4 py-2 rounded-xl font-semibold"
                  >
                    {showInlineWithdraw ? 'Hide withdrawal' : 'Withdraw to Tunnel'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (freezeLoading) return
                      setFreezeLoading(true)
                      setFreezeError(null)
                      try {
                        if (isCardActive) {
                          await client.patch(`/cards/${card?.id}/freeze`)
                        } else {
                          await client.patch(`/cards/${card?.id}/unfreeze`)
                        }
                        const detailsRes = await client.get(`/cards/${card?.id}/details`)
                        setCardDetails(detailsRes?.data?.data || null)
                      } catch (error) {
                        setFreezeError('Unable to update card status right now.')
                      } finally {
                        setFreezeLoading(false)
                      }
                    }}
                    className="vc-button-secondary px-4 py-2 rounded-xl font-semibold text-xs"
                  >
                    {freezeLoading ? 'Updating...' : isCardActive ? 'Freeze card' : 'Unfreeze card'}
                  </button>
                </div>
                <AnimatePresence initial={false}>
                  {showInlineFund && (
                    <motion.form
                      key="inline-fund"
                      initial={{ opacity: 0, scaleY: 0 }}
                      animate={{ opacity: 1, scaleY: 1 }}
                      exit={{ opacity: 0, scaleY: 0 }}
                      transition={{ duration: 0.14, ease: 'easeOut' }}
                      className="origin-top overflow-hidden mt-4"
                      onSubmit={handleSubmitCreateCard}
                    >
                      <div className="vc-inset rounded-xl border border-slate-800 px-4 py-4 space-y-4">
                        <div>
                          <label className="block text-xs mb-1 text-slate-300">Funding amount (USD)</label>
                          <input
                            type="number"
                            name="amount"
                            value={formData.amount}
                            onChange={handleChange}
                            className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-sm"
                            placeholder="e.g. 10"
                            min="0"
                          />
                          <p className="mt-1 text-[11px] text-slate-500">
                            Minimum to activate: USD {minFunding}. Available:{' '}
                            <ShadowValue placeholder="***">USD {tunnelUsdBalance.toFixed(2)}</ShadowValue>
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-[11px] text-slate-300">
                          {!isExistingCard && (
                            <div className="flex items-center justify-between">
                              <span>Card creation fee (one-time)</span>
                              <span>{feeDue === 0 ? 'Paid' : `USD ${feeAmount.toFixed(2)}`}</span>
                            </div>
                          )}
                          <div className="mt-1 flex items-center justify-between">
                            <span>Funding amount</span>
                            <span>USD {Number(formData.amount || 0).toFixed(2)}</span>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-slate-100 font-semibold">
                            <span>Total debit now</span>
                            <span>USD {totalDebit.toFixed(2)}</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs mb-1 text-slate-300">
                            Transaction PIN ({PIN_LENGTH} digits)
                          </label>
                          <TransactionPinInput
                            value={formData.transaction_pin}
                            onChange={setPin}
                            length={PIN_LENGTH}
                            disabled={submitting}
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={submitting || !canCreate || !tunnelWallet?.id}
                          className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-md font-semibold text-sm disabled:opacity-60"
                        >
                          {submitting ? 'Processing...' : fundingCta}
                        </button>
                        {successCreate && (
                          <div
                            className={`mt-2 p-3 rounded-md text-xs ${
                              successCreate.ok
                                ? 'bg-emerald-900/40 border border-emerald-600'
                                : 'bg-red-900/40 border border-red-600'
                            }`}
                          >
                            <p>{successCreate.message}</p>
                          </div>
                        )}
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>
                <AnimatePresence initial={false}>
                  {showInlineWithdraw && (
                    <motion.form
                      key="inline-withdraw"
                      initial={{ opacity: 0, scaleY: 0 }}
                      animate={{ opacity: 1, scaleY: 1 }}
                      exit={{ opacity: 0, scaleY: 0 }}
                      transition={{ duration: 0.14, ease: 'easeOut' }}
                      className="origin-top overflow-hidden mt-4"
                      onSubmit={handleSubmitUnloadCard}
                    >
                      <div className="vc-inset rounded-xl border border-slate-800 px-4 py-4 space-y-4">
                        <div>
                          <label className="block text-xs mb-1 text-slate-300">Withdraw amount (USD)</label>
                          <input
                            type="number"
                            value={withdrawAmount}
                            onChange={(event) => setWithdrawAmount(event.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-sm"
                            placeholder="e.g. 10"
                            min="0"
                          />
                          <p className="mt-1 text-[11px] text-slate-500">
                            Funds move from your card balance to your Tunnel wallet after confirmation.
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs mb-1 text-slate-300">
                            Transaction PIN ({PIN_LENGTH} digits)
                          </label>
                          <TransactionPinInput
                            value={formData.transaction_pin}
                            onChange={setPin}
                            length={PIN_LENGTH}
                            disabled={submitting}
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={submitting || !canWithdraw}
                          className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-md font-semibold text-sm disabled:opacity-60"
                        >
                          {submitting ? 'Processing...' : 'Withdraw to Tunnel'}
                        </button>
                        {withdrawResult && (
                          <div
                            className={`mt-2 p-3 rounded-md text-xs ${
                              withdrawResult.ok
                                ? 'bg-emerald-900/40 border border-emerald-600'
                                : 'bg-red-900/40 border border-red-600'
                            }`}
                          >
                            <p>{withdrawResult.message}</p>
                          </div>
                        )}
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>
                {freezeError && <p className="mt-2 text-xs text-red-400">{freezeError}</p>}
              </div>

              {hasInsights && (
                <div className="vc-surface rounded-2xl p-6 border border-slate-800 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold">Card Insights</h4>
                    <span className="text-[11px] text-slate-400">Last 7 days</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {todaysSpend > 0 && (
                      <div className="vc-inset rounded-xl border border-slate-800 px-3 py-3">
                        <p className="text-xs text-slate-400">Today's spend</p>
                        <p className="text-lg font-semibold">USD {todaysSpend.toFixed(2)}</p>
                      </div>
                    )}
                    {hasLastFunding && (
                      <div className="vc-inset rounded-xl border border-slate-800 px-3 py-3">
                        <p className="text-xs text-slate-400">Last funding</p>
                        <p className="text-lg font-semibold">USD {lastFunding.toFixed(2)}</p>
                      </div>
                    )}
                    {hasLastMerchant && (
                      <div className="vc-inset rounded-xl border border-slate-800 px-3 py-3">
                        <p className="text-xs text-slate-400">Last merchant</p>
                        <p className="text-sm font-semibold">{lastMerchant}</p>
                      </div>
                    )}
                    {failedAttempts > 0 && (
                      <div className="vc-inset rounded-xl border border-slate-800 px-3 py-3">
                        <p className="text-xs text-slate-400">Failed attempts</p>
                        <p className="text-lg font-semibold">{failedAttempts}</p>
                      </div>
                    )}
                    {hasTrend && (
                      <div className="vc-inset rounded-xl border border-slate-800 px-3 py-3">
                        <p className="text-xs text-slate-400">Spend trend</p>
                        <div className="mt-2 flex items-end gap-1 h-10">
                          {spendTrend.map((value, index) => (
                            <div
                              key={`trend-${index}`}
                              className="vc-chart-bar w-2 rounded-sm"
                              style={{ height: `${Math.max(4, Math.min(40, value))}px` }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                      <span>Card activity</span>
                      {cardHistoryLoading ? <span>Loading...</span> : <span>{cardHistory.length} entries</span>}
                    </div>
                    <div className="space-y-2 text-xs">
                      {cardHistory.slice(0, 8).map((entry) => (
                        <div key={entry.id} className="vc-inset rounded-xl border border-slate-800 px-3 py-2">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-300">{entry.address || 'Card activity'}</span>
                            <span className="text-slate-200">
                              {entry.amount ? `USD ${Number(entry.amount).toFixed(2)}` : '--'}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                            <span>{entry.status}</span>
                            <span>{entry.created_at ? new Date(entry.created_at).toLocaleString() : ''}</span>
                          </div>
                          <div className="mt-2 text-[11px]">
                            {entry?.reference ? (
                              <button
                                type="button"
                                onClick={() => navigate(`/dashboard/receipt/${entry.reference}`)}
                                className="text-indigo-300 hover:text-indigo-200"
                              >
                                View receipt
                              </button>
                            ) : (
                              <span className="text-slate-500">Receipt unavailable</span>
                            )}
                          </div>
                          {entry?.decline_reason === 'insufficient_balance' && (
                            <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
                              Insufficient USD balance to cover purchase + fees.
                            </div>
                          )}
                          {entry?.breakdown &&
                            (entry.breakdown.total_debit_usd ||
                              entry.breakdown.provider_fee_usd ||
                              entry.breakdown.bitbridge_fee_usd ||
                              entry.breakdown.fx_markup_usd ||
                              entry.breakdown.funding_fee_usd ||
                              entry.breakdown.withdrawal_fee_usd ||
                              entry.breakdown.total_credit_usd) && (
                              <div className="mt-2 space-y-1 text-[11px] text-slate-400">
                                <div className="flex items-center justify-between">
                                  <span>Principal</span>
                                  <span>USD {Number(entry.breakdown.principal_usd || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span>Provider fee</span>
                                  <span>USD {Number(entry.breakdown.provider_fee_usd || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span>BitBridge fee</span>
                                  <span>USD {Number(entry.breakdown.bitbridge_fee_usd || 0).toFixed(2)}</span>
                                </div>
                                {entry.breakdown.funding_fee_usd !== undefined ? (
                                  <div className="flex items-center justify-between">
                                    <span>Funding fee</span>
                                    <span>
                                      USD {Number(entry.breakdown.funding_fee_usd || 0).toFixed(2)}
                                    </span>
                                  </div>
                                ) : null}
                                {entry.breakdown.withdrawal_fee_usd !== undefined ? (
                                  <div className="flex items-center justify-between">
                                    <span>Withdrawal fee</span>
                                    <span>
                                      USD {Number(entry.breakdown.withdrawal_fee_usd || 0).toFixed(2)}
                                    </span>
                                  </div>
                                ) : null}
                                <div className="flex items-center justify-between">
                                  <span>FX markup</span>
                                  <span>USD {Number(entry.breakdown.fx_markup_usd || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between text-slate-200 font-semibold">
                                  <span>Total debit</span>
                                  <span>USD {Number(entry.breakdown.total_debit_usd || 0).toFixed(2)}</span>
                                </div>
                                {entry.breakdown.total_credit_usd !== undefined ? (
                                  <div className="flex items-center justify-between text-slate-200 font-semibold">
                                    <span>Total credit</span>
                                    <span>
                                      USD {Number(entry.breakdown.total_credit_usd || 0).toFixed(2)}
                                    </span>
                                  </div>
                                ) : null}
                              </div>
                            )}
                          {entry?.fx &&
                            (entry.fx.merchant_currency || entry.fx.billing_currency) && (
                              <div className="mt-2 space-y-1 text-[11px] text-slate-400">
                                {entry.fx.merchant_currency && entry.fx.merchant_amount ? (
                                  <div className="flex items-center justify-between">
                                    <span>Merchant amount</span>
                                    <span>
                                      {Number.isFinite(Number(entry.fx.merchant_amount))
                                        ? `${Number(entry.fx.merchant_amount).toFixed(2)} ${
                                            entry.fx.merchant_currency
                                          }`
                                        : '--'}
                                    </span>
                                  </div>
                                ) : null}
                                {entry.fx.billing_currency && entry.fx.billing_amount ? (
                                  <div className="flex items-center justify-between">
                                    <span>Billing amount</span>
                                    <span>
                                      {Number.isFinite(Number(entry.fx.billing_amount))
                                        ? `${Number(entry.fx.billing_amount).toFixed(2)} ${
                                            entry.fx.billing_currency
                                          }`
                                        : '--'}
                                    </span>
                                  </div>
                                ) : null}
                                {entry.fx.fx_implied_rate !== null &&
                                entry.fx.fx_implied_rate !== undefined ? (
                                  <div className="flex items-center justify-between">
                                    <span>Implied FX rate</span>
                                    <span>
                                      {Number.isFinite(Number(entry.fx.fx_implied_rate))
                                        ? Number(entry.fx.fx_implied_rate).toFixed(4)
                                        : '--'}
                                    </span>
                                  </div>
                                ) : null}
                                {entry.fx.fx_reference_rate !== null &&
                                entry.fx.fx_reference_rate !== undefined ? (
                                  <div className="flex items-center justify-between">
                                    <span>Reference FX rate</span>
                                    <span>
                                      {Number.isFinite(Number(entry.fx.fx_reference_rate))
                                        ? Number(entry.fx.fx_reference_rate).toFixed(4)
                                        : '--'}
                                    </span>
                                  </div>
                                ) : null}
                                {entry.fx.fx_margin_usd !== null &&
                                entry.fx.fx_margin_usd !== undefined ? (
                                  <div className="flex items-center justify-between">
                                    <span>FX margin (USD)</span>
                                    <span>
                                      {Number.isFinite(Number(entry.fx.fx_margin_usd))
                                        ? `USD ${Number(entry.fx.fx_margin_usd).toFixed(2)}`
                                        : '--'}
                                    </span>
                                  </div>
                                ) : null}
                              </div>
                            )}
                        </div>
                      ))}
                      {!cardHistoryLoading && cardHistory.length === 0 && (
                        <p className="text-[11px] text-slate-400">No card activity yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="vc-grid-col flex flex-col gap-6">
              <div className="vc-surface rounded-2xl p-6 border border-slate-800 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold">Virtual Card</h3>
                    <p className="text-xs text-slate-400">Premium card surface with live controls.</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-cyan-300">
                    <span
                      className={`h-2 w-2 rounded-full ${isCardActive ? 'bg-cyan-400 vc-pulse' : 'bg-slate-400'}`}
                    />
                    {isCardActive ? 'Active' : 'Frozen'}
                  </div>
                </div>

                <div className="mt-6 min-h-[300px]">
                  <div className="relative mx-auto max-w-md">
                    <div
                      className={`vc-tilt vc-card-glass vc-neon-edge relative w-full rounded-3xl p-6 overflow-hidden min-h-[220px] ${
                        isCardActive ? '' : 'vc-card-frozen'
                      }`}
                      onMouseMove={onCardMove}
                      onMouseLeave={onCardLeave}
                      style={{ '--tilt-x': `${cardTilt.y}deg`, '--tilt-y': `${cardTilt.x}deg` }}
                    >
                      <div className="absolute inset-0 vc-reflection opacity-60" />
                      <div className="absolute -inset-2 vc-shimmer opacity-40" />
                      <div className="relative z-10">
                        <div className="flex items-center justify-between text-xs">
                          <div className="font-semibold tracking-[0.12em]">BitBridge Global</div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase vc-card-label">Lock</span>
                          </div>
                        </div>
                        <div className="mt-6 text-2xl tracking-[0.22em] font-mono">{cardPanDisplay}</div>
                        <div className="mt-4 flex items-center justify-between text-xs">
                          <div>
                            <p className="vc-card-label">Cardholder</p>
                            <p className="text-sm font-medium vc-card-value">
                              {formData.first_name || formData.last_name
                                ? `${formData.first_name} ${formData.last_name}`
                                : 'Full Name'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="vc-card-label">Status</p>
                            <p className="text-sm font-medium vc-card-value">{isCardActive ? 'Active' : 'Frozen'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-400">
                  <div className="vc-inset rounded-xl border border-slate-800 px-3 py-2">Protected by BitBridge Shield</div>
                </div>
              </div>

              {(cardInfoLoading || detailItems.length > 0 || balanceAmount !== null) && (
                <div className="vc-surface rounded-2xl p-6 border border-slate-800 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold">Card Details</h4>
                    <span className="text-[11px] text-slate-400">Live from issuer</span>
                  </div>

                  {cardInfoLoading ? (
                    <p className="text-xs text-slate-400">Loading card details...</p>
                  ) : (
                    <div className="space-y-4">
                      {balanceAmount !== null && (
                        <div className="vc-inset rounded-xl border border-slate-800 px-4 py-3">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Available balance</p>
                          <p className="text-lg font-semibold text-slate-100">USD {Number(balanceAmount || 0).toFixed(2)}</p>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-slate-400">
                          Card numbers and CVV are protected. Use the secure viewer to reveal masked details.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
  if (showCardDetails) {
    setShowCardDetails(false)
    setCardReveal(null)
    setRevealPin('')
    setCardRevealError(null)
    return
  }

  // Open PIN modal for reveal (don’t depend on fund/withdraw PIN input)
  setCardRevealError(null)
  setRevealPin('')
  setShowRevealPinModal(true)
}}

                          className="vc-button-secondary px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-60"
                          disabled={!showCardDetails && (cardRevealLoading || Date.now() < revealCooldownUntil)}
                        >
                          {cardRevealLoading ? 'Revealing...' : showCardDetails ? 'Hide card details' : 'View card details'}
                        </button>
                      </div>
                      {cardRevealError && (
                        <p className="text-xs text-red-400">{cardRevealError}</p>
                      )}

                      <AnimatePresence initial={false}>
                        {showCardDetails && (
                          <motion.div
                            key="card-details-inline"
                            initial={{ opacity: 0, scaleY: 0 }}
                            animate={{ opacity: 1, scaleY: 1 }}
                            exit={{ opacity: 0, scaleY: 0 }}
                            transition={{ duration: 0.14, ease: 'easeOut' }}
                            className="origin-top overflow-hidden will-change-transform"
                          >
                            <div className="vc-inset rounded-xl border border-slate-800 px-4 py-4 text-sm text-slate-200">
                              <div className="grid gap-3">
                            <div className="vc-inset rounded-xl border border-slate-800 px-3 py-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Card number</p>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!revealPanValue) return
                                    try {
                                      await navigator.clipboard.writeText(revealPanValue)
                                      setCopiedPan(true)
                                      setTimeout(() => setCopiedPan(false), 1500)
                                    } catch (e) {
                                      setCopiedPan(false)
                                    }
                                  }}
                                  className="flex items-center justify-center h-7 w-7 rounded-lg border border-slate-600 bg-slate-900 text-slate-300 hover:text-slate-100"
                                  aria-label="Copy card number"
                                  title={copiedPan ? 'Copied' : 'Copy'}
                                  disabled={!revealPanValue}
                                >
                                  <span className="sr-only">Copy</span>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                    <path
                                      d="M9 9h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z"
                                      stroke="currentColor"
                                      strokeWidth="1.6"
                                    />
                                    <path
                                      d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                                      stroke="currentColor"
                                      strokeWidth="1.6"
                                    />
                                  </svg>
                                </button>
                              </div>
                              <p className="text-base font-semibold">{revealPanValue || 'Unavailable'}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="vc-inset rounded-xl border border-slate-800 px-3 py-3">
                                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Expiry</p>
                                <p className="text-sm font-semibold">{revealExpiryValue || 'Unavailable'}</p>
                              </div>
                              <div className="vc-inset rounded-xl border border-slate-800 px-3 py-3">
                                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">CVV</p>
                                <p className="text-sm font-semibold">{revealCvvValue || 'Hidden'}</p>
                              </div>
                            </div>
                            {cardReveal?.billing_address && (
                              <div className="vc-inset rounded-xl border border-slate-800 px-3 py-3 text-xs text-slate-300">
                                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Billing address</p>
                                <p className="mt-1">
                                  {cardReveal.billing_address.billing_address1 || 'N/A'}
                                </p>
                                <p>
                                  {cardReveal.billing_address.billing_city || ''}{' '}
                                  {cardReveal.billing_address.state || ''}
                                </p>
                                <p>
                                  {cardReveal.billing_address.billing_country || ''}{' '}
                                  {cardReveal.billing_address.billing_zip_code || ''}
                                </p>
                              </div>
                            )}
                            {(revealLast4 || last4Value) && (
                              <p className="text-xs text-slate-400">Card ending in {revealLast4 || last4Value}</p>
                            )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {detailItems.length > 0 && (
                        <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
                          {detailItems.map((item) => (
                            <div key={item.label} className="vc-inset rounded-xl border border-slate-800 px-3 py-2">
                              <p className="text-[10px] uppercase tracking-[0.2em]">{item.label}</p>
                              <p className="text-sm text-slate-100 mt-1 truncate" title={String(item.value)}>{item.value}</p>
                            </div>
                          ))}
                        </div>
                      )}

                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        

        {showCardholderForm && (
          /* SECTION 1 */
          <section className="vc-grid-shell grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-8">
          {/* Left */}
          <div className="vc-grid-col vc-surface bg-slate-900 rounded-2xl p-6 md:p-7 border border-slate-800 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold">Cardholder Profile</h2>
                <p className="text-xs text-slate-400 mt-1">We'll use this information to verify and create your card.</p>
              </div>

              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    cardType === 'virtual' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-800 text-slate-300'
                  }`}
                  onClick={() => setCardType('virtual')}
                  aria-pressed={cardType === 'virtual'}
                >
                  Virtual
                </button>
                <button
                  type="button"
                  disabled
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    cardType === 'physical' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  Physical (coming soon)
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmitCardholder} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  placeholder="First Name"
                  className="p-2.5 rounded-md bg-slate-800 border border-slate-700 text-sm w-full"
                  disabled={!!user.user_profile}
                />
                <input
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  placeholder="Last Name"
                  className="p-2.5 rounded-md bg-slate-800 border border-slate-700 text-sm w-full"
                  disabled={!!user.user_profile}
                />
                <input
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Phone"
                  className="p-2.5 rounded-md bg-slate-800 border border-slate-700 text-sm w-full"
                  disabled={!!user.user_profile}
                />
                <input
                  name="email_address"
                  value={formData.email_address}
                  onChange={handleChange}
                  placeholder="Email Address"
                  className="p-2.5 rounded-md bg-slate-800 border border-slate-700 text-sm w-full"
                  disabled={!!user.user_profile}
                />
              </div>

              <div className="pt-2">
                <h3 className="text-sm font-semibold text-slate-200 mb-2">Address</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Street Address"
                    className="p-2.5 rounded-md bg-slate-800 border border-slate-700 text-sm w-full"
                    required
                  />
                  <input
                    name="house_no"
                    value={formData.house_no}
                    onChange={handleChange}
                    placeholder="House No"
                    className="p-2.5 rounded-md bg-slate-800 border border-slate-700 text-sm w-full"
                    required
                  />
                  <input
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="City"
                    className="p-2.5 rounded-md bg-slate-800 border border-slate-700 text-sm w-full"
                    required
                  />
                  <select
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    className="p-2.5 rounded-md bg-slate-800 border border-slate-700 text-sm w-full"
                    required
                  >
                    <option value="">Select State</option>
                    {availableStates.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <input
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    placeholder="Country"
                    className="p-2.5 rounded-md bg-slate-800 border border-slate-700 text-sm w-full"
                    disabled
                  />
                  <input
                    name="postal_code"
                    value={formData.postal_code}
                    onChange={handleChange}
                    placeholder="Postal Code"
                    className="p-2.5 rounded-md bg-slate-800 border border-slate-700 text-sm w-full"
                  />
                </div>
              </div>

              <div className="pt-2">
                <h3 className="text-sm font-semibold text-slate-200 mb-2">Identity</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    name="id_type"
                    value={formData.id_type}
                    onChange={handleChange}
                    placeholder="ID Type"
                    className="p-2.5 rounded-md bg-slate-800 border border-slate-700 text-sm w-full"
                    disabled={!!user.user_profile}
                  />
                  <input
                    name="bvn"
                    value={formData.bvn}
                    onChange={handleChange}
                    placeholder="BVN"
                    className="p-2.5 rounded-md bg-slate-800 border border-slate-700 text-sm w-full"
                  />
                </div>
                <div className="mt-4">
                  <SelfieCapture
                    value={formData.selfie_image || null}
                    onChange={(dataUrl) => {
                      setFormData((prev) => ({ ...prev, selfie_image: dataUrl || '' }))
                      setCardholderCameraError('')
                    }}
                    onError={(msg) => setCardholderCameraError(msg || '')}
                    title="Live selfie"
                    hint="Use good lighting, center your face, and hold still."
                  />
                  {requiresSelfie ? (
                    <p className="text-[11px] text-slate-400 mt-2">Required for BVN cardholder verification.</p>
                  ) : null}
                  {cardholderCameraError ? (
                    <div className="mt-2 rounded-md border border-red-700/40 bg-red-900/20 p-2 text-xs text-red-200">
                      {cardholderCameraError}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="pt-2 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 mb-1">Meta data (optional)</h3>
                  <input
                    name="meta_data.any_key"
                    value={formData.meta_data.any_key}
                    onChange={handleChange}
                    placeholder="Any extra reference"
                    className="p-2.5 rounded-md bg-slate-800 border border-slate-700 text-sm w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-300 mb-1">Daily spend limit (USD)</label>
                  <input
                    name="limit"
                    value={formData.limit}
                    onChange={handleChange}
                    type="number"
                    min={1000}
                    disabled
                    className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-sm text-slate-100"
                  />
                </div>
              </div>

              <div className="pt-1 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    id="tos"
                    name="agreeTos"
                    type="checkbox"
                    checked={formData.agreeTos}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-slate-700 text-indigo-500 bg-slate-900"
                  />
                  <label htmlFor="tos" className="text-xs text-slate-400">
                    I agree to the <span className="text-indigo-400 underline">terms and conditions</span>.
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-md font-semibold text-sm disabled:opacity-60"
                  >
 {submitting ? 'Submitting...' : 'Submit cardholder profile'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        limit: 5000,
                        address: '',
                        house_no: '',
                        city: '',
                        state: '',
                        postal_code: '',
                        selfie_image: '',
                        meta_data: { any_key: '' },
                        agreeTos: false,
                      }))
                      setSuccess(null)
                    }}
                    className="px-4 py-2.5 bg-slate-800 rounded-md text-xs"
                  >
                    Reset fields
                  </button>
                </div>

                {success && (
                  <div
                    className={`mt-2 p-3 rounded-md text-xs ${
                      success.ok ? 'bg-emerald-900/40 border border-emerald-600' : 'bg-red-900/40 border border-red-600'
                    }`}
                  >
                    <p>{success.message}</p>
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* Right - Preview */}
          <div className="vc-grid-col flex flex-col gap-5">
            <div className="vc-dark-surface rounded-2xl p-5 bg-gradient-to-br from-slate-900/60 to-black/60 border border-slate-800 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-medium">Card Preview</h3>
                <span className="text-[11px] text-slate-400">{cardType === 'virtual' ? 'Virtual' : 'Physical'}</span>
              </div>

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md mx-auto">
                <div
                  className={`vc-card-preview relative rounded-xl p-6 min-h-[160px] ${
                    formData.design === 'midnight'
                      ? 'bg-gradient-to-br from-indigo-900 to-slate-900'
                      : formData.design === 'aurora'
                      ? 'bg-gradient-to-br from-emerald-700 to-indigo-900'
                      : 'bg-gradient-to-br from-slate-800 to-black'
                  } text-white`}
                >
                  <div className="flex justify-between items-start text-xs">
                    <div className="font-semibold opacity-90">BitBridge Global</div>
                    <div className="opacity-80">USD</div>
                  </div>

                  <div className="mt-6 text-2xl tracking-wide font-mono">**** **** **** {String(formData.limit).slice(-4)}</div>
                  <div className="mt-4 flex justify-between items-center text-xs">
                    <div>
                      <div className="text-slate-200/80">Cardholder</div>
                      <div className="font-medium text-sm">
 {formData.first_name || formData.last_name ? `${formData.first_name} ${formData.last_name}` : 'Full Name'}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-slate-200/80">Type</div>
 <div className="font-medium text-sm">{cardType === 'virtual' ? 'Virtual' : 'Physical'}</div>
                    </div>
                  </div>

                  <div className="absolute right-4 bottom-4 text-[10px] opacity-80">{formData.design.toUpperCase()}</div>
                </div>
              </motion.div>

              <div className="mt-3 text-xs text-slate-400">Preview updates live as you fill your details.</div>
            </div>

            <div className="vc-surface rounded-2xl p-4 bg-slate-900/60 border border-slate-800 text-xs">
              <h4 className="font-medium mb-2">Quick summary</h4>
              <ul className="space-y-1 text-slate-300">
                <li>
 <strong>Type:</strong> {cardType === 'virtual' ? 'Virtual' : 'Physical'}
                </li>
                <li>
 <strong>Holder:</strong> {formData.first_name || formData.last_name ? `${formData.first_name} ${formData.last_name}` : 'N/A'}
                </li>
                <li>
                  <strong>Email:</strong> {formData.email_address || 'N/A'}
                </li>
                <li>
                  <strong>Tunnel balance:</strong>{' '}
                  <ShadowValue placeholder="***">USD {tunnelUsdBalance.toFixed(2)}</ShadowValue>
                </li>
              </ul>
            </div>
          </div>
          </section>
        )}

        {showCreateForm && (
          /* SECTION 2 */
          <section className="vc-grid-shell grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-8">
          <div className="vc-grid-col vc-surface bg-slate-900 rounded-2xl p-6 md:p-7 border border-slate-800 shadow-lg">
            <h2 className="text-xl font-semibold mb-2">{fundingTitle}</h2>
            <p className="text-xs text-slate-400 mb-4">
              Card creation has a one-time fee. Funding activates the card (minimum USD {minFunding}).
            </p>

            {!tunnelWallet?.id && (
              <div className="mb-4 rounded-xl border border-orange-700/40 bg-orange-900/20 p-3 text-xs text-orange-200">
                Tunnel wallet is not active. Open <b>Wallet / Tunnel</b> and tap "Activate Tunnel".
              </div>
            )}
            {cardholderVerificationBlockedCreate && !isExistingCard && (
              <div className="mb-4 rounded-xl border border-sky-700/40 bg-sky-900/20 p-3 text-xs text-sky-100">
                <div className="font-semibold">
                  Cardholder verification status: {cardholderStatusLabel || 'In progress'}
                </div>
                <div className="mt-1 text-[11px] text-sky-200/90">
                  {cardholderVerificationFailed
                    ? 'Verification failed at provider. Re-submit cardholder details to continue.'
                    : 'Verification is processing. Card creation is unlocked automatically after provider confirmation webhook.'}
                </div>
                {formatStatusTime(cardholderStatusUpdatedAt) && (
                  <div className="mt-1 text-[11px] text-sky-200/80">
                    Last update: {formatStatusTime(cardholderStatusUpdatedAt)}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleRefreshCardholderStatus}
                  disabled={refreshingVerification}
                  className="mt-2 inline-flex items-center rounded-md border border-sky-400/50 px-2.5 py-1 text-[11px] font-semibold text-sky-100 hover:bg-sky-800/40 disabled:opacity-60"
                >
                  {refreshingVerification ? 'Refreshing...' : 'Refresh verification status'}
                </button>
              </div>
            )}

            <form onSubmit={handleSubmitCreateCard} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs mb-1 text-slate-300">Currency</label>
                  <input disabled type="text" value="USD" className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-sm" />
                </div>

                <div>
                  <label className="block text-xs mb-1 text-slate-300">Funding wallet</label>
                  <input disabled type="text" value="Tunnel (USD)" className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-xs mb-1 text-slate-300">Funding Amount (USD)</label>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-sm"
                  placeholder="0 (activate later) or 5+"
                  min="0"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Minimum to activate: USD {minFunding}. Available:{' '}
                  <ShadowValue placeholder="***">USD {tunnelUsdBalance.toFixed(2)}</ShadowValue>
                </p>
              </div>

              <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-[11px] text-slate-300">
                {!isExistingCard && (
                  <div className="flex items-center justify-between">
                    <span>Card creation fee (one-time)</span>
                    <span>{feeDue === 0 ? 'Paid' : `USD ${feeAmount.toFixed(2)}`}</span>
                  </div>
                )}
                <div className="mt-1 flex items-center justify-between">
                  <span>Funding amount</span>
                  <span>USD {Number(formData.amount || 0).toFixed(2)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-slate-100 font-semibold">
                  <span>Total debit now</span>
                  <span>USD {totalDebit.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs mb-1 text-slate-300">Transaction PIN ({PIN_LENGTH} digits)</label>
                <TransactionPinInput
                  value={formData.transaction_pin}
                  onChange={setPin}
                  length={PIN_LENGTH}
                  disabled={submitting}
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !canCreate || !tunnelWallet?.id}
                className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-md font-semibold text-sm disabled:opacity-60"
              >
                {submitting ? 'Processing...' : fundingCta}
              </button>

              {successCreate && (
                <div
                  className={`mt-3 p-3 rounded-md text-xs ${
 successCreate.ok ? 'bg-emerald-900/40 border border-emerald-600' : 'bg-red-900/40 border border-red-600'
                  }`}
                >
                  <p>{successCreate.message}</p>
                </div>
              )}
            </form>
          </div>

          <div className="vc-grid-col vc-surface bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-lg">
            <h3 className="text-base font-medium mb-3">Card Preview</h3>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="vc-card-preview rounded-xl bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-6 min-h-[160px]"
            >
              <div className="flex justify-between items-start text-xs">
                <div className="font-semibold opacity-90">BitBridge Global</div>
                <div className="opacity-80">USD</div>
              </div>

              <div className="mt-6 text-2xl tracking-wide font-mono">**** **** **** 5000</div>
              <div className="mt-4 flex justify-between items-center text-xs">
                <div>
                  <div className="text-slate-200/80">Cardholder ID</div>
                  <div className="font-medium text-sm">{card?.cardholder_id || 'N/A'}</div>
                </div>
                <div className="text-right">
                  <div className="text-slate-200/80">Funding</div>
                  <div className="font-medium text-sm">USD {Number(formData.amount || 0).toFixed(2)}</div>
                </div>
              </div>
            </motion.div>

            <div className="mt-3 text-xs text-slate-400">This reflects the create/fund form inputs.</div>
          </div>
          </section>
        )}

              <AnimatePresence>
        {showRevealPinModal && (
          <motion.div
            key="reveal-pin-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 px-4"
            onMouseDown={() => {
              if (cardRevealLoading) return
              setShowRevealPinModal(false)
              setRevealPin('')
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.98 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-950 p-5 text-slate-100 shadow-2xl"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold">Enter transaction PIN</h4>
                  <p className="mt-1 text-xs text-slate-400">
                    We need your {PIN_LENGTH}-digit PIN to reveal full card details securely.
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 hover:text-slate-100"
                  onClick={() => {
                    if (cardRevealLoading) return
                    setShowRevealPinModal(false)
                    setRevealPin('')
                  }}
                >
                  Close
                </button>
              </div>

              <div className="mt-4">
                <TransactionPinInput
                  value={revealPin}
                  onChange={setRevealPinValue}
                  length={PIN_LENGTH}
                  disabled={cardRevealLoading}
                />
              </div>

              {cardRevealError && (
                <p className="mt-2 text-xs text-red-400">{cardRevealError}</p>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 border border-slate-700 hover:bg-slate-800 disabled:opacity-60"
                  disabled={cardRevealLoading}
                  onClick={() => {
                    if (cardRevealLoading) return
                    setShowRevealPinModal(false)
                    setRevealPin('')
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="flex-1 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
                  disabled={cardRevealLoading || revealPin.length !== PIN_LENGTH}
                  onClick={async () => {
                    const now = Date.now()
                    if (now < revealCooldownUntil || cardRevealLoading) return

                    if (revealPin.length !== PIN_LENGTH) {
                      setCardRevealError(`Enter your ${PIN_LENGTH}-digit transaction PIN.`)
                      return
                    }

                    setCardRevealLoading(true)
                    setCardRevealError(null)

                    try {
                      // ✅ Most compatible payloads (try the common ones)
                      // If your backend expects a different shape, we can match it after checking the PCI controller.
                      const response = await client.post(`/pci/cards/${card?.id}/reveal`, {
                        transaction_pin: revealPin,
                      })

                      setCardReveal(response?.data?.data || null)
                      setShowCardDetails(true)
                      setShowRevealPinModal(false)
                      setRevealPin('')
                      setRevealCooldownUntil(now + 3000)
                    } catch (error) {
                      setCardRevealError('Unable to reveal card details right now.')
                    } finally {
                      setCardRevealLoading(false)
                    }
                  }}
                >
                  {cardRevealLoading ? 'Revealing...' : 'Reveal'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


        
      </div>
      </div>
    </>
  )
}
