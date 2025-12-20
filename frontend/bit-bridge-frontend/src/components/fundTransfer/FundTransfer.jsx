import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { initiateTransfer, verifyAccountUser } from '../../redux/actions/account'
import AppButton from '../button/Button'
import { nairaFormat } from '../../utils/nairaFormat'
import { toast } from 'react-toastify'
import { getWallet } from '../../redux/actions/wallet'

// ✅ Use your reusable masked PIN input
import TransactionPinInput from '../pin/TransactionPinInput' // <-- adjust path if yours differs

const PIN_LENGTH = 6 // ✅ set to 4 if your backend still expects 4

export default function MoneyTransferFlow({ setIsfundTransferOpen }) {
  const [loading, setLoading] = useState(false)
  const dispatch = useDispatch()
  const { banks, loading: accountLoading } = useSelector((state) => state.account)

  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    account_number: '',
    bank_code: '',
    bank: '',
    account_name: '',
    pin: '',
    amount: null,
    inter_bank: false,
    description: '',
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const setPin = (nextPin) => {
    // ensure digits-only + enforce length here too
    const clean = String(nextPin || '').replace(/\D/g, '').slice(0, PIN_LENGTH)
    setFormData((prev) => ({ ...prev, pin: clean }))
  }

  const fetchAccountName = () => {
    if (formData?.account_number?.length < 10 || !formData?.bank_code) return
    setLoading(true)

    dispatch(verifyAccountUser({ account: formData }))
      .unwrap()
      .then((res) => {
        setFormData((prev) => ({
          ...prev,
          counter_party_id: res?.data?.id,
          bank: res?.data?.attributes?.bank?.name,
          account_name: res?.data?.attributes?.accountName,
        }))
      })
      .catch((err) => {
        toast(err?.message || 'Failed to verify account', { type: 'error' })
      })
      .finally(() => setLoading(false))
  }

  const handleSend = () => {
    if (formData?.account_name) setStep(2)
  }

  const handleConfirm = () => {
    setLoading(true)

    dispatch(initiateTransfer({ account: { ...formData } }))
      .unwrap()
      .then(() => {
        setStep(1)
        setIsfundTransferOpen(false)
        dispatch(getWallet())

        toast('Transfer Successful', { type: 'success' })

        // ✅ reset safely (don’t set null; null can crash render)
        setFormData({
          account_number: '',
          bank_code: '',
          bank: '',
          account_name: '',
          pin: '',
          amount: null,
          inter_bank: false,
          description: '',
        })
      })
      .catch((err) => {
        toast(err?.message || 'Transfer failed', { type: 'error' })
      })
      .finally(() => setLoading(false))
  }

  return (
    <div className="flex flex-col items-center justify-center bg-gray-950 text-gray-100 p-6">
      <div className="w-full max-w-md bg-gray-900 rounded-2xl shadow-xl border border-gray-800 p-6 space-y-6">
        <h2 className="text-2xl font-semibold text-center text-gray-100">
          {step === 1 ? 'Transfer Funds' : 'Confirm Transfer'}
        </h2>

        {/* STEP 1 */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400">Account Number</label>
              <input
                type="text"
                name="account_number"
                value={formData?.account_number || ''}
                onChange={handleChange}
                onBlur={fetchAccountName}
                maxLength="10"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 mt-1 text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Enter 10-digit account number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400">Bank</label>
              <select
                name="bank_code"
                value={formData?.bank_code || ''}
                onChange={handleChange}
                onBlur={fetchAccountName}
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

            <div>
              <label className="block text-sm font-medium text-gray-400">Amount</label>
              <input
                type="number"
                name="amount"
                value={formData?.amount ?? ''}
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
                value={formData?.description || ''}
                onChange={handleChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 mt-1 text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Narrative"
              />
            </div>

            {loading && (
              <div className="bg-blue-900/30 border border-blue-600 p-3 rounded-lg text-center text-blue-300">
                <span className="font-semibold">Verifying account...</span>
              </div>
            )}

            {formData?.account_name && (
              <div className="bg-green-900/30 border border-green-600 p-3 rounded-lg text-center text-green-300">
                Account Name: <span className="font-semibold">{formData?.account_name}</span>
              </div>
            )}

            <AppButton
              loading={loading || accountLoading}
              onClick={handleSend}
              disabled={!formData?.account_name || loading}
              className={`w-full py-2 rounded-lg font-semibold transition-colors ${
                formData?.account_name ? '!bg-green-600 hover:bg-blue-500 ' : 'bg-gray-700 !text-gray-400 '
              }`}
            >
              Send
            </AppButton>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg space-y-2">
              <p className="text-gray-300">
                <span className="font-medium text-gray-400">Bank:</span> {formData?.bank}
              </p>
              <p className="text-gray-300">
                <span className="font-medium text-gray-400">Account Number:</span> {formData?.account_number}
              </p>
              <p className="text-gray-300">
                <span className="font-medium text-gray-400">Account Name:</span> {formData?.account_name}
              </p>
              <p className="text-gray-300">
                <span className="font-medium text-gray-400">Amount:</span> {nairaFormat(formData?.amount)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400">
                Enter {PIN_LENGTH}-digit PIN
              </label>

              {/* ✅ Standardized masked PIN input */}
              <TransactionPinInput
                value={formData?.pin || ''}
                onChange={setPin}
                length={PIN_LENGTH}
                disabled={loading}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 mt-1 text-center tracking-widest text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <AppButton
              loading={loading}
              onClick={handleConfirm}
              disabled={(formData?.pin || '').length !== PIN_LENGTH || loading}
              className={`w-full py-2 rounded-lg font-semibold transition-colors ${
                (formData?.pin || '').length === PIN_LENGTH
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
