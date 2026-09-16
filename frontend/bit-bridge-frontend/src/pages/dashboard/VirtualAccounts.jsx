import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import AppModal from '../../components/modal/Modal'
import AccountCreationWizard from '../../components/accountCreationWizard/AccountCreationWizard'
import AccountNumbers from '../../components/accountComponents/AccountComponents'
import {
  getAccounts,
  getAnchorOnboardingState,
  getUserAccount,
  setupAnchorOnboarding,
} from '../../redux/actions/account'
import { needsTier2Access, withTier2MissingDetails } from '../../utils/kycGate'
import {
  describeAnchorFlow,
  normalizeAnchorOnboarding,
} from '../../utils/anchorOnboarding'

const VirtualAccounts = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const { user } = useSelector((state) => state.auth)
  const { accounts, account, anchorOnboarding } = useSelector((state) => state.account)

  const [isAnchorModal, setIsAnchorModal] = useState(false)
  const [current, setCurrent] = useState(0)
  const [formData, setFormData] = useState({})
  const [visibleAccounts, setVisibleAccounts] = useState({})
  const [refreshingState, setRefreshingState] = useState(false)

  useEffect(() => {
    dispatch(getUserAccount())
    dispatch(getAccounts())
    dispatch(getAnchorOnboardingState())
  }, [dispatch])

  const normalizedAnchor = useMemo(
    () =>
      normalizeAnchorOnboarding({
        detailResponse: account,
        userAccountsResponse: { data: accounts },
        onboardingResponse: anchorOnboarding,
      }),
    [account, accounts, anchorOnboarding]
  )

  const canonicalAnchorAccount = useMemo(() => {
    if (normalizedAnchor.anchorAccount) {
      return {
        ...normalizedAnchor.anchorAccount,
        account_number: normalizedAnchor.anchorAccount.account_number || normalizedAnchor.accountNumber,
        account_name: normalizedAnchor.anchorAccount.account_name || normalizedAnchor.accountName,
        bank_name: normalizedAnchor.anchorAccount.bank_name || normalizedAnchor.bankName,
      }
    }

    if (normalizedAnchor.hasAnchorAccount || normalizedAnchor.hasAccountNumber) {
      return {
        vendor: 'anchor',
        account_number: normalizedAnchor.accountNumber,
        account_name: normalizedAnchor.accountName,
        bank_name: normalizedAnchor.bankName,
        status: normalizedAnchor.backendFlowState || 'completed',
        active: normalizedAnchor.depositReady,
      }
    }

    return null
  }, [normalizedAnchor])

  const anchorFlowCopy = useMemo(() => describeAnchorFlow(normalizedAnchor), [normalizedAnchor])

  const openAnchorRecoveryModal = (data = {}, flowOverride = null, details = null) => {
    const flow = flowOverride || anchorOnboarding?.flow || {}
    const capabilities = data?.capabilities || normalizedAnchor?.capabilities || anchorOnboarding?.capabilities || {}
    const flowState = String(flow?.state || data?.flow?.state || '').trim().toLowerCase()
    const hasAnchorRecord = String(data?.vendor || '').toLowerCase() === 'anchor'
    const anchorStatus = String(data?.status || '').toLowerCase()
    const isAnchorKycVerified = ['verified', 'completed'].includes(anchorStatus)
    const hasAccountNumber = Boolean(data?.account_number)

    let wizardStep = 0
    if (hasAccountNumber || flowState === 'provisioned') {
      wizardStep = 3
    } else if (flowState === 'blocked_kyc') {
      wizardStep = 1
    } else if (flowState === 'customer_created_no_deposit_account') {
      wizardStep = 0
    } else {
      wizardStep = hasAnchorRecord ? (isAnchorKycVerified ? 0 : 1) : 0
    }

    setFormData({
      ...data,
      flow,
      capabilities,
      requirements: data?.requirements || normalizedAnchor?.requirements || anchorOnboarding?.requirements || null,
      details: details || null,
    })
    setCurrent(wizardStep)
    setIsAnchorModal(true)
  }

  const refreshAnchorState = async () => {
    setRefreshingState(true)
    try {
      await Promise.all([
        dispatch(getUserAccount()),
        dispatch(getAccounts()),
        dispatch(getAnchorOnboardingState()),
      ])
      toast.success('Anchor status refreshed')
    } catch {
      toast.error('Unable to refresh Anchor status')
    } finally {
      setRefreshingState(false)
    }
  }

  const handleGenerate = async (vendor, data = {}) => {
    if (vendor === 'monnify' || vendor === 'moniepoint') {
      toast.info('New Monnify/Moniepoint account creation is currently disabled.', {
        position: 'top-right',
        autoClose: 4000,
        pauseOnHover: true,
      })
      return
    }
    if (vendor !== 'anchor') {
      toast.info('Only Anchor account creation is currently enabled.', {
        position: 'top-right',
        autoClose: 4000,
        pauseOnHover: true,
      })
      return
    }

    if (needsTier2Access(user)) {
      toast.info(withTier2MissingDetails(user, 'Complete Tier 2 verification to generate an Anchor account.'), {
        position: 'top-right',
        autoClose: 4000,
        pauseOnHover: true,
      })
      navigate('/dashboard/kyc')
      return
    }

    const requestData = {
      account: {
        vendor: 'anchor',
      },
    }

    try {
      const result = await dispatch(setupAnchorOnboarding(requestData)).unwrap()
      await Promise.all([
        dispatch(getUserAccount()),
        dispatch(getAccounts()),
        dispatch(getAnchorOnboardingState()),
      ])

      const flow = result?.flow || {}
      const flowState = String(flow?.state || '').trim().toLowerCase()
      const payloadData = result?.data || data || {}

      if (flowState === 'provisioned') {
        toast.success(result?.message || 'Anchor account ready')
        return
      }

      if (flowState === 'pending_kyc_review') {
        toast.info(result?.message || 'Anchor KYC is under review')
        return
      }

      openAnchorRecoveryModal(payloadData, flow)
    } catch (error) {
      const flow = error?.flow || error?.response?.flow || anchorOnboarding?.flow || {}
      const flowState = String(flow?.state || '').trim().toLowerCase()

      if (flowState === 'blocked_profile_incomplete' || flowState === 'blocked_kyc') {
        openAnchorRecoveryModal(data, flow, error?.details || error?.response?.details || null)
        return
      }

      toast.error(error?.message || 'Unable to continue Anchor onboarding')
    }
  }

  const maskAccountNumber = (num) => {
    if (!num) return ''
    return num.replace(/\d(?=\d{4})/g, '*')
  }

  const toggleAccountVisibility = (id) => {
    setVisibleAccounts((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const copyToClipboard = async (value) => {
    if (!value) return
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = value
        textarea.setAttribute('readonly', 'true')
        textarea.style.position = 'absolute'
        textarea.style.left = '-9999px'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      toast.success('Account number copied')
    } catch {
      toast.error('Unable to copy account number')
    }
  }

  const displayAccounts = canonicalAnchorAccount
    ? [
        canonicalAnchorAccount,
        ...(accounts || []).filter(
          (entry) => String(entry?.vendor || '').toLowerCase() !== 'anchor' && entry?.id !== canonicalAnchorAccount?.id
        ),
      ]
    : accounts

  const progressSegments = [
    normalizedAnchor.hasAnchorAccount,
    normalizedAnchor.backendFlowState === 'pending_kyc_review' ||
      normalizedAnchor.backendFlowState === 'customer_created_no_deposit_account' ||
      normalizedAnchor.depositReady,
    normalizedAnchor.hasAccountNumber || normalizedAnchor.depositReady,
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      <div className="max-w-5xl mx-auto relative">
        <div className="absolute -top-24 -right-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-24 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />

        <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 md:p-8 shadow-[0_30px_60px_rgba(15,23,42,0.45)]">
          <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-emerald-500/15 blur-2xl" />
          <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-200/80 mb-2">
            Virtual accounts
          </p>
          <h2 className="text-2xl md:text-3xl font-semibold">
            Bank accounts for transfers
          </h2>
          <p className="mt-2 text-sm text-slate-300 max-w-2xl">
            {anchorFlowCopy.detail}
          </p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-slate-300">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
              <p className="text-slate-500">Accounts live</p>
              <p className="text-lg font-semibold text-emerald-300">{displayAccounts?.length || 0}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
              <p className="text-slate-500">Current state</p>
              <p className="text-lg font-semibold text-slate-100 capitalize">
                {String(normalizedAnchor.backendFlowState || 'not_started').replace(/_/g, ' ')}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
              <p className="text-slate-500">Next action</p>
              <p className="text-lg font-semibold text-slate-100 capitalize">
                {String(normalizedAnchor.backendNextAction || 'create_anchor_account').replace(/_/g, ' ')}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-emerald-200/80">
              {anchorFlowCopy.eyebrow}
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-100">
              {anchorFlowCopy.title}
            </p>
          </div>
        </section>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 lg:p-6">
          {!normalizedAnchor.depositReady ? (
            <div className="mb-5 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-100">Onboarding progress</h3>
                  <p className="mt-1 text-xs text-slate-400">
                    {normalizedAnchor.backendFlowState === 'pending_kyc_review'
                      ? 'Anchor is reviewing your identity. Refresh shortly for the latest status.'
                      : normalizedAnchor.depositReady
                      ? 'Your deposit account is active and ready.'
                      : 'Use one action to create the profile, verify identity, and generate the account number.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={refreshAnchorState}
                  disabled={refreshingState}
                  className="rounded-full border border-slate-700 px-3 py-2 text-xs text-slate-200 transition hover:border-slate-500 hover:text-white disabled:opacity-60"
                >
                  {refreshingState ? 'Refreshing...' : 'Refresh status'}
                </button>
              </div>

              <div className="mt-4 flex gap-2">
                {progressSegments.map((active, index) => (
                  <div
                    key={`anchor-progress-${index}`}
                    className={`h-1 flex-1 rounded-full ${active ? 'bg-emerald-400' : 'bg-slate-700'}`}
                  />
                ))}
              </div>

              <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                <p className="text-sm font-semibold text-slate-100">
                  {normalizedAnchor.nextStep === 'GENERATE_NUMBER'
                    ? 'Generate account number'
                    : normalizedAnchor.nextStep === 'DO_KYC'
                    ? 'Complete identity check'
                    : normalizedAnchor.nextStep === 'DONE'
                    ? 'Setup complete'
                    : 'Create Anchor profile'}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  KYC status:{' '}
                  <span className="capitalize text-slate-200">
                    {normalizedAnchor.backendFlowState === 'pending_kyc_review'
                      ? 'pending review'
                      : normalizedAnchor.backendFlowState === 'blocked_kyc'
                      ? 'not verified'
                      : normalizedAnchor.depositReady || normalizedAnchor.hasAccountNumber
                      ? 'verified'
                      : 'not started'}
                  </span>
                </p>
              </div>
            </div>
          ) : null}

          <AccountNumbers
            accounts={accounts}
            anchorAccount={canonicalAnchorAccount}
            generate={handleGenerate}
            showView={false}
          />
        </div>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Your virtual accounts</h3>
              <p className="text-xs text-slate-400">Tap to reveal or copy account numbers.</p>
            </div>
          </div>

          {displayAccounts?.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayAccounts.map((entry, index) => {
                const visibilityKey = entry.id || `virtual-account-${index}`
                const isVisible = Boolean(visibleAccounts[visibilityKey])
                const accountNumber = entry?.account_number
                return (
                  <div
                    key={visibilityKey}
                    className="group rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.3)]"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">
                          {entry?.bank_name || entry?.vendor || 'Bank'}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {entry?.account_name || 'Account holder'}
                        </p>
                      </div>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                        {entry?.vendor || 'bank'}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-base font-semibold text-slate-100">
                        {isVisible ? accountNumber : maskAccountNumber(accountNumber)}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleAccountVisibility(visibilityKey)}
                          className="text-xs text-slate-300 hover:text-white"
                        >
                          {isVisible ? 'Hide' : 'Show'}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(accountNumber)}
                          className="text-xs text-slate-300 hover:text-white"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No virtual accounts yet.</p>
          )}
        </div>
      </div>

      <AppModal
        title={'Generate Account'}
        isModalOpen={isAnchorModal}
        handleCancel={() => setIsAnchorModal((prev) => !prev)}
      >
        <AccountCreationWizard
          setFormData={setFormData}
          formData={formData}
          current={current}
          setCurrent={setCurrent}
          setIsAncorModal={setIsAnchorModal}
          user={user}
        />
      </AppModal>
    </div>
  )
}

export default VirtualAccounts
