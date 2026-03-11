import { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import nairaFormat from '../../../utils/nairaFormat'

import './styles.scss'

import { FaArrowLeft } from 'react-icons/fa'
import { clearUserPinLockout, getUser, userUpdate } from '../../../redux/actions/user'
import dateFormater from '../../../utils/dateFormat'
import statusStyle from '../../../utils/statusStyle'
import Loading from '../../../components/loader/Loading'
import { pickTextColor } from '../../../utils/slect-color'
import ClickButton from '../../../components/button/ClickButton'
import BreadCrunbs from '../../../components/Breadcrumbs/BreadCrunbs'
import AppModal from '../../../components/modal/Modal'
import { toast } from 'react-toastify'
import { getOrders, updateOrder } from '../../../redux/actions/order'
import { Button, Form } from 'antd'
import FormInput from '../../../components/formInput/FormInput'
import { createUserTransaction } from '../../../redux/actions/transaction'
import { SET_LOADING } from '../../../redux/app'
import client from '../../../api/client'
import { getAdminUserKycReuse } from '../../../api/adminOps'

const ViewUser = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()
  const { user, loading } = useSelector((state) => state.user)
  const { user: adminUser } = useSelector((state) => state.auth)
  const [selectedId, setSelectedId] = useState(null)
  const [open, setOpen] = useState(false)
  const [openActivate, setOpenActivate] = useState(false)
  const [openAccountModal, setOpenAccountModal] = useState(false)
  const [transactionType, setTransactionType] = useState('deposit')
  const [formLayout] = useState('vertical')
  const [activeTab, setActiveTab] = useState('overview')
  const [revealData, setRevealData] = useState(null)
  const [revealError, setRevealError] = useState('')
  const [revealLoading, setRevealLoading] = useState(false)
  const revealTimerRef = useRef(null)
  const [mockDebitLoading, setMockDebitLoading] = useState({})
  const [mockDebitResult, setMockDebitResult] = useState({})
  const [eventsLoading, setEventsLoading] = useState({})
  const [cardEvents, setCardEvents] = useState({})
  const [statusRefreshLoading, setStatusRefreshLoading] = useState({})
  const [syncLoading, setSyncLoading] = useState({})
  const [expandedEvents, setExpandedEvents] = useState({})
  const [providerDetails, setProviderDetails] = useState({})
  const [providerDetailsLoading, setProviderDetailsLoading] = useState({})
  const [providerTransactions, setProviderTransactions] = useState({})
  const [providerTransactionsLoading, setProviderTransactionsLoading] = useState({})
  const [providerLookupRefs, setProviderLookupRefs] = useState({})
  const [providerLookupResult, setProviderLookupResult] = useState({})
  const [enrichLoading, setEnrichLoading] = useState({})
  const [kycReuseLoading, setKycReuseLoading] = useState(false)
  const [kycReuseError, setKycReuseError] = useState('')
  const [kycReuse, setKycReuse] = useState(null)

  const [form] = Form.useForm()

  useEffect(() => {
    dispatch(getUser(id))
  }, [dispatch, id])

  useEffect(() => {
    let active = true

    const loadKycReuse = async () => {
      try {
        setKycReuseLoading(true)
        setKycReuseError('')
        const res = await getAdminUserKycReuse(id)
        if (!active) return
        setKycReuse(res?.data?.data?.kyc_reuse || null)
      } catch (error) {
        if (!active) return
        setKycReuseError(
          error?.response?.data?.message || 'Unable to load reusable BVN triage.'
        )
      } finally {
        if (active) setKycReuseLoading(false)
      }
    }

    loadKycReuse()

    return () => {
      active = false
    }
  }, [id])

  const handleSubmit = (values) => {
    dispatch(SET_LOADING(true))
    dispatch(
      createUserTransaction({
        ...values,
        wallet_id: user.wallet.id,
        coin_type: 'bank',
        currency: 'ngn',
        address: 'N/A',
        status: 'approved',
        transaction_type: transactionType,
      })
    )
      .unwrap()
      .then((result) => {
        dispatch(SET_LOADING(false))

        toast(result.message ?? 'successful transaction', { type: 'success' })
        dispatch(getUser(id))

        setOpenAccountModal(false)
      })
      .catch((error) => {
        dispatch(SET_LOADING(false))

        toast(error.message ?? 'Transaction failed', { type: 'error' })
      })
  }

  const handleOrderUpdate = (task) => {
    dispatch(
      updateOrder({
        id: selectedId,
        data: { status: task },
      })
    ).then((result) => {
      if (updateOrder.fulfilled.match(result)) {
        toast(result.message, { type: 'success' })
        dispatch(getOrders())
      } else {
        toast(result.message, { type: 'error' })
      }
    })
  }

  const handleUserstatus = () => {
    dispatch(
      userUpdate({
        id,
        data: { active: user?.active ? false : true },
      })
    ).then((result) => {
      if (userUpdate.fulfilled.match(result)) {
        toast(result.message, { type: 'success' })
        dispatch(getUser(id))

        setOpenActivate(false)
      } else {
        toast(result.message, { type: 'error' })
      }
    })
  }

  const handleClearPinLockout = () => {
    dispatch(clearUserPinLockout(id))
      .unwrap()
      .then((result) => {
        toast(result.message ?? 'Transaction PIN lockout cleared', { type: 'success' })
        dispatch(getUser(id))
      })
      .catch((error) => {
        toast(error.message ?? 'Unable to clear PIN lockout', { type: 'error' })
      })
  }

  const handleReveal = async () => {
    setRevealError('')
    setRevealLoading(true)
    try {
      const res = await client.post(`/admin/users/${id}/reveal`)
      setRevealData(res?.data?.data || null)
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
      revealTimerRef.current = setTimeout(() => setRevealData(null), 60 * 1000)
    } catch (error) {
      const status = error?.response?.status
      if (status === 401) {
        const returnTo = encodeURIComponent(`${location.pathname}${location.search}`)
        navigate(`/admin/login?return=${returnTo}`)
        return
      }
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        'Unable to reveal sensitive data.'
      setRevealError(message)
    } finally {
      setRevealLoading(false)
    }
  }

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
    }
  }, [])

  const handleMockDebit = async (cardId) => {
    setMockDebitLoading((prev) => ({ ...prev, [cardId]: true }))
    try {
      const res = await client.post(`/admin/cards/${cardId}/mock_debit`)
      const payload = res?.data?.data || {}
      setMockDebitResult((prev) => ({ ...prev, [cardId]: payload }))
      const warning = res?.data?.warning
      toast(res?.data?.message || 'Mock debit queued', { type: 'success' })
      if (warning) {
        toast(warning, { type: 'info' })
      }
      handleRefreshEvents(cardId)
    } catch (error) {
      const message =
        error?.response?.data?.message || error?.response?.data?.error || 'Unable to trigger mock debit'
      toast(message, { type: 'error' })
    } finally {
      setMockDebitLoading((prev) => ({ ...prev, [cardId]: false }))
    }
  }

  const handleRefreshEvents = async (cardId) => {
    setEventsLoading((prev) => ({ ...prev, [cardId]: true }))
    try {
      const res = await client.get(`/admin/cards/${cardId}/events`, { params: { limit: 5 } })
      const events = Array.isArray(res?.data?.data)
        ? res.data.data
        : Array.isArray(res?.data?.data?.events)
        ? res.data.data.events
        : []
      setCardEvents((prev) => ({ ...prev, [cardId]: events }))
    } catch (error) {
      const message =
        error?.response?.data?.message || error?.response?.data?.error || 'Unable to fetch card events'
      toast(message, { type: 'error' })
    } finally {
      setEventsLoading((prev) => ({ ...prev, [cardId]: false }))
    }
  }

  const handleRefreshCardStatus = async (cardId) => {
    setStatusRefreshLoading((prev) => ({ ...prev, [cardId]: true }))
    try {
      const res = await client.post(`/admin/cards/${cardId}/refresh-provider-status`)
      toast(res?.data?.message || 'Card status refreshed', { type: 'success' })
      const data = res?.data?.data || {}
      setProviderDetails((prev) => ({
        ...prev,
        [cardId]: {
          ...(prev[cardId] || {}),
          provider_status: data.provider_status,
          provider_livemode: data.provider_livemode,
          provider_updated_at: data.provider_updated_at,
          balance: data.balance,
          currency: data.currency,
        },
      }))
      dispatch(getUser(id))
    } catch (error) {
      const statusCode = error?.response?.data?.data?.status_code
      const snippet = error?.response?.data?.data?.error_snippet
      const message =
        error?.response?.data?.message || error?.response?.data?.error || 'Unable to refresh card status'
      const detail = [statusCode ? `status ${statusCode}` : null, snippet].filter(Boolean).join(' · ')
      toast(detail ? `${message} (${detail})` : message, { type: 'error' })
    } finally {
      setStatusRefreshLoading((prev) => ({ ...prev, [cardId]: false }))
    }
  }

  const handleSyncTransactions = async (cardId) => {
    setSyncLoading((prev) => ({ ...prev, [cardId]: true }))
    try {
      const res = await client.post(`/admin/cards/${cardId}/sync-transactions`, { limit: 20 })
      const counts = res?.data?.data || {}
      const upserted = counts.upserted_count ?? 0
      const created = counts.created_count ?? 0
      const updated = counts.updated_count ?? 0
      toast(
        res?.data?.message ||
          `Card transactions synced (upserted ${upserted}: ${created} new, ${updated} updated)`,
        { type: 'success' }
      )
      setProviderDetails((prev) => ({
        ...prev,
        [cardId]: {
          ...(prev[cardId] || {}),
          last_sync_at: counts.last_sync_at,
          latest_provider_tx_at: counts.latest_provider_tx_at,
        },
      }))
      handleRefreshEvents(cardId)
    } catch (error) {
      const message =
        error?.response?.data?.message || error?.response?.data?.error || 'Unable to sync card transactions'
      toast(message, { type: 'error' })
    } finally {
      setSyncLoading((prev) => ({ ...prev, [cardId]: false }))
    }
  }

  const handleFetchProviderDetails = async (cardId) => {
    setProviderDetailsLoading((prev) => ({ ...prev, [cardId]: true }))
    try {
      const res = await client.get(`/admin/cards/${cardId}/provider-details`)
      const data = res?.data?.data || {}
      setProviderDetails((prev) => ({ ...prev, [cardId]: data }))
      toast(res?.data?.message || 'Provider details fetched', { type: 'success' })
    } catch (error) {
      const statusCode = error?.response?.data?.data?.status_code
      const snippet = error?.response?.data?.data?.error_snippet
      const message =
        error?.response?.data?.message || error?.response?.data?.error || 'Unable to fetch provider details'
      const detail = [statusCode ? `status ${statusCode}` : null, snippet].filter(Boolean).join(' · ')
      toast(detail ? `${message} (${detail})` : message, { type: 'error' })
    } finally {
      setProviderDetailsLoading((prev) => ({ ...prev, [cardId]: false }))
    }
  }

  const handleFetchProviderTransactions = async (cardId) => {
    setProviderTransactionsLoading((prev) => ({ ...prev, [cardId]: true }))
    try {
      const res = await client.get(`/admin/cards/${cardId}/provider-transactions`, {
        params: { page: 1 },
      })
      const data = res?.data?.data || {}
      setProviderTransactions((prev) => ({ ...prev, [cardId]: data }))
      toast(res?.data?.message || 'Provider transactions fetched', { type: 'success' })
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        'Unable to fetch provider transactions'
      toast(message, { type: 'error' })
    } finally {
      setProviderTransactionsLoading((prev) => ({ ...prev, [cardId]: false }))
    }
  }

  const handleProviderLookup = async (cardId, type) => {
    const reference = providerLookupRefs[cardId]?.trim()
    if (!reference) {
      toast('Enter a transaction reference first.', { type: 'error' })
      return
    }
    try {
      const endpoint =
        type === 'status'
          ? `/admin/cards/${cardId}/provider-transaction-status`
          : `/admin/cards/${cardId}/provider-transaction`
      const res = await client.get(endpoint, { params: { reference } })
      const data = res?.data?.data || {}
      setProviderLookupResult((prev) => ({ ...prev, [cardId]: data }))
      toast(res?.data?.message || 'Provider transaction fetched', { type: 'success' })
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        'Unable to fetch provider transaction'
      toast(message, { type: 'error' })
    }
  }

  useEffect(() => {
    if (!Array.isArray(user?.cards)) return
    user.cards.forEach((card) => {
      if (!cardEvents[card.id]) {
        handleRefreshEvents(card.id)
      }
    })
  }, [user?.cards, cardEvents])

  const handleEnrichTransaction = async (cardId, reference) => {
    if (!reference) {
      toast('Missing provider reference for this event.', { type: 'error' })
      return
    }
    setEnrichLoading((prev) => ({ ...prev, [reference]: true }))
    try {
      const res = await client.post(`/admin/cards/${cardId}/enrich-transaction`, null, {
        params: { reference },
      })
      const payload = res?.data?.data || {}
      const enriched = payload.enriched ? 'Enriched' : 'No FX fields found'
      toast(`${enriched} for ${reference}`, { type: 'success' })
      handleRefreshEvents(cardId)
    } catch (error) {
      const message =
        error?.response?.data?.message || error?.response?.data?.error || 'Unable to enrich transaction'
      toast(message, { type: 'error' })
    } finally {
      setEnrichLoading((prev) => ({ ...prev, [reference]: false }))
    }
  }

  const toggleEventExpanded = (eventId) => {
    setExpandedEvents((prev) => ({ ...prev, [eventId]: !prev[eventId] }))
  }

  const no_items = 10
  const pages = Math.ceil((user?.transactions?.length ?? 1) / no_items)
  const [activePage, setActivePage] = useState(0)
  const fromPos = activePage * no_items
  const toPos = no_items + fromPos

  // ---------------------------
  // 🔎 Derived profile & KYC info
  // ---------------------------
  const profile = user?.user_profile || {}
  const userKyc = user?.user_kyc || {}
  const adminRole =
    adminUser?.admin_role ||
    (adminUser?.role === 'super_admin' ? 'super_admin' : adminUser?.role === 'admin' ? 'support' : null)
  const canReveal = adminRole === 'compliance' || adminRole === 'super_admin'
  const isSuperAdmin = adminRole === 'super_admin'
  const cardDebugEnabled = user?.admin_flags?.card_debug_enabled === true

  const bvnStatusRaw = userKyc?.bvn_status || 'unverified'
  const bvnStatusLabel =
    bvnStatusRaw === 'verified'
      ? 'Verified'
      : bvnStatusRaw === 'pending_review'
      ? 'Pending review'
      : bvnStatusRaw === 'mismatch'
      ? 'Mismatch'
      : bvnStatusRaw === 'locked'
      ? 'Locked'
      : bvnStatusRaw === 'failed'
      ? 'Failed'
      : 'Not submitted'
  const bvnLast4 = userKyc?.bvn_last4 ? `****${userKyc.bvn_last4}` : 'Not provided'
  const bvnReference = userKyc?.bvn_provider_reference || 'Not available'
  const bvnVerifiedAt = userKyc?.bvn_verified_at
    ? dateFormater(userKyc.bvn_verified_at)
    : 'Not verified'
  const bvnMatchFlags = [
    { label: 'DOB match', value: userKyc?.bvn_dob_match },
    { label: 'First name match', value: userKyc?.bvn_first_name_match },
    { label: 'Last name match', value: userKyc?.bvn_last_name_match },
  ]
  const bvnWatchlisted =
    userKyc?.watchlisted === true
      ? 'Watchlisted'
      : userKyc?.watchlisted === false
      ? 'Not watchlisted'
      : 'Unknown'
  const bvnSnapshot = userKyc?.bvn_snapshot || null
  const bvnSnapshotName = bvnSnapshot
    ? [bvnSnapshot.first_name, bvnSnapshot.last_name].filter(Boolean).join(' ')
    : ''
  const bvnSnapshotDob = bvnSnapshot?.dob ? dateFormater(bvnSnapshot.dob) : 'Not available'
  const bvnSnapshotCapturedAt = bvnSnapshot?.captured_at
    ? dateFormater(bvnSnapshot.captured_at)
    : 'Not available'
  const bvnSnapshotExpiresAt = bvnSnapshot?.expires_at
    ? dateFormater(bvnSnapshot.expires_at)
    : 'Not available'
  const bvnSnapshotReference = bvnSnapshot?.reference || 'Not available'
  const bvnSnapshotWatchlisted =
    bvnSnapshot?.watchlisted === true
      ? 'Watchlisted'
      : bvnSnapshot?.watchlisted === false
      ? 'Not watchlisted'
      : 'Unknown'
  const hasBvnSnapshot =
    !!bvnSnapshot && !!(bvnSnapshot.first_name || bvnSnapshot.last_name || bvnSnapshot.dob)
  const bvnAttempts = userKyc?.bvn_attempts_count ?? 0
  const bvnLockedUntil = userKyc?.bvn_locked_until
    ? dateFormater(userKyc.bvn_locked_until)
    : 'Not locked'

  const emailDisplay = revealData?.email || user?.email || 'Not provided'
  const phoneDisplay = revealData?.phone_number || profile.phone_number || 'Not provided'

  const fullName =
    [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Not provided'

  const phoneNumber = phoneDisplay

  const addressParts = [
    profile.address_line1,
    profile.address_line2,
    profile.city,
    profile.state,
    profile.country,
  ].filter(Boolean)

  const addressDisplay = addressParts.length > 0 ? addressParts.join(', ') : 'Not provided'

  // KYC document URLs coming from UserProfileSerializer
  const idDocumentUrl = profile.id_document_url
  const proofOfAddressUrl = profile.proof_of_address_url

  const revealAccounts = useMemo(() => {
    const list = Array.isArray(revealData?.virtual_accounts) ? revealData.virtual_accounts : []
    return list.reduce((acc, item) => {
      if (item?.id) acc[item.id] = item
      return acc
    }, {})
  }, [revealData])

  const primaryUseCaseMap = {
    send_receive: 'Send & receive money',
    virtual_cards: 'Virtual cards & online spend',
    airtime_utilities: 'Airtime, data & utilities',
    taxes: 'Taxes & statutory payments',
    student_life: 'Student life & campus spend',
  }

  const primaryUseCaseLabel =
    (user?.primary_use_case && primaryUseCaseMap[user.primary_use_case]) ||
    user?.primary_use_case ||
    'Not set'

  const onboardingStageLabel = user?.onboarding_stage
    ? user.onboarding_stage.replace(/_/g, ' ')
    : 'Not set'

  const kycLevelLabel = user?.kyc_level || 'Not set'
  const idTypeLabel = user?.id_type ? user.id_type.toUpperCase() : 'Not provided'
  const kycReuseActionLabel =
    kycReuse?.recommended_action === 'secure_reconciliation_for_anchor_and_cards'
      ? 'Anchor and cards exposed'
      : kycReuse?.recommended_action === 'secure_reconciliation_for_cards'
      ? 'Cards exposed'
      : kycReuse?.recommended_action === 'monitor_anchor_safe_cards_risky'
      ? 'Anchor safe, cards risky'
      : kycReuse?.recommended_action === 'secure_bvn_reentry_before_anchor_or_cards'
      ? 'Re-entry before Anchor or cards'
      : 'No immediate action'
  const kycReuseStatusLabel = kycReuse?.needs_review
    ? 'Needs review'
    : kycReuse?.reusable_bvn_available
    ? 'Reusable'
    : kycReuse?.bvn_verified
    ? 'Verified only'
    : 'Not verified'
  const kycReuseSupportInstruction =
    kycReuse?.recommended_action === 'secure_reconciliation_for_anchor_and_cards'
      ? 'Pause Anchor and card assistance until support securely reconciles reusable BVN for this user.'
      : kycReuse?.recommended_action === 'secure_reconciliation_for_cards'
      ? 'Do not continue card setup until the user securely re-enters BVN or support reconciles the reusable BVN record.'
      : kycReuse?.recommended_action === 'monitor_anchor_safe_cards_risky'
      ? 'Anchor is already safe. Only block future card setup until reusable BVN is restored.'
      : kycReuse?.recommended_action === 'secure_bvn_reentry_before_anchor_or_cards'
      ? 'Direct the user to secure BVN re-entry before starting Anchor or card flows.'
      : 'No support action is required right now.'
  const kycReuseSupportTone =
    kycReuse?.needs_review && (kycReuse?.has_anchor_account || kycReuse?.has_cards || kycReuse?.has_cardholder_profile)
      ? 'is-risk'
      : kycReuse?.needs_review
      ? 'is-warning'
      : 'is-safe'

  const isStudentUseCase = user?.primary_use_case === 'student_life'
  const pinSetLabel = user?.transaction_pin_set ? 'Set' : 'Not set'
  const pinLocked = user?.transaction_pin_locked
  const pinRemainingSeconds = Number(user?.transaction_pin_lock_remaining_seconds || 0)
  const pinRemainingMinutes =
    pinLocked && pinRemainingSeconds > 0 ? Math.ceil(pinRemainingSeconds / 60) : 0

  const formatUsd = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return 'Not available'
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(Number(value))
  }

  const formatAdminAmount = (amount, currency, walletType) => {
    const value = Number(amount || 0)
    if (Number.isNaN(value)) return '--'
    const code =
      currency ||
      (walletType === 'usd' ? 'USD' : walletType === 'ngn' ? 'NGN' : null)

    if (!code || code.toUpperCase() === 'NGN') {
      return nairaFormat(value, 'ngn')
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code.toUpperCase(),
      minimumFractionDigits: 2,
    }).format(value)
  }

  const formatCardAmount = (value, currency) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return 'Not available'
    }
    if (!currency) {
      return Number(value).toLocaleString()
    }
    if (currency.toUpperCase() === 'USD') {
      return formatUsd(value)
    }
    return `${Number(value).toLocaleString()} ${currency.toUpperCase()}`
  }

  const copyToClipboard = (text) => {
    if (!text) return
    const value = text.toString()
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard
        .writeText(value)
        .then(() => toast('Copied', { type: 'success' }))
        .catch(() => {
          fallbackCopy(value)
        })
    } else {
      fallbackCopy(value)
    }
  }

  const fallbackCopy = (value) => {
    const input = document.createElement('input')
    input.value = value
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    toast('Copied', { type: 'success' })
  }

  const wallets = Array.isArray(user?.wallets) ? user.wallets : []
  const ngnWallet = wallets.find((wallet) => wallet.wallet_type === 'ngn') || user?.wallet
  const usdWallet = wallets.find((wallet) => wallet.wallet_type === 'usd')
  const accounts = Array.isArray(user?.accounts) ? user.accounts : []

  const walletData = useMemo(
    () => [
      {
        label: 'NGN Balance',
        value: nairaFormat(ngnWallet?.balance),
      },
      {
        label: 'NGN Total Deposit',
        value: nairaFormat(ngnWallet?.total_deposit),
      },
      {
        label: 'NGN Total Withdrawal',
        value: nairaFormat(ngnWallet?.withdrawn),
      },
      {
        label: 'NGN Total Bills',
        value: nairaFormat(ngnWallet?.total_bills),
      },
      {
        label: 'Tunnel (USD) Balance',
        value: formatUsd(usdWallet?.balance),
      },
    ],
    [ngnWallet, usdWallet]
  )

  const cards = Array.isArray(user?.cards) ? user.cards : []
  const activityCardEvents = useMemo(() => {
    const entries = []
    Object.values(cardEvents || {}).forEach((list) => {
      if (Array.isArray(list)) {
        entries.push(...list)
      }
    })
    return entries.sort((a, b) => {
      const aTime = a?.created_at ? new Date(a.created_at).getTime() : 0
      const bTime = b?.created_at ? new Date(b.created_at).getTime() : 0
      return bTime - aTime
    })
  }, [cardEvents])
  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'financial', label: 'Financial' },
    { key: 'compliance', label: 'KYC & Compliance' },
    { key: 'activity', label: 'Activity' },
  ]

  return (
    <>
      <div className="admin-user-page">
        <div className="admin-user-shell">
          <div className="admin-user-header">
            <button
              type="button"
              className="admin-user-back"
              onClick={() => navigate(-1)}
            >
              <FaArrowLeft />
              <span>Back</span>
            </button>

            <div className="admin-user-title">
              <p className="admin-user-eyebrow">Admin user</p>
              <h1>Profile overview</h1>
              <p className="admin-user-email">{emailDisplay}</p>
            </div>

            <div className="admin-user-badges">
              <span className={`admin-badge ${user?.active ? 'is-active' : 'is-inactive'}`}>
                {user?.active ? 'Active' : 'Inactive'}
              </span>
              <span className="admin-badge is-role">{user?.role || 'user'}</span>
              <span className="admin-badge is-kyc">{kycLevelLabel}</span>
            </div>
          </div>

          <div className="admin-user-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`admin-user-tab ${activeTab === tab.key ? 'is-active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'overview' ? (
          <div className="admin-user-card admin-user-summary">
              <div className="admin-card-header">
              <div>
                <p className="admin-card-eyebrow">Account snapshot</p>
                <h2>Core details</h2>
              </div>
              <div className="admin-card-aside">
                <span className="admin-card-label">Wallets</span>
                <span className="admin-card-value">NGN + USD</span>
              </div>
            </div>

            <div className="admin-user-grid">
              <div className="admin-kv">
                <span>Email</span>
                <strong>{emailDisplay}</strong>
              </div>
              <div className="admin-kv">
                <span>User ID</span>
                <strong>{id}</strong>
              </div>
              <div className="admin-kv">
                <span>Balance</span>
                <strong>{nairaFormat(ngnWallet?.balance)}</strong>
              </div>
              <div className="admin-kv">
                <span>Status</span>
                <strong>{user?.status ?? (user?.active ? 'Active' : 'Inactive')}</strong>
              </div>
              <div className="admin-kv">
                <span>Role</span>
                <strong className="capitalize">{user?.role || 'user'}</strong>
              </div>
              <div className="admin-kv">
                <span>Wallet ID</span>
                <strong>{ngnWallet?.id || 'Not available'}</strong>
              </div>
            </div>
          </div>
          ) : null}

          {activeTab === 'financial' ? (
          <div className="admin-user-card admin-user-wallets">
            <div className="admin-card-header">
              <div>
                <p className="admin-card-eyebrow">Balances</p>
                <h2>Wallet overview</h2>
              </div>
              <div className="admin-card-aside">
                <span className="admin-card-label">Primary</span>
                <span className="admin-card-value">NGN</span>
              </div>
            </div>
            <div className="admin-user-grid admin-user-grid--wide">
              {walletData.map((item) => (
                <div className="admin-kv" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
          ) : null}

          {activeTab === 'financial' ? (
          <div className="admin-user-card admin-user-accounts">
            <div className="admin-card-header">
              <div>
                <p className="admin-card-eyebrow">Virtual accounts</p>
                <h2>Bank accounts</h2>
              </div>
              <div className="admin-card-aside">
                <span className="admin-card-label">Count</span>
                <span className="admin-card-value">{accounts.length}</span>
              </div>
            </div>
            {accounts.length === 0 ? (
              <p className="admin-empty">No virtual accounts found for this user.</p>
            ) : (
              <div className="admin-user-grid admin-user-grid--wide">
                {accounts.map((account) => {
                  const revealedAccount = revealAccounts[account.id]
                  const accountNumber =
                    revealedAccount?.account_number ||
                    account.account_number ||
                    (account.account_last4 ? `****${account.account_last4}` : 'Not available')

                  return (
                    <div className="admin-kv" key={account.id}>
                      <span>{account.bank_name || account.vendor || 'Virtual account'}</span>
                      <strong>{accountNumber}</strong>
                      <div className="admin-kv-meta">
                        <span>{account.currency || 'NGN'}</span>
                        <span className="capitalize">{account.status || 'active'}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          ) : null}

          {activeTab === 'compliance' ? (
          <div className="admin-user-card admin-user-profile">
            <div className="admin-card-header">
              <div>
                <p className="admin-card-eyebrow">Profile and compliance</p>
                <h2>Identity and KYC</h2>
              </div>
              <div className="admin-card-aside">
                <span className="admin-card-label">Onboarding</span>
                <span className="admin-card-value capitalize">{onboardingStageLabel}</span>
              </div>
            </div>

            <div className="admin-reveal-row">
              <div>
                <p className="admin-reveal-title">PII is masked by default</p>
                <p className="admin-reveal-sub">Reveals expire after 60 seconds.</p>
              </div>
              {canReveal ? (
                <button
                  type="button"
                  onClick={handleReveal}
                  className="admin-reveal-button"
                  disabled={revealLoading}
                >
                  {revealLoading ? 'Revealing...' : 'Reveal PII'}
                </button>
              ) : null}
            </div>
            {revealError ? <p className="admin-reveal-error">{revealError}</p> : null}

            <div className="admin-user-card admin-user-card--subtle admin-kyc-reuse">
              <div className="admin-card-header">
                <div>
                  <p className="admin-card-eyebrow">Downstream reuse</p>
                  <h2>Reusable BVN triage</h2>
                </div>
                <div className="admin-card-aside">
                  <span className="admin-card-label">Status</span>
                  <span className={`admin-badge ${kycReuse?.needs_review ? 'is-warning' : 'is-active'}`}>
                    {kycReuseStatusLabel}
                  </span>
                </div>
              </div>

              {kycReuseLoading ? (
                <p className="admin-empty">Loading reusable BVN triage...</p>
              ) : kycReuseError ? (
                <p className="admin-reveal-error">{kycReuseError}</p>
              ) : (
                <>
                  <p className="admin-kyc-reuse-copy">
                    {kycReuse?.needs_review
                      ? 'This user is marked BVN-verified on the platform, but provider-safe BVN reuse is not available yet.'
                      : 'This user has a reusable BVN posture that is safe for downstream provider flows.'}
                  </p>
                  <div className="admin-kyc-reuse-flags">
                    <span className={`admin-chip ${kycReuse?.reusable_bvn_available ? 'is-safe' : 'is-risk'}`}>
                      Reusable BVN: {kycReuse?.reusable_bvn_available ? 'Yes' : 'No'}
                    </span>
                    <span className="admin-chip">
                      Anchor: {kycReuse?.has_anchor_account ? (kycReuse?.anchor_account_provisioned ? 'Provisioned' : 'Started') : 'No account'}
                    </span>
                    <span className="admin-chip">
                      Cards: {kycReuse?.has_cards ? 'Active cards' : kycReuse?.has_cardholder_profile ? 'Cardholder only' : 'No card setup'}
                    </span>
                    <span className="admin-chip">
                      Guidance: {kycReuseActionLabel}
                    </span>
                  </div>
                  <div className={`admin-kyc-reuse-note ${kycReuseSupportTone}`}>
                    <span className="admin-kyc-reuse-note__label">Support next step</span>
                    <p>{kycReuseSupportInstruction}</p>
                  </div>
                </>
              )}
            </div>

            <div className="admin-user-grid admin-user-grid--wide">
              <div className="admin-kv">
                <span>Full name</span>
                <strong>{fullName}</strong>
              </div>
              <div className="admin-kv">
                <span>Email</span>
                <strong>{emailDisplay}</strong>
              </div>
              <div className="admin-kv">
                <span>Phone</span>
                <strong>{phoneNumber}</strong>
              </div>
              <div className="admin-kv">
                <span>Primary use case</span>
                <strong>
                  {primaryUseCaseLabel}
                  {isStudentUseCase && <span className="admin-chip">Student</span>}
                </strong>
              </div>
              <div className="admin-kv">
                <span>KYC level</span>
                <strong>{kycLevelLabel}</strong>
              </div>
              <div className="admin-kv">
                <span>ID type</span>
                <strong>{idTypeLabel}</strong>
              </div>
              <div className="admin-kv">
                <span>BVN last 4</span>
                <strong>{bvnLast4}</strong>
              </div>
              <div className="admin-kv">
                <span>BVN status</span>
                <strong>{bvnStatusLabel}</strong>
              </div>
              <div className="admin-kv">
                <span>BVN reference</span>
                <strong>{bvnReference}</strong>
              </div>
              <div className="admin-kv">
                <span>BVN verified at</span>
                <strong>{bvnVerifiedAt}</strong>
              </div>
              <div className="admin-kv">
                <span>BVN watchlist</span>
                <strong>{bvnWatchlisted}</strong>
              </div>
              <div className="admin-kv">
                <span>BVN attempts</span>
                <strong>{bvnAttempts}</strong>
              </div>
              <div className="admin-kv">
                <span>BVN lockout</span>
                <strong>{bvnLockedUntil}</strong>
              </div>
              <div className="admin-kv">
                <span>Transaction PIN</span>
                <strong>{pinSetLabel}</strong>
              </div>
              <div className="admin-kv">
                <span>PIN lockout</span>
                <strong>{pinLocked ? `Locked (${pinRemainingMinutes} min)` : 'Not locked'}</strong>
              </div>
              <div className="admin-kv admin-kv--wide">
                <span>Address</span>
                <strong>{addressDisplay}</strong>
              </div>
              <div className="admin-kv admin-kv--wide">
                <span>KYC documents</span>
                {idDocumentUrl || proofOfAddressUrl ? (
                  <div className="admin-doc-links">
                    {idDocumentUrl && (
                      <a href={idDocumentUrl} target="_blank" rel="noopener noreferrer">
                        View ID document
                      </a>
                    )}
                    {proofOfAddressUrl && (
                      <a href={proofOfAddressUrl} target="_blank" rel="noopener noreferrer">
                        View proof of address
                      </a>
                    )}
                  </div>
                ) : (
                  <strong>No documents uploaded</strong>
                )}
              </div>
              <div className="admin-kv admin-kv--wide">
                <span>BVN match flags</span>
                <div className="admin-doc-links">
                  {bvnMatchFlags.map((flag) => (
                    <span key={flag.label} className="admin-chip">
                      {flag.label}: {flag.value === true ? 'Yes' : flag.value === false ? 'No' : 'Unknown'}
                    </span>
                  ))}
                </div>
              </div>
              {isSuperAdmin && (
                <div className="admin-kv admin-kv--wide">
                  <span>BVN provider snapshot (super admin)</span>
                  {hasBvnSnapshot ? (
                    <div className="admin-doc-links">
                      <span className="admin-chip">Name: {bvnSnapshotName || 'Not available'}</span>
                      <span className="admin-chip">DOB: {bvnSnapshotDob}</span>
                      <span className="admin-chip">Reference: {bvnSnapshotReference}</span>
                      <span className="admin-chip">Watchlist: {bvnSnapshotWatchlisted}</span>
                      <span className="admin-chip">Captured: {bvnSnapshotCapturedAt}</span>
                      <span className="admin-chip">Expires: {bvnSnapshotExpiresAt}</span>
                    </div>
                  ) : (
                    <strong>No BVN snapshot available</strong>
                  )}
                </div>
              )}
            </div>
          </div>
          ) : null}

          {activeTab === 'financial' ? (
          <div className="admin-user-card admin-user-cards">
            <div className="admin-card-header">
              <div>
                <p className="admin-card-eyebrow">Bridge cards</p>
                <h2>Card status</h2>
              </div>
              <div className="admin-card-aside">
                <span className="admin-card-label">Count</span>
                <span className="admin-card-value">{cards.length}</span>
              </div>
            </div>
            {cards.length === 0 ? (
              <p className="admin-empty">No cards found for this user.</p>
            ) : (
              <div className="admin-card-grid">
                {cards.map((card) => {
                  const cardId = card.id
                  const eventRows = Array.isArray(cardEvents[cardId]) ? cardEvents[cardId] : []
                  const mockResult = mockDebitResult[cardId]
                  const isMockLoading = Boolean(mockDebitLoading[cardId])
                  const isEventsLoading = Boolean(eventsLoading[cardId])
                  const isStatusRefreshing = Boolean(statusRefreshLoading[cardId])
                  const isSyncing = Boolean(syncLoading[cardId])
                  const isProviderLoading = Boolean(providerDetailsLoading[cardId])
                  const isProviderTxLoading = Boolean(providerTransactionsLoading[cardId])
                  const providerInfo = providerDetails[cardId]
                  const providerTx = providerTransactions[cardId]
                  const providerLookup = providerLookupResult[cardId]
                  const debugContext = providerInfo?.debug_context
                  const bridgeEnv = debugContext?.env_name || card.bridgecard_env || 'sandbox'
                  const tokenSource = debugContext?.token_source
                  const isLiveEnv =
                    typeof debugContext?.livemode_expected === 'boolean'
                      ? debugContext.livemode_expected
                      : bridgeEnv === 'live'
                  const metaStatus =
                    card?.meta_data?.status || card?.meta_data?.card_status || card?.meta_data?.state
                  const internalStatus = card.status || 'pending'
                  const providerStatus =
                    providerInfo?.provider_status || card.provider_status || metaStatus
                  const providerLivemode =
                    typeof providerInfo?.provider_livemode !== 'undefined'
                      ? providerInfo.provider_livemode
                      : card.provider_livemode
                  const displayStatus = providerStatus || internalStatus
                  const statusMismatch =
                    providerStatus && internalStatus && providerStatus !== internalStatus
                  const statusDrift =
                    internalStatus === 'pending' && providerStatus === 'active'

                  return (
                    <div className="admin-card-item" key={card.id}>
                      <div className="admin-card-item__top">
                        <div>
                          <p className="admin-card-item__brand">
                            {card.card_brand || 'Card'}
                          </p>
                          <p className="admin-card-item__id">
                            {card.card_last4 ? `**** ${card.card_last4}` : 'Not available'}
                          </p>
                        </div>
                        <span
                          className={`admin-badge ${
                            displayStatus === 'active' ? 'is-active' : 'is-warning'
                          }`}
                        >
                          {displayStatus}
                        </span>
                        {statusMismatch ? (
                          <span className="admin-badge admin-badge--mismatch">Mismatch</span>
                        ) : null}
                        {statusDrift ? (
                          <span className="admin-badge admin-badge--mismatch">
                            Status drift — refresh status
                          </span>
                        ) : null}
                        {isLiveEnv ? (
                          <span className="admin-badge admin-badge--mismatch">Live mode</span>
                        ) : null}
                      </div>
                      <div className="admin-card-item__meta">
                        <div>
                          <span>Expiry</span>
                          <strong>
                            {card.exp_month && card.exp_year
                              ? `${card.exp_month}/${card.exp_year}`
                              : 'Not available'}
                          </strong>
                        </div>
                      </div>
                      <div className="admin-card-item__meta admin-card-item__meta--details">
                        <div>
                          <span>Balance</span>
                          <strong>
                            {formatCardAmount(
                              providerInfo?.balance ?? card?.meta_data?.provider_balance,
                              providerInfo?.currency || card.card_currency
                            )}
                          </strong>
                        </div>
                        <div>
                          <span>Provider status</span>
                          <strong>{providerStatus || 'Not available'}</strong>
                        </div>
                        <div>
                          <span>Internal status</span>
                          <strong>{internalStatus || 'Not available'}</strong>
                        </div>
                        <div>
                          <span>Provider livemode</span>
                          <strong>
                            {typeof providerLivemode !== 'undefined'
                              ? providerLivemode
                                ? 'Live'
                                : 'Sandbox'
                              : 'Not available'}
                          </strong>
                        </div>
                        <div>
                          <span>Last provider sync</span>
                          <strong>
                            {card.provider_updated_at || card.status_last_refreshed_at
                              ? dateFormater(card.provider_updated_at || card.status_last_refreshed_at)
                              : 'Not synced'}
                          </strong>
                        </div>
                        <div>
                          <span>Card ID</span>
                          <strong>{card.card_id || 'Not available'}</strong>
                        </div>
                        <div>
                          <span>Cardholder ID</span>
                          <strong>{card.cardholder_id || 'Not available'}</strong>
                        </div>
                        <div>
                          <span>Currency</span>
                          <strong>{card.card_currency || 'Not available'}</strong>
                        </div>
                        <div>
                          <span>Limit</span>
                          <strong>
                            {formatCardAmount(
                              card.card_limit_usd ?? card.card_limit,
                              card.card_currency
                            )}
                          </strong>
                        </div>
                        <div>
                          <span>Funding</span>
                          <strong>
                            {formatCardAmount(
                              card.funding_amount_usd ?? card.funding_amount,
                              card.card_currency
                            )}
                          </strong>
                        </div>
                        <div>
                          <span>Reference</span>
                          <strong>{card.transaction_reference || 'Not available'}</strong>
                        </div>
                      </div>
                      {isSuperAdmin ? (
                        <div className="admin-card-item__actions">
                          <div className="admin-card-action-row">
                            {cardDebugEnabled ? (
                              <button
                                type="button"
                                className="admin-card-action"
                                onClick={() => handleMockDebit(cardId)}
                                disabled={isMockLoading || isLiveEnv}
                                title={isLiveEnv ? 'Mock disabled in live' : ''}
                              >
                                {isMockLoading ? 'Triggering...' : 'Mock Debit (Sandbox)'}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="admin-card-action admin-card-action--ghost"
                              onClick={() => handleRefreshEvents(cardId)}
                              disabled={isEventsLoading}
                            >
                              {isEventsLoading ? 'Refreshing...' : 'Refresh Events'}
                            </button>
                            {cardDebugEnabled ? (
                              <button
                                type="button"
                                className="admin-card-action admin-card-action--ghost"
                                onClick={() => handleSyncTransactions(cardId)}
                                disabled={isSyncing}
                              >
                                {isSyncing ? 'Syncing...' : 'Sync Transactions'}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="admin-card-action admin-card-action--ghost"
                              onClick={() => handleRefreshCardStatus(cardId)}
                              disabled={isStatusRefreshing}
                            >
                              {isStatusRefreshing ? 'Syncing...' : 'Refresh Status'}
                            </button>
                            {cardDebugEnabled ? (
                              <button
                                type="button"
                                className="admin-card-action admin-card-action--ghost"
                                onClick={() => handleFetchProviderDetails(cardId)}
                                disabled={isProviderLoading}
                              >
                                {isProviderLoading ? 'Fetching...' : 'Fetch card details'}
                              </button>
                            ) : null}
                          </div>
                          {mockResult?.transaction_reference ? (
                            <p className="admin-card-item__note">
                              Last mock: {mockResult.transaction_reference}
                            </p>
                          ) : null}
                          {cardDebugEnabled ? (
                            <>
                              <p className="admin-card-item__hint">
                                Webhook may take a few seconds. In local mode, events are pulled via sync.
                              </p>
                              <div className="admin-card-provider-debug">
                                <div className="admin-card-provider-meta">
                                  <span className="admin-chip">Bridgecard: {bridgeEnv}</span>
                                  {tokenSource ? (
                                    <span className="admin-card-item__hint">
                                      Token source: {tokenSource}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="admin-card-action-row">
                                  <button
                                    type="button"
                                    className="admin-card-action admin-card-action--ghost"
                                    onClick={() => handleFetchProviderTransactions(cardId)}
                                    disabled={isProviderTxLoading}
                                  >
                                    {isProviderTxLoading ? 'Fetching...' : 'Sync last 20 transactions'}
                                  </button>
                                </div>
                                <div className="admin-card-provider-lookup">
                                  <input
                                    type="text"
                                    placeholder="Transaction reference"
                                    value={providerLookupRefs[cardId] || ''}
                                    onChange={(event) =>
                                      setProviderLookupRefs((prev) => ({
                                        ...prev,
                                        [cardId]: event.target.value,
                                      }))
                                    }
                                  />
                                  <button
                                    type="button"
                                    className="admin-card-action admin-card-action--ghost"
                                    onClick={() => handleProviderLookup(cardId, 'details')}
                                  >
                                    Lookup
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-card-action admin-card-action--ghost"
                                    onClick={() => handleProviderLookup(cardId, 'status')}
                                  >
                                    Status
                                  </button>
                                </div>
                                {providerInfo?.last_sync_at || providerInfo?.latest_provider_tx_at ? (
                                  <div className="admin-card-provider-times">
                                    <span>
                                      Last sync:{' '}
                                      {providerInfo?.last_sync_at
                                        ? dateFormater(providerInfo.last_sync_at)
                                        : 'Not available'}
                                    </span>
                                    <span>
                                      Latest provider tx:{' '}
                                      {providerInfo?.latest_provider_tx_at
                                        ? dateFormater(providerInfo.latest_provider_tx_at)
                                        : 'Not available'}
                                    </span>
                                  </div>
                                ) : null}
                                {providerInfo ? (
                                  <pre className="admin-card-provider-raw">
                                    {JSON.stringify(providerInfo, null, 2)}
                                  </pre>
                                ) : null}
                                {providerTx ? (
                                  <pre className="admin-card-provider-raw">
                                    {JSON.stringify(providerTx, null, 2)}
                                  </pre>
                                ) : null}
                                {providerLookup ? (
                                  <pre className="admin-card-provider-raw">
                                    {JSON.stringify(providerLookup, null, 2)}
                                  </pre>
                                ) : null}
                              </div>
                            </>
                          ) : null}
                          {eventRows.length > 0 ? (
                            <div className="admin-card-item__events">
                              {eventRows.map((event) => (
                                <div className="admin-card-event" key={event.id}>
                                  <div className="admin-card-event__row">
                                    <span className="admin-card-event__name">
                                      {event.event_name || 'event'}
                                    </span>
                                    <span className="admin-card-event__status">
                                      {event.status || 'unknown'}
                                    </span>
                                    <span className="admin-card-event__amount">
                                      {formatAdminAmount(
                                        event.amount,
                                        event.currency,
                                        event.metadata?.wallet_type
                                      )}
                                    </span>
                                    <span className="admin-card-event__merchant">
                                      {event.metadata?.merchant?.logo ? (
                                        <img
                                          src={event.metadata.merchant.logo}
                                          alt=""
                                          className="admin-card-event__merchant-logo"
                                        />
                                      ) : null}
                                      <span>
                                        {event.extracted_fields?.merchant_name ||
                                          event.metadata?.merchant?.name ||
                                          '—'}
                                      </span>
                                    </span>
                                    <span className="admin-card-event__time">
                                      {dateFormater(event.created_at)}
                                    </span>
                                    {cardDebugEnabled ? (
                                      <button
                                        type="button"
                                        className="admin-card-event__toggle"
                                        onClick={() => toggleEventExpanded(event.id)}
                                      >
                                        {expandedEvents[event.id] ? 'Hide raw' : 'View raw'}
                                      </button>
                                    ) : null}
                                  </div>
                                  {cardDebugEnabled && expandedEvents[event.id] ? (
                                    <div className="admin-card-event__details">
                                      {event.extracted_fields ? (
                                        <div className="admin-card-event__fields">
                                          {Object.entries(event.extracted_fields).map(([key, value]) => (
                                            <div className="admin-card-event__field" key={key}>
                                              <span>{key.replace(/_/g, ' ')}</span>
                                              <strong>{value?.toString?.() || ''}</strong>
                                            </div>
                                          ))}
                                        </div>
                                      ) : null}
                                      {event.extracted_fields
                                        ? (() => {
                                            const fxKeys = [
                                              'merchant_currency',
                                              'merchant_amount',
                                              'billing_currency',
                                              'billing_amount',
                                              'fx_implied_rate',
                                              'fx_reference_rate',
                                              'fx_margin_usd',
                                            ]
                                            const fxEntries = fxKeys
                                              .map((key) => ({
                                                key,
                                                value: event.extracted_fields?.[key],
                                              }))
                                              .filter((entry) => entry.value !== undefined && entry.value !== null)
                                            if (!fxEntries.length) return null
                                            return (
                                              <div className="admin-card-event__fx">
                                                <span>Detected FX</span>
                                                <div className="admin-card-event__fx-values">
                                                  {fxEntries.map((entry) => (
                                                    <div key={entry.key}>
                                                      <strong>{entry.key.replace(/_/g, ' ')}</strong>
                                                      <span>{entry.value?.toString?.() || ''}</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            )
                                          })()
                                        : null}
                                      <div className="admin-card-event__chips">
                                        {event.currency ? (
                                          <span className="admin-chip">{event.currency}</span>
                                        ) : null}
                                        {event.amount ? (
                                          <span className="admin-chip">Amt {event.amount}</span>
                                        ) : null}
                                        {event.extracted_fields?.card_transaction_type ? (
                                          <span className="admin-chip">
                                            {event.extracted_fields.card_transaction_type}
                                          </span>
                                        ) : null}
                                        {typeof event.extracted_fields?.livemode !== 'undefined' ? (
                                          <span className="admin-chip">
                                            {event.extracted_fields.livemode ? 'Live' : 'Sandbox'}
                                          </span>
                                        ) : null}
                                        {event.extracted_fields?.transaction_date ? (
                                          <span className="admin-chip">
                                            {event.extracted_fields.transaction_date}
                                          </span>
                                        ) : null}
                                      </div>
                                      <div className="admin-card-event__refs">
                                        {event.provider_transaction_reference ? (
                                          <div className="admin-card-event__ref">
                                            <span>{event.provider_transaction_reference}</span>
                                            <button
                                              type="button"
                                              className="admin-card-event__copy"
                                              onClick={() =>
                                                copyToClipboard(event.provider_transaction_reference)
                                              }
                                            >
                                              Copy provider ref
                                            </button>
                                          </div>
                                        ) : null}
                                        {event.extracted_fields?.client_transaction_reference ? (
                                          <div className="admin-card-event__ref">
                                            <span>{event.extracted_fields.client_transaction_reference}</span>
                                            <button
                                              type="button"
                                              className="admin-card-event__copy"
                                              onClick={() =>
                                                copyToClipboard(
                                                  event.extracted_fields.client_transaction_reference
                                                )
                                              }
                                            >
                                              Copy client ref
                                            </button>
                                          </div>
                                        ) : null}
                                      </div>
                                      {event.provider_transaction_reference &&
                                      (event.extracted_fields?.card_transaction_type || '')
                                        .toString()
                                        .toLowerCase() === 'debit' &&
                                      !event.extracted_fields?.merchant_currency &&
                                      !event.extracted_fields?.billing_currency &&
                                      !event.metadata?.fx_discovery_present &&
                                      !isLiveEnv &&
                                      cardDebugEnabled ? (
                                        <button
                                          type="button"
                                          className="admin-card-event__copy"
                                          disabled={enrichLoading[event.provider_transaction_reference]}
                                          onClick={() =>
                                            handleEnrichTransaction(
                                              cardId,
                                              event.provider_transaction_reference
                                            )
                                          }
                                        >
                                          {enrichLoading[event.provider_transaction_reference]
                                            ? 'Enriching...'
                                            : 'Enrich details'}
                                        </button>
                                      ) : null}
                                      <button
                                        type="button"
                                        className="admin-card-event__copy"
                                        onClick={() =>
                                          copyToClipboard(JSON.stringify(event.raw_payload || {}, null, 2))
                                        }
                                      >
                                        Copy raw JSON
                                      </button>
                                      <pre className="admin-card-event__raw">
                                        {JSON.stringify(event.raw_payload || {}, null, 2)}
                                      </pre>
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          ) : null}

          {activeTab === 'financial' ? (
          <div className={`admin-user-card admin-user-actions ${!user?.active ? 'is-disabled' : ''}`}>
            <div className="admin-card-header">
              <div>
                <p className="admin-card-eyebrow">Admin actions</p>
                <h2>Wallet controls</h2>
              </div>
              <div className="admin-card-aside">
                <span className="admin-card-label">Wallet</span>
                <span className="admin-card-value">{user?.wallet?.id || 'N/A'}</span>
              </div>
            </div>

            <div className="admin-action-row">
              <ClickButton onClick={() => setOpenActivate(true)}>
                {user?.active ? 'Deactivate Account' : 'Activate Account'}
              </ClickButton>
              <ClickButton onClick={() => setOpenAccountModal(true)}>Fund Account</ClickButton>
              <ClickButton onClick={handleClearPinLockout}>Clear PIN Lockout</ClickButton>
            </div>
          </div>
          ) : null}

          {activeTab === 'activity' ? (
          <>
          {/* Transactions table */}
          <div className="admin-user-card admin-user-table">
            <div className="admin-card-header">
              <div>
                <p className="admin-card-eyebrow">Ledger</p>
                <h2>Transactions</h2>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="mt-4 flow-root">
                <div>
                  <div className="inline-block min-w-full py-2 align-middle">
                    <table className="min-w-full  border border-gray-200 rounded-md border-separate border-spacing-0 table-auto overflow-hidden">
                      <thead className="top-0 sticky bg-gray-300 w-full left-0 uppercase">
                        <tr>
                          <th
                            scope="col"
                            className="sticky w-20 bg-gray-100 top-0 z-10 border-b  backdrop-blur backdrop-filter"
                          ></th>
                          <th
                            scope="col"
                            className="sticky top-0 z-10 border-b border-gray-200/50 bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter"
                          >
                            Type
                          </th>
                          <th
                            scope="col"
                            className="sticky top-0 z-10 border-b border-gray-200/50 bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter"
                          >
                            Amount
                          </th>

                          <th
                            scope="col"
                            className="sticky  top-0 z-10  border-b border-gray-200/50  bg-opacity-75 px-6 py-3.5  text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter sm:table-cell"
                          >
                            Bank
                          </th>
                          <th
                            scope="col"
                            className="sticky  top-0 z-10  border-b border-gray-200/50  bg-opacity-75 px-6 py-3.5  text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter sm:table-cell"
                          >
                            Address
                          </th>
                          <th
                            scope="col"
                            className="sticky top-0  z-10 border-b border-gray-200/50 bg- bg-opacity-75 px-3 py-3.5 pr-3 md:px-10 text-left text-xs font-semibold text-gray-900  backdrop-blur backdrop-filter"
                          >
                            Status
                          </th>
                          <th
                            scope="col"
                            className="sticky top-0 z-10  border-b border-gray-200/50 bg- bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter lg:table-cell"
                          >
                            Time{' '}
                          </th>
                          <th
                            scope="col"
                            className="sticky top-0 z-10  border-b border-gray-200/50 bg- bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter lg:table-cell"
                          >
                            {' '}
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {loading ? (
                          <tr>
                            <td className=" py-8 text-center justify-center " colSpan={6}>
                              <span>
                                <Loading />
                              </span>
                            </td>
                          </tr>
                        ) : user?.transactions?.length > 0 ? (
                          user?.transactions?.slice(fromPos, toPos).map((item, index) => (
                            <tr key={item?.id}>
                              <td className="whitespace-nowrap w-20 border-b capitalize border-gray-200 px-3 py-3 text-sm text-gray-600/90  font-semibold ">
                                <p className="font-bold">
                                  <span>{index + fromPos + 1}</span>
                                </p>
                              </td>
                              <td className="whitespace-nowrap border-b capitalize border-gray-200 px-3 py-3 text-sm text-gray-600/90  font-semibold ">
                                <p className="font-bold">
                                  <span className={`${pickTextColor(item?.transaction_type)}`}>
                                    {item?.transaction_type}
                                  </span>
                                </p>
                              </td>
                              <td className="whitespace-nowrap border-b border-gray-200 px-3 py-3 text-sm text-gray-600/90  font-semibold ">
                                <p className="font-bold">
                                  {formatAdminAmount(item.amount, item.currency, item.wallet_type)}
                                </p>
                              </td>
                              <td className="relative max-w-40 whitespace-nowrap border-b border-gray-200 py-3 pr-4 pl-3 text-left text-gray-900 text-sm sm:pr-8 lg:pr-8">
                                {item?.bank ?? 'Not Available'}
                              </td>
                              <td className="relative max-w-40 whitespace-nowrap border-b border-gray-200 py-3 pr-4 pl-3 text-left text-gray-900 text-sm sm:pr-8 lg:pr-8">
                                {item?.address ?? 'Not Available'}
                              </td>
                              <td className="relative whitespace-nowrap border-b border-gray-200 py-3 pr-4 pl-3 text-left text-gray-900 text-sm sm:pr-8 lg:pr-8">
                                <span
                                  className={`${statusStyle(
                                    item?.status
                                  )} py-1 w-full max-w-[200px] block  text-center px-3 border rounded-3xl`}
                                >
                                  {item?.status}
                                </span>
                              </td>

                              <td className="relative whitespace-nowrap border-b text-left border-gray-200 py-3 pr-4 pl-3 text-gray-900  text-sm sm:pr-8 lg:pr-8">
                                {dateFormater(item?.created_at)}
                              </td>
                              <td className="relative whitespace-nowrap border-b border-gray-200 py-3 pr-4 pl-3 text-left font-semibold text-blue-600 text-sm sm:pr-8 lg:pr-8">
                                <NavLink className="" to={`/admin/transactions/${item?.id}`}>
                                  View
                                </NavLink>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="text-center py-10" colSpan={6}>
                              <span className="text-black">No Transaction</span>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    <div className="py-2 flex gap-4">
                      <span
                        onClick={() => setActivePage((prev) => Math.min(prev + 1, pages))}
                        className="border cursor-pointer bg-gray-300 px-4 rounded shadow"
                      >
                        Next
                      </span>
                      {Array.from({ length: pages })?.map((_, index) => (
                        <span
                          onClick={() => setActivePage(index)}
                          key={index}
                          className={`${
                            activePage === index ? 'bg-gray-300' : 'bg-gray-100'
                          }  border cursor-pointer0 px-4 rounded shadow`}
                        >
                          {index}
                        </span>
                      ))}

                      <span
                        onClick={() => setActivePage((prev) => Math.max(prev - 1, 0))}
                        className="border cursor-pointer bg-gray-300 px-4 rounded shadow"
                      >
                        Prev
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card events table */}
          <div className="admin-user-card admin-user-table">
            <div className="admin-card-header">
              <div>
                <p className="admin-card-eyebrow">Cards</p>
                <h2>Card activity</h2>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="mt-4 flow-root">
                <div>
                  <div className="inline-block min-w-full py-2 align-middle">
                    <table className="min-w-full border border-gray-200 rounded-md border-separate border-spacing-0 table-auto overflow-hidden">
                      <thead className="bg-gray-200">
                        <tr>
                          <th
                            scope="col"
                            className="sticky top-0 z-10 border-b border-gray-200/50 bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter"
                          >
                            Type
                          </th>
                          <th
                            scope="col"
                            className="sticky top-0 z-10 border-b border-gray-200/50 bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter"
                          >
                            Amount
                          </th>
                          <th
                            scope="col"
                            className="sticky top-0 z-10 border-b border-gray-200/50 bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter"
                          >
                            Merchant
                          </th>
                          <th
                            scope="col"
                            className="sticky top-0 z-10 border-b border-gray-200/50 bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter"
                          >
                            Status
                          </th>
                          <th
                            scope="col"
                            className="sticky top-0 z-10 border-b border-gray-200/50 bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter"
                          >
                            Time
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {activityCardEvents.length > 0 ? (
                          activityCardEvents.slice(0, 10).map((event) => (
                            <tr key={`card-event-${event.id}`}>
                              <td className="whitespace-nowrap border-b border-gray-200 px-3 py-3 text-sm text-gray-600/90 font-semibold">
                                {event.event_name || 'card event'}
                              </td>
                              <td className="whitespace-nowrap border-b border-gray-200 px-3 py-3 text-sm text-gray-600/90 font-semibold">
                                {formatAdminAmount(
                                  event.amount,
                                  event.currency,
                                  event.metadata?.wallet_type
                                )}
                              </td>
                              <td className="whitespace-nowrap border-b border-gray-200 px-3 py-3 text-sm text-gray-600/90">
                                {event.extracted_fields?.merchant_name ||
                                  event.metadata?.merchant?.name ||
                                  '—'}
                              </td>
                              <td className="whitespace-nowrap border-b border-gray-200 px-3 py-3 text-sm text-gray-600/90">
                                <span
                                  className={`${statusStyle(
                                    event.status
                                  )} py-1 w-full max-w-[200px] block text-center px-3 border rounded-3xl`}
                                >
                                  {event.status}
                                </span>
                              </td>
                              <td className="whitespace-nowrap border-b border-gray-200 px-3 py-3 text-sm text-gray-600/90">
                                {dateFormater(event.created_at)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="text-center py-10" colSpan={5}>
                              <span className="text-black">No card activity</span>
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

          {/* User purchases table */}
          <div className="admin-user-card admin-user-table">
            <div className="admin-card-header">
              <div>
                <p className="admin-card-eyebrow">Commerce</p>
                <h2>User purchases</h2>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="mt-4 flow-root">
                <div>
                  <div className="inline-block min-w-full py-2 align-middle">
                    <table className="min-w-full  border border-gray-200 rounded-md border-separate border-spacing-0 table-auto overflow-hidden">
                      <thead className="bg-gray-200">
                        <tr>
                          <th
                            scope="col"
                            className="sticky top-0 z-10 border-b border-gray-200/50  bg-opacity-75 py-3.5 pl-4 pr-3 text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter sm:pl-6 lg:pl-8"
                          >
                            Email
                          </th>
                          <th
                            scope="col"
                            className="sticky top-0  z-10 border-b border-gray-200/50 bg- bg-opacity-75 px-3 py-3.5 pr-3 text-left text-xs font-semibold text-gray-900  backdrop-blur backdrop-filter"
                          >
                            Type
                          </th>
                          <th
                            scope="col"
                            className="sticky top-0  z-10 border-b border-gray-200/50 bg- bg-opacity-75 px-3 py-3.5 pr-3 text-left text-xs font-semibold text-gray-900  backdrop-blur backdrop-filter"
                          >
                            Provider
                          </th>
                          <th
                            scope="col"
                            className="sticky top-0 z-10  border-b border-gray-200/50  bg-opacity-75 px-6 py-3.5  text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter sm:table-cell"
                          >
                            Status
                          </th>
                          <th
                            scope="col"
                            className="sticky top-0 z-10 border-b border-gray-200/50 bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter"
                          >
                            Amount
                          </th>
                          <th
                            scope="col"
                            className="sticky top-0 z-0  border-b border-gray-200/50 bg- bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter lg:table-cell"
                          >
                            Time
                          </th>
                          <th
                            scope="col"
                            className=" top-0 z-0  border-b border-gray-200/50 bg- bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter lg:table-cell bg-gray-500"
                          >
                            {' '}
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {loading ? (
                          <tr>
                            <td className=" py-8 text-center justify-center " colSpan={6}>
                              <span>
                                <Loading />
                              </span>
                            </td>
                          </tr>
                        ) : user?.bill_orders?.length > 0 ? (
                          user?.bill_orders?.slice(0, 10).map((item) => (
                            <tr key={item?.id}>
                              <td className="whitespace-nowrap border-b border-gray-200 py-2 pl-3 pr-3 text-sm font-normal sm:pl-6 lg:pl-8">
                                <p className="font-medium text-gray-600 leading-5">
                                  {item.email}
                                </p>
                              </td>
                              <td className="whitespace-nowrap  border-b border-gray-200 hidden px-3 py-4 text-sm text-gray-900 font-normal sm:table-cell capitalize">
                                {item.service_type}
                              </td>
                              <td className="whitespace-nowrap  border-b border-gray-200 hidden px-3 py-4 text-sm text-gray-900 font-normal sm:table-cell capitalize">
                                {item.biller}
                              </td>
                              <td className="whitespace-nowrap  border-b border-gray-200 hidden px-3 py-4 text-sm text-gray-900 font-normal sm:table-cell capitalize">
                                {item.status}
                              </td>

                              <td className="relative whitespace-nowrap font-semibold border-b border-gray-200 py-3 pr-4 pl-3 text-left text-gray-900 text-sm sm:pr-8 lg:pr-8">
                                <p className="font-bold">
                                  {nairaFormat(item?.total_amount, 'ngn')}
                                </p>
                              </td>

                              <td className="relative whitespace-nowrap border-b text-left border-gray-200 py-3 pr-4 pl-3 text-gray-900  text-sm sm:pr-8 lg:pr-8">
                                {dateFormater(item?.created_at)}
                              </td>

                              <td className="relative z-0 whitespace-nowrap border-b text-center border-gray-200 py-3 pr-4 pl-3 text-gray-900  text-sm sm:pr-8 lg:pr-8">
                                <BreadCrunbs
                                  id={item.id}
                                  setSelectedId={setSelectedId}
                                  link={`/admin/purchases/${item?.id}`}
                                  setOpen={setOpen}
                                  open={open}
                                />
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="text-center py-10" colSpan={6}>
                              <span className="text-black">No Transaction</span>
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
          </>
          ) : null}
        </div>
      </div>

      {/* Approve / decline order modal */}

      <AppModal handleCancel={() => setOpen(false)} isModalOpen={open} title={'Approve Orders'}>
        <div className="flex my-6 justify-between">
          <ClickButton onClick={() => handleOrderUpdate('declined')} btnType="decline">
            Decline
          </ClickButton>
          <ClickButton onClick={() => handleOrderUpdate('approved')}>Approve</ClickButton>
        </div>
      </AppModal>

      {/* Fund account modal */}
      <AppModal
        className={'white-bg'}
        handleCancel={() => setOpenAccountModal(false)}
        isModalOpen={openAccountModal}
        title={`${transactionType} Transaction`}
      >
        <div className="my-6 justify-between">
          <div className="flex gap-4 my-4">
            <button
              onClick={() => setTransactionType('deposit')}
              className={`${
                transactionType == 'deposit' ? 'bg-alt text-primary' : 'bg-primary text-white'
              }  px-4 py-2 rounded-lg `}
            >
              Depodit
            </button>
            <button
              onClick={() => setTransactionType('withdrawal')}
              className={`${
                transactionType == 'withdrawal' ? 'bg-alt text-primary' : 'bg-primary text-white'
              }  px-4 py-2 rounded-lg `}
            >
              Withdrawal
            </button>
          </div>

          <Form
            className="add-fund w-full"
            layout={formLayout}
            onFinish={(values) => {
              handleSubmit(values)
            }}
            form={form}
            initialValues={{
              amount: '',
              bank: 'bitbridge',
            }}
            style={{
              color: 'white',
              maxWidth: formLayout === 'inline' ? 'none' : 600,
            }}
          >
            <FormInput required={true} className="" name="amount" type="number" label={`Amount`} />
            {transactionType === 'deposit' && (
              <FormInput
                required={true}
                className="add-fund"
                name="bank"
                disabled={true}
                type="text"
                label={'Bank'}
              />
            )}
            <div className="mt-10"></div>

            <Form.Item label={null}>
              <Button
                className="border-alt m-auto block w-full h-20 bg-primary text-gray-800 rounded-lg  border shadow-md font-medium text-xl"
                type="primary"
                htmlType="submit"
              >
                {transactionType === 'deposit' ? 'Credit User' : 'Debit User'}
              </Button>
            </Form.Item>
          </Form>
        </div>
      </AppModal>

      {/* Activate / deactivate modal */}
      <AppModal
        className={'white-bg'}
        handleCancel={() => setOpenActivate(false)}
        isModalOpen={openActivate}
        title={`${user?.active ? 'Deactivate' : 'Activate'} Account`}
      >
        <div className="flex my-6 justify-between w-full">
          <ClickButton onClick={() => setOpenActivate(false)} btnType="decline">
            Cancel
          </ClickButton>
          <ClickButton onClick={handleUserstatus}>
            {user?.active ? 'Deactivate Account' : 'Activate Account'}
          </ClickButton>
        </div>
      </AppModal>
    </>
  )
}

export default ViewUser





