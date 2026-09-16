import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import PlainSelect from '../../components/formSelect/plainSelect'
import BusinessWorkspaceNav from '../../components/business/BusinessWorkspaceNav'
import useSelectedBusiness from '../../hooks/useSelectedBusiness'
import useBusinessDashboardPresentation from '../../hooks/useBusinessDashboardPresentation'
import BusinessWorkspaceRequired from '../../components/business/BusinessWorkspaceRequired'
import { createBusinessTransfer } from '../../api/business'
import { getBankList, resolveAccountName, transferQuote } from '../../redux/actions/account'

const cardClass =
  'rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.22)]'

const formatNgn = (value = 0) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

const BusinessSend = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { ownerMode, selectedBusiness } = useSelectedBusiness()
  const {
    loading: accountLoading,
    currentUserRole,
    approvalSummary,
    financialControls,
    isLive,
    permissions,
    hero,
    navigationItems,
  } = useBusinessDashboardPresentation(selectedBusiness?.id)
  const { banks = [] } = useSelector((state) => state.account)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    account_number: '',
    bank_code: '',
    bank: '',
    account_name: '',
    amount: '',
    narration: '',
  })
  const [quoteData, setQuoteData] = useState(null)
  const [accountLookupStatus, setAccountLookupStatus] = useState('idle')
  const [accountLookupError, setAccountLookupError] = useState('')
  const lastLookupKeyRef = useRef('')
  const latestLookupInputRef = useRef('')

  useEffect(() => {
    if (!banks.length) dispatch(getBankList())
  }, [banks.length, dispatch])

  useEffect(() => {
    latestLookupInputRef.current = `${formData.bank_code}:${String(formData.account_number || '').trim()}`
  }, [formData.account_number, formData.bank_code])

  const bankOptions = useMemo(
    () =>
      (banks || [])
        .map(({ attributes: { name, nipCode }, id }) => ({
          value: nipCode,
          label: name,
          key: id,
        }))
        .sort((a, b) => String(a.label || '').localeCompare(String(b.label || ''))),
    [banks]
  )

  const amountValue = Number(formData.amount || 0)
  const hasValidAmount = Number.isFinite(amountValue) && amountValue > 0
  const canVerify = String(formData.account_number || '').trim().length === 10 && !!formData.bank_code
  const accountResolved = accountLookupStatus === 'success'
  const canInitiateTransfer = Boolean(permissions?.canInitiateTransfer)
  const canDraftTransfer = Boolean(permissions?.canDraftTransfer)
  const activePolicy = financialControls?.activeApprovalPolicy || null

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((current) => {
      const next = { ...current, [name]: value }
      if (name === 'account_number') next.account_name = ''
      return next
    })
    if (name === 'account_number') {
      setAccountLookupStatus('idle')
      setAccountLookupError('')
      lastLookupKeyRef.current = ''
    }
    if (name === 'amount' || name === 'narration') setQuoteData(null)
  }

  const handleBankSelect = (bankCode) => {
    const selected = bankOptions.find((option) => option.value === bankCode)
    setFormData((current) => ({
      ...current,
      bank_code: bankCode || '',
      bank: selected?.label || '',
      account_name: '',
    }))
    setAccountLookupStatus('idle')
    setAccountLookupError('')
    setQuoteData(null)
    lastLookupKeyRef.current = ''
  }

  const fetchAccountName = useCallback(async (force = false) => {
    if (!canVerify) return

    const payload = {
      account_number: String(formData.account_number || '').trim(),
      bank_code: formData.bank_code,
      inter_bank: true,
    }
    const lookupKey = `${payload.bank_code}:${payload.account_number}`
    if (!force && accountResolved && lastLookupKeyRef.current === lookupKey) return

    setAccountLookupStatus('loading')
    setAccountLookupError('')

    try {
      const response = await dispatch(resolveAccountName({ account: payload })).unwrap()
      if (latestLookupInputRef.current !== lookupKey) return
      setFormData((current) => ({
        ...current,
        bank: response?.bank_name || current.bank,
        account_name: response?.account_name || '',
      }))
      setAccountLookupStatus('success')
      lastLookupKeyRef.current = lookupKey
    } catch {
      setAccountLookupStatus('error')
      setAccountLookupError('Account not found. Check the number and bank, then retry.')
    }
  }, [accountResolved, canVerify, dispatch, formData.account_number, formData.bank_code])

  useEffect(() => {
    if (!canVerify) {
      setAccountLookupStatus('idle')
      setAccountLookupError('')
      return
    }
    const lookupKey = `${formData.bank_code}:${formData.account_number}`
    if (accountResolved && lastLookupKeyRef.current === lookupKey) return

    const timer = setTimeout(() => {
      fetchAccountName()
    }, 250)

    return () => clearTimeout(timer)
  }, [accountResolved, canVerify, fetchAccountName, formData.account_number, formData.bank_code])

  const handleContinue = async () => {
    if (!canVerify) return toast.error('Enter a valid account number and bank.')
    if (!accountResolved || !formData.account_name) return toast.error('Resolve the destination account before continuing.')
    if (!hasValidAmount) return toast.error('Enter a valid transfer amount.')
    if (!String(formData.narration || '').trim()) return toast.error('Narration is required.')

    setQuoteLoading(true)
    try {
      const quote = await dispatch(transferQuote({ amount: formData.amount })).unwrap()
      setQuoteData(quote || null)
      setStep(2)
    } catch (error) {
      toast.error(error?.message || error?.data?.message || 'Unable to prepare the transfer.')
    } finally {
      setQuoteLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!selectedBusiness?.id) return

    setSubmitLoading(true)
    setErrorMessage('')
    try {
      const response = await createBusinessTransfer(selectedBusiness.id, {
        transfer: {
          amount: formData.amount,
          bank_code: formData.bank_code,
          bank: formData.bank,
          account_number: String(formData.account_number || '').trim(),
          account_name: formData.account_name,
          narration: formData.narration,
        },
      })
      const data = response?.data || {}
      const reference = data?.transfer_reference || data?.reference
      const status = String(data?.status || '').toLowerCase()

      if (status === 'pending_approval') {
        toast.info('Transfer submitted for approval review.')
      } else if (status === 'pending') {
        toast.info('Transfer submitted and awaiting provider confirmation.')
      } else {
        toast.success(data?.message || 'Business transfer submitted.')
      }

      navigate(
        reference
          ? `/dashboard/business/transfers/${encodeURIComponent(reference)}`
          : '/dashboard/business/transfers'
      )
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to submit the business transfer.'
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setSubmitLoading(false)
    }
  }

  if (ownerMode !== 'business') return <Navigate to="/dashboard/home" replace />

  if (!selectedBusiness) {
    return <BusinessWorkspaceRequired message="Select a business workspace from the switcher or return to the setup hub to initiate a business transfer." />
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="rounded-[28px] border border-[#FF7A18] bg-[linear-gradient(135deg,rgba(255,138,42,0.16),rgba(255,176,90,0.08)_40%,rgba(15,23,42,0.94)_100%)] p-5 md:p-7 shadow-[0_24px_60px_rgba(255,122,24,0.16)]">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#FFB05A]">Business Transfer</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white md:text-3xl">{selectedBusiness.name}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                {isLive
                  ? 'Initiate a controlled outbound payment from this business workspace. Transfers stay scoped to the selected business and follow its approval controls.'
                  : 'Business transfers unlock after onboarding, verification, and provisioning are complete.'}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-950/45 px-4 py-3 text-sm text-slate-300">
              Role: <span className="font-semibold text-white">{currentUserRole || 'member'}</span>
            </div>
          </div>
        </section>

        <BusinessWorkspaceNav
          pendingCount={approvalSummary?.total_pending || 0}
          visibleNavigationItems={navigationItems}
          action={
            <Link
              to="/dashboard/business/transfers"
              className="rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white"
            >
              View transfers
            </Link>
          }
        />

        {accountLoading ? (
          <section className={cardClass}>
            <div className="text-sm text-slate-400">Loading transfer workspace...</div>
          </section>
        ) : !isLive ? (
          <section className={cardClass}>
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-5">
              <div className="text-sm font-semibold text-amber-100">Transfers are not available yet.</div>
              <div className="mt-2 text-sm text-amber-50/90">
                Complete activation first, then outbound payments will unlock for permitted team members.
              </div>
              {hero?.primaryAction ? (
                <div className="mt-4">
                  <Link
                    to={hero.primaryAction.route}
                    className="inline-flex rounded-2xl bg-[#FFB05A] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#ffc27d]"
                  >
                    {hero.primaryAction.label}
                  </Link>
                </div>
              ) : null}
            </div>
          </section>
        ) : !canInitiateTransfer && !canDraftTransfer ? (
          <section className={cardClass}>
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-5">
              <div className="text-sm font-semibold text-amber-100">Transfer access is restricted.</div>
              <div className="mt-2 text-sm text-amber-50/90">
                Your role can’t initiate or draft outbound transfers for this business workspace.
              </div>
            </div>
          </section>
        ) : (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
            <section className={cardClass}>
              {errorMessage ? (
                <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
                  {errorMessage}
                </div>
              ) : null}

              <div className="mb-5 flex items-center gap-2">
                {[1, 2].map((item) => (
                  <div
                    key={item}
                    className={[
                      'rounded-2xl border px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]',
                      step >= item
                        ? 'border-[#FFB05A]/40 bg-[rgba(255,176,90,0.12)] text-[#FFD2A0]'
                        : 'border-slate-800 bg-slate-950/45 text-slate-500',
                    ].join(' ')}
                  >
                    {item === 1 ? 'Transfer details' : 'Confirm'}
                  </div>
                ))}
              </div>

              {step === 1 ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300">Account number</label>
                    <input
                      type="text"
                      name="account_number"
                      value={formData.account_number}
                      onChange={handleChange}
                      maxLength={10}
                      className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60"
                      placeholder="Enter 10-digit account number"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300">Bank</label>
                    <div className="mt-1">
                      <PlainSelect
                        className="w-full"
                        placeholder="Search and select bank"
                        options={bankOptions}
                        onChange={handleBankSelect}
                        value={formData.bank_code || undefined}
                      />
                    </div>
                  </div>

                  {accountLookupStatus === 'loading' ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-blue-700/60 bg-blue-900/30 px-3 py-1 text-xs text-blue-200">
                      <span className="h-3 w-3 animate-spin rounded-full border border-blue-200 border-t-transparent" />
                      Checking account
                    </div>
                  ) : null}
                  {accountLookupStatus === 'success' && formData.account_name ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-600 bg-emerald-900/30 px-3 py-1 text-xs text-emerald-200">
                      Verified: {formData.account_name}
                    </div>
                  ) : null}
                  {accountLookupStatus === 'error' ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-rose-600 bg-rose-900/30 px-3 py-1 text-xs text-rose-200">
                      {accountLookupError}
                      <button
                        type="button"
                        onClick={() => fetchAccountName(true)}
                        className="font-semibold text-rose-100 underline underline-offset-2"
                      >
                        Retry
                      </button>
                    </div>
                  ) : null}

                  <div>
                    <label className="block text-sm font-medium text-slate-300">Amount (NGN)</label>
                    <input
                      type="number"
                      name="amount"
                      value={formData.amount}
                      onChange={handleChange}
                      className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60"
                      placeholder="Enter amount"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300">Narration</label>
                    <input
                      type="text"
                      name="narration"
                      value={formData.narration}
                      onChange={handleChange}
                      className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60"
                      placeholder="Describe the payment"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <Link to="/dashboard/business/transfers" className="text-sm text-slate-400 hover:text-white">
                      Cancel
                    </Link>
                    <button
                      type="button"
                      onClick={handleContinue}
                      disabled={quoteLoading}
                      className="rounded-2xl bg-[#FFB05A] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#ffc27d] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {quoteLoading ? 'Preparing transfer...' : 'Continue to confirm'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Destination</div>
                    <div className="mt-3 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
                      <div>
                        <span className="text-slate-500">Account name</span>
                        <div className="mt-1 text-white">{formData.account_name}</div>
                      </div>
                      <div>
                        <span className="text-slate-500">Account number</span>
                        <div className="mt-1 text-white">{formData.account_number}</div>
                      </div>
                      <div>
                        <span className="text-slate-500">Bank</span>
                        <div className="mt-1 text-white">{formData.bank}</div>
                      </div>
                      <div>
                        <span className="text-slate-500">Narration</span>
                        <div className="mt-1 text-white">{formData.narration}</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Debit summary</div>
                    <div className="mt-3 space-y-3 text-sm text-slate-300">
                      <div className="flex items-center justify-between gap-3">
                        <span>Transfer amount</span>
                        <span className="font-semibold text-white">{formatNgn(formData.amount)}</span>
                      </div>
                      {quoteData?.fee != null ? (
                        <div className="flex items-center justify-between gap-3">
                          <span>Fee</span>
                          <span className="text-white">{formatNgn(quoteData.fee)}</span>
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between gap-3">
                        <span>Total debit</span>
                        <span className="font-semibold text-white">
                          {formatNgn(quoteData?.total_debit != null ? quoteData.total_debit : formData.amount)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={submitLoading}
                      className="rounded-2xl bg-[#FFB05A] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#ffc27d] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitLoading ? 'Submitting transfer...' : 'Submit transfer'}
                    </button>
                  </div>
                </div>
              )}
            </section>

            <div className="flex flex-col gap-6">
              <section className={cardClass}>
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Control mode</div>
                {activePolicy ? (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-300">Policy mode</span>
                      <span
                        className={[
                          'rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]',
                          activePolicy.mode === 'enforce'
                            ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                            : 'border-amber-500/40 bg-amber-500/10 text-amber-200',
                        ].join(' ')}
                      >
                        {activePolicy.mode}
                      </span>
                    </div>
                    <div className="text-sm text-slate-400">
                      {activePolicy.mode === 'enforce'
                        ? 'Transfers over the threshold will wait for approval before funds move.'
                        : 'Transfers over the threshold will execute immediately and still create an approval record.'}
                    </div>
                    <div className="flex items-center justify-between gap-3 text-sm text-slate-300">
                      <span>Threshold</span>
                      <span className="font-semibold text-white">{formatNgn(activePolicy.threshold_amount)}</span>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Required roles</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(activePolicy.required_roles || []).map((role) => (
                          <span
                            key={role}
                            className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-slate-200"
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-slate-400">
                    No active approval policy is configured for this business. Eligible transfers will execute immediately.
                  </div>
                )}
              </section>

              <section className={cardClass}>
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">What happens next</div>
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                    Verified destination details are sent to the business transfer endpoint for this workspace only.
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                    If the active policy is in <span className="font-semibold text-white">enforce</span> mode, the transfer will move into <span className="font-semibold text-white">pending approval</span> instead of executing immediately.
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                    After submission, you will land on the business transfer status page with receipt access when available.
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default BusinessSend

