import React, { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import {
  getBeneficiaries,
  initiateTransfer,
  verifyAccountUser,
} from '../../redux/actions/account'
import AppButton from '../button/Button'
import { nairaFormat } from '../../utils/nairaFormat'
import { toast } from 'react-toastify'
import { withTier2MissingDetails } from '../../utils/kycGate'
import { getWallet, sendMoneyToUser } from '../../redux/actions/wallet'

// ✅ Masked PIN input
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
  const [isVerified, setIsVerified] = useState(false)
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

  const canVerify = useMemo(() => {
    return String(formData.account_number || '').trim().length === 10 && !!formData.bank_code
  }, [formData.account_number, formData.bank_code])
  const isInternal = transferMode === 'bitbridge'

  useEffect(() => {
    const userKyc = (user?.kyc_level || 'nil').toString().toLowerCase()
    const needsTier2 = ['nil', '', 'tier_0', 'tier_1'].includes(userKyc)
    if (!needsTier2) return
    toast.info(withTier2MissingDetails(user, 'Complete Tier 2 verification to make transfers.'), {
      position: 'top-right',
      autoClose: 4000,
      pauseOnHover: true,
    })
    setIsfundTransferOpen(false)
    navigate('/dashboard/kyc')
  }, [navigate, setIsfundTransferOpen, user])

  useEffect(() => {
    const userKyc = (user?.kyc_level || 'nil').toString().toLowerCase()
    const needsTier2 = ['nil', '', 'tier_0', 'tier_1'].includes(userKyc)
    if (needsTier2) return
    dispatch(getBeneficiaries())
  }, [dispatch, user])

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
      setIsVerified(false)
    }
  }

  const setPin = (nextPin) => {
    const clean = String(nextPin || '').replace(/\D/g, '').slice(0, PIN_LENGTH)
    setFormData((prev) => ({ ...prev, transaction_pin: clean }))
  }

  const fetchAccountName = async () => {
    if (!canVerify) return

    setLoading(true)
    try {
      // IMPORTANT: verification should NOT include any pin fields
      const payload = {
        account_number: String(formData.account_number || '').trim(),
        bank_code: formData.bank_code,
        inter_bank: !!formData.inter_bank,
      }

      const res = await dispatch(verifyAccountUser({ account: payload })).unwrap()

      setFormData((prev) => ({
        ...prev,
        counter_party_id: res?.data?.id,
        bank: res?.data?.attributes?.bank?.name,
        account_name: res?.data?.attributes?.accountName,
      }))
      setIsVerified(true)
    } catch (err) {
      toast(pickErrorMessage(err), { type: 'error' })
    } finally {
      setLoading(false)
    }
  }

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
    setIsVerified(true)
  }

  const handleSend = () => {
    const amt = Number(formData?.amount)
    if (isInternal) {
      if (!String(formData.phone_number || '').trim()) {
        return toast('Enter a valid phone number', { type: 'error' })
      }
      if (!amt || amt <= 0) return toast('Enter a valid amount', { type: 'error' })
      setStep(2)
      return
    }
    if (!canVerify) return toast('Enter a valid account number and bank', { type: 'error' })
    if (!isVerified || !formData?.account_name)
      return toast('Please verify the account details', { type: 'error' })
    if (!amt || amt <= 0) return toast('Enter a valid amount', { type: 'error' })
    setStep(2)
  }

  const handleConfirm = async () => {
    if ((formData.transaction_pin || '').length !== PIN_LENGTH) {
      return toast(`Enter your ${PIN_LENGTH}-digit transaction PIN`, { type: 'error' })
    }

    if (!isInternal) {
      if (!canVerify) return toast('Enter a valid account number and bank', { type: 'error' })
      if (!isVerified || !formData?.account_name)
        return toast('Please verify the account details', { type: 'error' })
      if (!formData.counter_party_id) {
        return toast('Please verify the account details before transferring.', { type: 'error' })
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
        // ? Backend AccountsController currently reads: params.dig(:account, :pin)
        // So we send pin explicitly.
        const transferPayload = {
          account_number: String(formData.account_number || '').trim(),
          bank_code: formData.bank_code,
          bank: formData.bank,
          account_name: formData.account_name,
          counter_party_id: formData.counter_party_id,
          amount: formData.amount,
          inter_bank: !!formData.inter_bank,
          description: formData.description,

          wallet_type: 'ngn', // ? enforce bridge wallet
          pin: formData.transaction_pin, // ? THIS is the key your backend expects
        }

        const result = await dispatch(initiateTransfer({ account: transferPayload })).unwrap()

        const transferId = result?.meta?.transfer_id
        const successMessage = transferId
          ? `Transfer Successful (ID: ${transferId})`
          : 'Transfer Successful'
        toast(successMessage, { type: 'success' })
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
      setIsVerified(false)
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
                <p className="text-xs text-gray-400">Recent beneficiaries</p>
                <div className="flex flex-wrap gap-2">
                  {beneficiaries.slice(0, 6).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectBeneficiary(item)}
                      className="px-3 py-1.5 text-xs rounded-full bg-gray-800 border border-gray-700 text-gray-200 hover:border-blue-500/60 transition-colors"
                    >
                      {item.account_name || 'Unknown'} • ••••
                      {String(item.account_number || '').slice(-4)}
                    </button>
                  ))}
                </div>
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

                <AppButton
                  loading={loading || accountLoading}
                  onClick={fetchAccountName}
                  disabled={!canVerify || loading}
                  className="w-full py-2 rounded-lg font-semibold transition-colors bg-gray-800 border border-gray-700 text-gray-200 hover:border-blue-500/70"
                >
                  Verify account
                </AppButton>
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

            {!isInternal && loading && (
              <div className="bg-blue-900/30 border border-blue-600 p-3 rounded-lg text-center text-blue-300">
                <span className="font-semibold">Verifying account...</span>
              </div>
            )}

            {!isInternal && formData.account_name && (
              <div className="bg-green-900/30 border border-green-600 p-3 rounded-lg text-center text-green-300">
                Account Name: <span className="font-semibold">{formData.account_name}</span>
              </div>
            )}

            <AppButton
              loading={loading || accountLoading}
              onClick={handleSend}
              disabled={loading || (isInternal ? !formData.phone_number : !formData.account_name)}
              className={`w-full py-2 rounded-lg font-semibold transition-colors ${
                (isInternal ? formData.phone_number : formData.account_name)
                  ? '!bg-green-600 hover:bg-blue-500 '
                  : 'bg-gray-700 !text-gray-400 '
              }`}
            >
              Send
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
