// frontend/bit-bridge-frontend/src/components/pin/TransactionPinSettings.jsx

import React, { useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { useSelector } from 'react-redux'

import TransactionPinInput from './TransactionPinInput'

import {
  verifyTransactionPin,
  setTransactionPin,
  resetPinRequest,
  resetPinConfirm,
  changeTransactionPin,
} from '../../api/transactionPin'

export default function TransactionPinSettings() {
  const user = useSelector((s) => s.auth.user)

  const up = user?.user_profile || {}

  const phoneVerified =
    user?.phone_verified === true ||
    !!user?.phone_verified_at ||
    !!up?.phone_verified_at

  const phoneForDisplay = useMemo(() => {
    if (up?.phone_verified_at && up?.phone_e164) return up.phone_e164
    return up?.phone_number || ''
  }, [up?.phone_verified_at, up?.phone_e164, up?.phone_number])

  const isDev = import.meta?.env?.DEV === true

  const [mode, setMode] = useState('set') // 'set' | 'change' | 'forgot'
  const [loading, setLoading] = useState(false)

  // --- Set PIN
  const [newPin, setNewPin] = useState('')
  const [confirmNewPin, setConfirmNewPin] = useState('')

  // --- Change PIN
  const [currentPin, setCurrentPin] = useState('')
  const [changeNewPin, setChangeNewPin] = useState('')
  const [changeConfirmPin, setChangeConfirmPin] = useState('')

  // --- Forgot PIN (OTP reset)
  const [otpStep, setOtpStep] = useState(1) // 1=request otp, 2=enter otp, 3=set new pin
  const [otpPhone, setOtpPhone] = useState(phoneForDisplay || '')
  const [otpCode, setOtpCode] = useState('')
  const [resetNewPin, setResetNewPin] = useState('')
  const [resetConfirmPin, setResetConfirmPin] = useState('')

  // --- Dev verify pin
  const [verPin, setVerPin] = useState('')

  const is4Digits = (v) => /^\d{4}$/.test(String(v || ''))
  const is6Digits = (v) => /^\d{6}$/.test(String(v || ''))

  const resetAll = () => {
    setNewPin('')
    setConfirmNewPin('')
    setCurrentPin('')
    setChangeNewPin('')
    setChangeConfirmPin('')

    setOtpStep(1)
    setOtpPhone(phoneForDisplay || '')
    setOtpCode('')
    setResetNewPin('')
    setResetConfirmPin('')

    setVerPin('')
  }

  const errMsg = (err, fallback) =>
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    (Array.isArray(err?.response?.data?.errors) ? err.response.data.errors.join(', ') : null) ||
    fallback

  // -------------------------
  // SET PIN
  // -------------------------
  const handleSetPin = async () => {
    if (!phoneVerified) {
      toast('Please verify your phone number before setting a PIN.', { type: 'error' })
      return
    }

    if (!is4Digits(newPin)) return toast('PIN must be exactly 4 digits', { type: 'error' })
    if (newPin !== confirmNewPin) return toast('PINs do not match', { type: 'error' })

    try {
      setLoading(true)
      await setTransactionPin(newPin)
      toast('Transaction PIN set successfully', { type: 'success' })
      resetAll()
    } catch (err) {
      toast(errMsg(err, 'Failed to set PIN'), { type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // -------------------------
  // CHANGE PIN (KNOWS OLD PIN)
  // -------------------------
  const handleChangePin = async () => {
    if (!phoneVerified) {
      toast('Please verify your phone number before changing your PIN.', { type: 'error' })
      return
    }

    if (!is4Digits(currentPin)) return toast('Current PIN must be 4 digits', { type: 'error' })
    if (!is4Digits(changeNewPin)) return toast('New PIN must be 4 digits', { type: 'error' })
    if (changeNewPin !== changeConfirmPin) return toast('New PINs do not match', { type: 'error' })
    if (currentPin === changeNewPin)
      return toast('New PIN must be different from current PIN', { type: 'error' })

    try {
      setLoading(true)
      await changeTransactionPin({ current_pin: currentPin, new_pin: changeNewPin })
      toast('Transaction PIN changed successfully', { type: 'success' })
      resetAll()
      setMode('set')
    } catch (err) {
      toast(errMsg(err, 'Failed to change PIN'), { type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // -------------------------
  // FORGOT PIN (OTP RESET)
  // -------------------------
  const handleRequestOtp = async () => {
    if (!otpPhone?.trim()) return toast('Phone number is required', { type: 'error' })

    try {
      setLoading(true)
      await resetPinRequest({ phone_number: otpPhone })
      toast('OTP sent to your phone', { type: 'success' })
      setOtpStep(2)
    } catch (err) {
      toast(errMsg(err, 'Failed to request OTP'), { type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleGoToSetNewPin = () => {
    if (!is6Digits(otpCode)) return toast('Enter the 6-digit OTP code', { type: 'error' })
    setOtpStep(3)
  }

  const handleConfirmResetPin = async () => {
    if (!is6Digits(otpCode)) return toast('Enter the 6-digit OTP code', { type: 'error' })
    if (!is4Digits(resetNewPin))
      return toast('New PIN must be exactly 4 digits', { type: 'error' })
    if (resetNewPin !== resetConfirmPin) return toast('PINs do not match', { type: 'error' })

    try {
      setLoading(true)

      await resetPinConfirm({
        phone_number: otpPhone,
        code: otpCode,
        new_pin: resetNewPin,
      })

      toast('Transaction PIN reset successfully', { type: 'success' })
      resetAll()
      setMode('set')
    } catch (err) {
      toast(errMsg(err, 'Failed to reset PIN'), { type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // -------------------------
  // DEV: VERIFY PIN
  // -------------------------
  const handleVerifyDev = async () => {
    if (!isDev) return
    if (!is4Digits(verPin)) return toast('Enter a valid 4-digit PIN', { type: 'error' })
    try {
      setLoading(true)
      await verifyTransactionPin(verPin)
      toast('PIN verified ✅', { type: 'success' })
      setVerPin('')
    } catch (err) {
      toast(errMsg(err, 'Invalid PIN'), { type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // If phone is not verified, default to "forgot" to avoid confusion
  // (user can still reset via OTP if needed)
  const effectiveMode = phoneVerified ? mode : 'forgot'

  return (
    <div className="w-full bg-gray-900 rounded-2xl shadow-xl border border-gray-800 p-6 space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-gray-100">Transaction PIN</h3>
        <p className="text-sm text-gray-400">
          This PIN authorizes transfers and other sensitive actions.
        </p>
      </div>

      {!phoneVerified && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3">
          <p className="text-xs text-yellow-200/90">
            Your phone is not verified. You won’t be able to set or change a PIN until you verify
            your phone number. You can still reset via OTP if needed.
          </p>
        </div>
      )}

      {/* Mode switch */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            resetAll()
            setMode('set')
          }}
          className={`px-3 py-2 rounded-lg text-sm font-semibold border ${
            effectiveMode === 'set'
              ? 'bg-slate-800 text-white border-slate-600'
              : 'bg-transparent text-slate-200 border-slate-700 hover:bg-slate-800/40'
          }`}
          disabled={loading || !phoneVerified}
          title={!phoneVerified ? 'Verify phone to set PIN' : undefined}
        >
          Set PIN
        </button>

        <button
          type="button"
          onClick={() => {
            resetAll()
            setMode('change')
          }}
          className={`px-3 py-2 rounded-lg text-sm font-semibold border ${
            effectiveMode === 'change'
              ? 'bg-slate-800 text-white border-slate-600'
              : 'bg-transparent text-slate-200 border-slate-700 hover:bg-slate-800/40'
          }`}
          disabled={loading || !phoneVerified}
          title={!phoneVerified ? 'Verify phone to change PIN' : undefined}
        >
          Change PIN (I know it)
        </button>

        <button
          type="button"
          onClick={() => {
            resetAll()
            setMode('forgot')
          }}
          className={`px-3 py-2 rounded-lg text-sm font-semibold border ${
            effectiveMode === 'forgot'
              ? 'bg-slate-800 text-white border-slate-600'
              : 'bg-transparent text-slate-200 border-slate-700 hover:bg-slate-800/40'
          }`}
          disabled={loading}
        >
          Forgot PIN (OTP)
        </button>
      </div>

      {/* SET PIN */}
      {effectiveMode === 'set' && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-300">Set PIN</p>

          <TransactionPinInput
            value={newPin}
            onChange={setNewPin}
            maxLength={4}
            disabled={loading}
            placeholder="••••"
            allowPaste={false}
            className="text-center"
            name="new_pin"
          />

          <TransactionPinInput
            value={confirmNewPin}
            onChange={setConfirmNewPin}
            maxLength={4}
            disabled={loading}
            placeholder="••••"
            allowPaste={false}
            className="text-center"
            name="confirm_new_pin"
          />

          <button
            type="button"
            disabled={loading}
            onClick={handleSetPin}
            className={`w-full py-2 rounded-lg font-semibold transition-colors ${
              loading ? 'bg-gray-700 text-gray-300' : 'bg-green-600 hover:bg-blue-500 text-white'
            }`}
          >
            {loading ? 'Saving…' : 'Save PIN'}
          </button>
        </div>
      )}

      {/* CHANGE PIN */}
      {effectiveMode === 'change' && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-300">Change PIN (no OTP required)</p>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Current PIN</label>
            <TransactionPinInput
              value={currentPin}
              onChange={setCurrentPin}
              maxLength={4}
              disabled={loading}
              placeholder="••••"
              allowPaste={false}
              className="text-center"
              name="current_pin"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">New PIN</label>
            <TransactionPinInput
              value={changeNewPin}
              onChange={setChangeNewPin}
              maxLength={4}
              disabled={loading}
              placeholder="••••"
              allowPaste={false}
              className="text-center"
              name="new_pin"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Confirm New PIN</label>
            <TransactionPinInput
              value={changeConfirmPin}
              onChange={setChangeConfirmPin}
              maxLength={4}
              disabled={loading}
              placeholder="••••"
              allowPaste={false}
              className="text-center"
              name="confirm_new_pin"
            />
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleChangePin}
            className={`w-full py-2 rounded-lg font-semibold transition-colors ${
              loading ? 'bg-gray-700 text-gray-300' : 'bg-green-600 hover:bg-blue-500 text-white'
            }`}
          >
            {loading ? 'Updating…' : 'Change PIN'}
          </button>
        </div>
      )}

      {/* FORGOT PIN */}
      {effectiveMode === 'forgot' && (
        <div className="space-y-4">
          {/* Step 1 */}
          {otpStep === 1 && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Phone number</label>
                <input
                  type="text"
                  value={otpPhone}
                  onChange={(e) => setOtpPhone(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="+234..."
                  disabled={loading}
                />
              </div>

              <button
                type="button"
                disabled={loading || !otpPhone.trim()}
                onClick={handleRequestOtp}
                className={`w-full py-2 rounded-lg font-semibold transition-colors ${
                  loading ? 'bg-gray-700 text-gray-300' : 'bg-gray-800 hover:bg-gray-700 text-white'
                }`}
              >
                {loading ? 'Sending…' : 'Send OTP'}
              </button>
            </div>
          )}

          {/* Step 2 */}
          {otpStep === 2 && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Enter 6-digit OTP</label>
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-center tracking-widest text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="••••••"
                  disabled={loading}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setOtpStep(1)}
                  className="flex-1 py-2 rounded-lg font-semibold border border-gray-700 bg-transparent text-gray-200 hover:bg-gray-800/40"
                >
                  Back
                </button>

                <button
                  type="button"
                  disabled={loading || otpCode.length !== 6}
                  onClick={handleGoToSetNewPin}
                  className={`flex-1 py-2 rounded-lg font-semibold transition-colors ${
                    loading ? 'bg-gray-700 text-gray-300' : 'bg-green-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  Continue
                </button>
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={handleRequestOtp}
                className="w-full py-2 rounded-lg font-semibold border border-gray-700 bg-gray-800 hover:bg-gray-700 text-white"
              >
                Resend OTP
              </button>
            </div>
          )}

          {/* Step 3 */}
          {otpStep === 3 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">Enter your new 4-digit PIN.</p>

              <TransactionPinInput
                value={resetNewPin}
                onChange={setResetNewPin}
                maxLength={4}
                disabled={loading}
                placeholder="••••"
                allowPaste={false}
                className="text-center"
                name="reset_new_pin"
              />

              <TransactionPinInput
                value={resetConfirmPin}
                onChange={setResetConfirmPin}
                maxLength={4}
                disabled={loading}
                placeholder="••••"
                allowPaste={false}
                className="text-center"
                name="reset_confirm_pin"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setOtpStep(2)}
                  className="flex-1 py-2 rounded-lg font-semibold border border-gray-700 bg-transparent text-gray-200 hover:bg-gray-800/40"
                >
                  Back
                </button>

                <button
                  type="button"
                  disabled={loading || resetNewPin.length !== 4 || resetNewPin !== resetConfirmPin}
                  onClick={handleConfirmResetPin}
                  className={`flex-1 py-2 rounded-lg font-semibold transition-colors ${
                    loading ? 'bg-gray-700 text-gray-300' : 'bg-green-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  {loading ? 'Saving…' : 'Reset PIN'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DEV ONLY VERIFY */}
      {isDev && (
        <div className="border-t border-gray-800 pt-5 space-y-3">
          <p className="text-sm font-medium text-gray-300">Verify PIN (DEV only)</p>

          <TransactionPinInput
            value={verPin}
            onChange={setVerPin}
            maxLength={4}
            disabled={loading}
            placeholder="••••"
            allowPaste={false}
            className="text-center"
            name="verify_pin"
          />

          <button
            type="button"
            disabled={loading}
            onClick={handleVerifyDev}
            className={`w-full py-2 rounded-lg font-semibold transition-colors ${
              loading ? 'bg-gray-700 text-gray-300' : 'bg-gray-800 hover:bg-gray-700 text-white'
            }`}
          >
            {loading ? 'Checking…' : 'Verify PIN'}
          </button>
        </div>
      )}
    </div>
  )
}
