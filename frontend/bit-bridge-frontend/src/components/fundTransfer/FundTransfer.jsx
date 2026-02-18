import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import {
  getBeneficiaries,
  initiateTransfer,
  resolveAccountName,
  transferQuote,
} from '../../redux/actions/account'
import AppButton from '../button/Button'
import nairaFormat from '../../utils/nairaFormat'
import { toast } from 'react-toastify'
import { needsTier2Access, withTier2MissingDetails } from '../../utils/kycGate'
import { getWallet, sendMoneyToUser } from '../../redux/actions/wallet'

//  Masked PIN input
import TransactionPinInput from '../pin/TransactionPinInput' // adjust path if needed

const PIN_LENGTH = 4

const pickErrorMessage = (err) => {
  // handles axios + RTK errors in many shapes
  return (
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    (Array.isArray(err?.response?.data?.errors) ? err.response.data.errors.join(', ') : null) ||
    err?.data?.message ||
    err?.message ||
    'Request failed'
  )
}

export default function MoneyTransferFlow({ setIsfundTransferOpen }) {
  const [loading, setLoading] = useState(false)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { user } = useSelector((state) => state.auth)
  const { banks, beneficiaries, loading: accountLoading } = useSelector(
    (state) => state.account
  )

  const [step, setStep] = useState(1)
  const [transferMode, setTransferMode] = useState('bank')

  const [formData, setFormData] = useState({
    phone_number: '',
    account_number: '',
    bank_code: '',
    bank: '',
    account_name: '',
    counter_party_id: '',
    amount: '',
    inter_bank: false,
    description: '',

    // keep in state for UI, but we will map to account.pin for backend
    transaction_pin: '',
  })
  const [accountLookupStatus, setAccountLookupStatus] = useState('idle')
  const [accountLookupError, setAccountLookupError] = useState('')
  const [saveBeneficiary, setSaveBeneficiary] = useState(false)
  const [beneficiarySearch, setBeneficiarySearch] = useState('')
  const lastLookupKeyRef = useRef('')
  const latestLookupInputRef = useRef('')
  const [transferReference, setTransferReference] = useState('')
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteData, setQuoteData] = useState(null)

  const canVerify = useMemo(() => {
    return String(formData.account_number || '').trim().length === 10 && !!formData.bank_code
  }, [formData.account_number, formData.bank_code])
  const isInternal = transferMode === 'bitbridge'
  const accountResolved = accountLookupStatus === 'success'
  const amountValue = Number(formData.amount || 0)
  const hasValidAmount = Number.isFinite(amountValue) && amountValue > 0
  const hasDescription = String(formData.description || '').trim().length > 0

  const generateTransferReference = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
      const rand = (Math.random() * 16) | 0
      const val = ch === 'x' ? rand : (rand & 0x3) | 0x8
      return val.toString(16)
    })
  }

  useEffect(() => {
    if (!needsTier2Access(user)) return
    toast.info(withTier2MissingDetails(user, 'Complete Tier 2 verification to make transfers.'), {
      position: 'top-right',
      autoClose: 4000,
      pauseOnHover: true,
    })
    setIsfundTransferOpen(false)
    navigate('/dashboard/kyc')
  }, [navigate, setIsfundTransferOpen, user])

  useEffect(() => {
    if (needsTier2Access(user)) return
    dispatch(getBeneficiaries())
  }, [dispatch, user])

  useEffect(() => {
    latestLookupInputRef.current = `${formData.bank_code}:${String(formData.account_number || '').trim()}`
  }, [formData.account_number, formData.bank_code])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => {
      const next = { ...prev, [name]: value }
      if (name === 'account_number' || name === 'bank_code') {
        next.account_name = ''
        next.bank = ''
        next.counter_party_id = ''
      }
      return next
    })

    if (name === 'account_number' || name === 'bank_code') {
      setAccountLookupStatus('idle')
      setAccountLookupError('')
      lastLookupKeyRef.current = ''
      setTransferReference('')
      setQuoteData(null)
    }
    if (name === 'amount' || name === 'description') {
      setTransferReference('')
      setQuoteData(null)
    }
  }

  const setPin = (nextPin) => {
    const clean = String(nextPin || '').replace(/\D/g, '').slice(0, PIN_LENGTH)
    setFormData((prev) => ({ ...prev, transaction_pin: clean }))
  }

  const fetchAccountName = async (force = false) => {
    if (!canVerify) return

    try {
      // IMPORTANT: verification should NOT include any pin fields
      const payload = {
        account_number: String(formData.account_number || '').trim(),
        bank_code: formData.bank_code,
        inter_bank: true,
      }

      const lookupKey = `${payload.bank_code}:${payload.account_number}`
      if (!force && accountResolved && lastLookupKeyRef.current === lookupKey) return

      setAccountLookupStatus('loading')
      setAccountLookupError('')
      const requestKey = `${payload.bank_code}:${payload.account_number}`

      const res = await dispatch(resolveAccountName({ account: payload })).unwrap()
      if (latestLookupInputRef.current !== requestKey) return

      setFormData((prev) => ({
        ...prev,
        counter_party_id: '',
        bank: res?.bank_name || prev.bank,
        account_name: res?.account_name,
      }))
      setAccountLookupStatus('success')
      lastLookupKeyRef.current = `${payload.bank_code}:${payload.account_number}`
    } catch (_err) {
      setAccountLookupStatus('error')
      setAccountLookupError('Account not found. Check details.')
    }
  }

  useEffect(() => {
    if (isInternal) return
    if (!canVerify) {
      setAccountLookupStatus('idle')
      setAccountLookupError('')
      return
    }
    const lookupKey = `${formData.bank_code}:${formData.account_number}`
    if (accountResolved && lastLookupKeyRef.current === lookupKey) return

    const timer = setTimeout(() => {
      fetchAccountName()
    }, 500)

    return () => clearTimeout(timer)
  }, [
    canVerify,
    isInternal,
    formData.account_number,
    formData.bank_code,
    formData.inter_bank,
    accountResolved,
  ])

  const selectBeneficiary = (item) => {
    if (!item) return
    setFormData((prev) => ({
      ...prev,
      account_number: item.account_number || '',
      bank_code: item.bank_code || '',
      bank: item.bank_name || '',
      account_name: item.account_name || '',
      counter_party_id: item.counter_party_id || '',
    }))
    setAccountLookupStatus('success')
    setAccountLookupError('')
    lastLookupKeyRef.current = `${item.bank_code || ''}:${item.account_number || ''}`
  }

  const handleSend = async () => {
    if (isInternal) {
      if (!String(formData.phone_number || '').trim()) {
        return toast('Enter a valid phone number', { type: 'error' })
      }
      if (!hasValidAmount) return toast('Enter a valid amount', { type: 'error' })
      setStep(2)
      return
    }
    if (!canVerify) return toast('Enter a valid account number and bank', { type: 'error' })
    if (!accountResolved || !formData?.account_name)
      return toast('Please verify the account details', { type: 'error' })
    if (!hasValidAmount) return toast('Enter a valid amount', { type: 'error' })
    if (!hasDescription) return toast('Description is required', { type: 'error' })
    if (!transferReference) {
      setTransferReference(generateTransferReference())
    }
    try {
      setQuoteLoading(true)
      const quote = await dispatch(transferQuote({ amount: formData.amount })).unwrap()
      setQuoteData(quote || null)
    } catch (err) {
      return toast(pickErrorMessage(err), { type: 'error' })
    } finally {
      setQuoteLoading(false)
    }
    setStep(2)
  }

  const handleConfirm = async () => {
    if ((formData.transaction_pin || '').length !== PIN_LENGTH) {
      return toast(`Enter your ${PIN_LENGTH}-digit transaction PIN`, { type: 'error' })
    }

    if (!isInternal) {
      if (!canVerify) return toast('Enter a valid account number and bank', { type: 'error' })
      if (!accountResolved || !formData?.account_name)
        return toast('Please verify the account details', { type: 'error' })
      if (!transferReference) {
        setTransferReference(generateTransferReference())
      }
    }

    setLoading(true)
    try {
      if (isInternal) {
        const result = await dispatch(
          sendMoneyToUser({
            phone_number: String(formData.phone_number || '').trim(),
            amount: formData.amount,
            transaction_pin: formData.transaction_pin,
            description: formData.description,
          })
        ).unwrap()
        toast(result?.message || 'Transfer Successful', { type: 'success' })
      } else {
        // Backend AccountsController currently reads: params.dig(:account, :pin)
        // So we send pin explicitly.
        const transferPayload = {
          account_number: String(formData.account_number || '').trim(),
          bank_code: formData.bank_code,
          bank: formData.bank,
          account_name: formData.account_name,
          counter_party_id: formData.counter_party_id,
          amount: formData.amount,
          inter_bank: true,
          description: formData.description,
          save_beneficiary: saveBeneficiary,
          transfer_reference: transferReference,

          wallet_type: 'ngn', // enforce bridge wallet
          pin: formData.transaction_pin, // THIS is the key your backend expects
        }

        const result = await dispatch(initiateTransfer({ account: transferPayload })).unwrap()

        const transferId = result?.meta?.transfer_id
        const transferStatus = String(result?.status || '').toLowerCase()
        const successMessage =
          transferStatus === 'pending'
            ? `Transfer submitted and pending confirmation${transferId ? ` (ID: ${transferId})` : ''}`
            : transferId
            ? `Transfer Successful (ID: ${transferId})`
            : 'Transfer Successful'
        toast(successMessage, { type: transferStatus === 'pending' ? 'info' : 'success' })
      }
      dispatch(getWallet())

      setStep(1)
      setIsfundTransferOpen(false)

      setFormData({
        phone_number: '',
        account_number: '',
        bank_code: '',
        bank: '',
        account_name: '',
        counter_party_id: '',
        amount: '',
        inter_bank: false,
        description: '',
        transaction_pin: '',
      })
      setAccountLookupStatus('idle')
      setAccountLookupError('')
      setSaveBeneficiary(false)
      setTransferReference('')
      setQuoteData(null)
    } catch (err) {
      toast(pickErrorMessage(err), { type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center bg-gray-950 text-gray-100 p-6">
      <div className="w-full max-w-md bg-gray-900 rounded-2xl shadow-xl border border-gray-800 p-6 space-y-6">
        <h2 className="text-2xl font-semibold text-center text-gray-100">
          {step === 1 ? 'Send Money (NGN)' : 'Confirm Transfer'}
        </h2>

        {step === 1 && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setTransferMode('bitbridge')
                setStep(1)
              }}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                isInternal
                  ? 'border-blue-500/70 bg-blue-900/40 text-blue-100'
                  : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-blue-500/40'
              }`}
            >
              To BitBridge user
            </button>
            <button
              type="button"
              onClick={() => {
                setTransferMode('bank')
                setStep(1)
              }}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                !isInternal
                  ? 'border-blue-500/70 bg-blue-900/40 text-blue-100'
                  : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-blue-500/40'
              }`}
            >
              To bank
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            {isInternal && (
              <div>
                <label className="block text-sm font-medium text-gray-400">Recipient phone number</label>
                <input
                  type="text"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleChange}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 mt-1 text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. 08012345678"
                />
              </div>
            )}

            {!isInternal && beneficiaries?.length ? (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-400">Beneficiary (optional)</label>
                <input
                  type="text"
                  value={beneficiarySearch}
                  onChange={(e) => setBeneficiarySearch(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Search beneficiaries"
                />
                <select
                  value=""
                  onChange={(e) => {
                    const id = e.target.value
                    const item = (beneficiaries || []).find((b) => String(b.id) === id)
                    selectBeneficiary(item)
                  }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Select beneficiary</option>
                  {(beneficiaries || [])
                    .filter((item) => {
                      const term = beneficiarySearch.toLowerCase().trim()
                      if (!term) return true
                      const name = (item.account_name || '').toLowerCase()
                      const bank = (item.bank_name || '').toLowerCase()
                      const acct = String(item.account_number || '')
                      return name.includes(term) || bank.includes(term) || acct.includes(term)
                    })
                    .map((item) => {
                      const last4 = String(item.account_number || '').slice(-4)
                      const masked = last4 ? `****${last4}` : '****'
                      return (
                        <option key={item.id} value={item.id}>
                          {`${item.account_name || 'Unknown'} - ${masked} - ${item.bank_name || item.bank_code}`}
                        </option>
                      )
                    })}
                </select>
              </div>
            ) : null}

            {!isInternal && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-400">Account Number</label>
                  <input
                    type="text"
                    name="account_number"
                    value={formData.account_number}
                    onChange={handleChange}
                    maxLength={10}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 mt-1 text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Enter 10-digit account number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400">Bank</label>
                  <select
                    name="bank_code"
                    value={formData.bank_code}
                    onChange={handleChange}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 mt-1 text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">Select Bank</option>
                    {(banks || []).map(({ attributes: { name, nipCode }, id }) => (
                      <option key={id} value={nipCode}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                {accountLookupStatus === 'loading' && (
                  <div className="inline-flex items-center gap-2 rounded-full border border-blue-700/60 bg-blue-900/30 px-3 py-1 text-xs text-blue-200">
                    <span className="h-3 w-3 animate-spin rounded-full border border-blue-200 border-t-transparent" />
                    Checking account
                  </div>
                )}
                {accountLookupStatus === 'success' && formData.account_name && (
                  <div className="inline-flex items-center gap-2 rounded-full bg-green-900/30 border border-green-600 px-3 py-1 text-xs text-green-200">
                    Account verified: {formData.account_name}
                  </div>
                )}
                {accountLookupStatus === 'error' && (
                  <div className="inline-flex items-center gap-2 rounded-full bg-red-900/30 border border-red-600 px-3 py-1 text-xs text-red-200">
                    Account not found
                    <button
                      type="button"
                      onClick={() => fetchAccountName(true)}
                      className="text-[11px] font-semibold text-red-100 underline underline-offset-2"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-400">Amount (NGN)</label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 mt-1 text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Enter Amount"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400">Description</label>
              <input
                type="text"
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 mt-1 text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Narrative"
              />
            </div>

            {!isInternal && (
              <label className="flex items-center gap-2 text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={saveBeneficiary}
                  onChange={(e) => setSaveBeneficiary(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-blue-500"
                />
                Save beneficiary
              </label>
            )}

            <AppButton
              loading={loading || accountLoading}
              onClick={handleSend}
              disabled={
                loading ||
                quoteLoading ||
                (isInternal
                  ? !formData.phone_number || !hasValidAmount
                  : !accountResolved || !hasValidAmount || !hasDescription)
              }
              className={`w-full py-2 rounded-lg font-semibold transition-colors ${
                (isInternal
                  ? formData.phone_number && hasValidAmount
                  : accountResolved && hasValidAmount && hasDescription)
                  ? '!bg-green-600 hover:bg-blue-500 '
                  : 'bg-gray-700 !text-gray-400 '
              }`}
            >
              {quoteLoading ? 'Checking transfer...' : 'Send'}
            </AppButton>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg space-y-2">
              {isInternal ? (
                <>
                  <p className="text-gray-300">
                    <span className="font-medium text-gray-400">Recipient phone:</span>{' '}
                    {formData.phone_number}
                  </p>
                  <p className="text-gray-300">
                    <span className="font-medium text-gray-400">Amount:</span>{' '}
                    {nairaFormat(formData.amount, 'ngn')}
                  </p>
                  {formData.description ? (
                    <p className="text-gray-300">
                      <span className="font-medium text-gray-400">Note:</span> {formData.description}
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="text-gray-300">
                    <span className="font-medium text-gray-400">Bank:</span> {formData.bank}
                  </p>
                  <p className="text-gray-300">
                    <span className="font-medium text-gray-400">Account Number:</span>{' '}
                    {formData.account_number}
                  </p>
                  <p className="text-gray-300">
                    <span className="font-medium text-gray-400">Account Name:</span>{' '}
                    {formData.account_name}
                  </p>
                  <p className="text-gray-300">
                    <span className="font-medium text-gray-400">Amount:</span>{' '}
                    {nairaFormat(formData.amount, 'ngn')}
                  </p>
                  <p className="text-gray-300">
                    <span className="font-medium text-gray-400">Narration:</span>{' '}
                    {formData.description}
                  </p>
                  <p className="text-gray-300">
                    <span className="font-medium text-gray-400">Reference:</span>{' '}
                    {transferReference}
                  </p>
                  {quoteData?.fee != null && (
                    <p className="text-gray-300">
                      <span className="font-medium text-gray-400">Fee:</span>{' '}
                      {nairaFormat(quoteData.fee, 'ngn')}
                    </p>
                  )}
                  {quoteData?.total_debit != null && (
                    <p className="text-gray-300">
                      <span className="font-medium text-gray-400">Total debit:</span>{' '}
                      {nairaFormat(quoteData.total_debit, 'ngn')}
                    </p>
                  )}
                </>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400">
                Enter {PIN_LENGTH}-digit transaction PIN
              </label>
              <TransactionPinInput
                value={formData.transaction_pin}
                onChange={setPin}
                length={PIN_LENGTH}
                disabled={loading}
              />
            </div>

            <AppButton
              loading={loading}
              onClick={handleConfirm}
              disabled={(formData.transaction_pin || '').length !== PIN_LENGTH || loading}
              className={`w-full py-2 rounded-lg font-semibold transition-colors ${
                (formData.transaction_pin || '').length === PIN_LENGTH
                  ? '!bg-green-600 hover:bg-blue-500 '
                  : 'bg-gray-700 !text-gray-400 '
              }`}
            >
              Confirm Transfer
            </AppButton>

            <button
              onClick={() => setStep(1)}
              className="w-full text-blue-400 font-medium text-sm underline mt-2 hover:text-blue-300"
              type="button"
            >
              Go Back
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
