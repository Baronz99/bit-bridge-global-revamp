// frontend/bit-bridge-frontend/src/components/pin/TransactionPinSettings.jsx

import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { useSelector } from 'react-redux'

import TransactionPinInput from './TransactionPinInput'

import {
  verifyTransactionPin,
  setTransactionPin,
  resetPinRequest,
  resetPinConfirm,
  changeTransactionPin,
  getTransactionPinStatus,
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

  // pin status (from backend)
  const [pinSet, setPinSet] = useState(null) // null=unknown, boolean otherwise
  const [pinSetAt, setPinSetAt] = useState(null)

  const [mode, setMode] = useState('set') // 'set' | 'change' | 'forgot'
  const [loading, setLoading] = useState(false)
  const [pinError, setPinError] = useState('')

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

  const errMsg = (err, fallback) => {
    const data = err?.response?.data
    const message =
      data?.message ||
      data?.error ||
      (Array.isArray(data?.errors) ? data.errors.join(', ') : null) ||
      null

    const attemptsRemaining =
      typeof data?.attempts_remaining === 'number' ? data.attempts_remaining : null
    const retryAfter =
      typeof data?.retry_after_seconds === 'number' ? data.retry_after_seconds : null

    const parts = [message || fallback]

    if (attemptsRemaining !== null) {
      parts.push(`Attempts remaining: ${attemptsRemaining}`)
    }

    if (retryAfter !== null) {
      const mins = Math.max(1, Math.ceil(retryAfter / 60))
      parts.push(`Try again in about ${mins} minute(s).`)
    }

    return parts.filter(Boolean).join(' ')
  }

  const resetAll = () => {
    setPinError('')
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

  const refreshStatus = async () => {
    try {
      const res = await getTransactionPinStatus()
      const data = res?.data || {}
      setPinSet(!!data.pin_set)
      setPinSetAt(data.pin_set_at || null)
      return !!data.pin_set
    } catch (err) {
      // If status endpoint not deployed yet, fail gracefully.
      // We keep pinSet as null and UI will still work but less smart.
      console.warn('[PIN] status fetch failed:', err)
      return null
    }
  }

  // Load pin status once
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const val = await refreshStatus()
      if (!mounted) return

      // If PIN is set, default to change (more useful)
      if (val === true) setMode('change')
      if (val === false) setMode('set')
    })()
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep OTP phone synced with profile
  useEffect(() => {
    setOtpPhone(phoneForDisplay || '')
  }, [phoneForDisplay])

  // If phone is not verified, don't allow set/change (backend blocks anyway)
  // still allow forgot via OTP reset
  const effectiveMode = phoneVerified ? mode : 'forgot'

  const canShowSet = pinSet === false || pinSet === null // if unknown, allow but handle 409 response
  const canShowChange = pinSet === true || pinSet === null
  const canShowForgot = true

  // -------------------------
  // SET PIN
  // -------------------------
  const handleSetPin = async () => {
    setPinError('')
    if (!phoneVerified) {
      setPinError('Please verify your phone number before setting a PIN.')
      return
    }

    if (!is4Digits(newPin)) return setPinError('PIN must be exactly 4 digits')
    if (newPin !== confirmNewPin) return setPinError('PINs do not match')

    try {
      setLoading(true)
      await setTransactionPin(newPin)
      toast('Transaction PIN set successfully', { type: 'success' })
      resetAll()
      const nowSet = await refreshStatus()
      if (nowSet === true) setMode('change')
    } catch (err) {
      // If backend now blocks overwriting, it should return 409
      if (err?.response?.status === 409) {
        setPinError('PIN is already set. Use Change PIN or Forgot PIN.')
        await refreshStatus()
        resetAll()
        setMode('change')
        return
      }
      setPinError(errMsg(err, 'Failed to set PIN'))
    } finally {
      setLoading(false)
    }
  }

  // -------------------------
  // CHANGE PIN (KNOWS OLD PIN)
  // -------------------------
  const handleChangePin = async () => {
    setPinError('')
    if (!phoneVerified) {
      setPinError('Please verify your phone number before changing your PIN.')
      return
    }

    if (!is4Digits(currentPin)) return setPinError('Current PIN must be 4 digits')
    if (!is4Digits(changeNewPin)) return setPinError('New PIN must be 4 digits')
    if (changeNewPin !== changeConfirmPin) return setPinError('New PINs do not match')
    if (currentPin === changeNewPin)
      return setPinError('New PIN must be different from current PIN')

    try {
      setLoading(true)
      await changeTransactionPin({ current_pin: currentPin, new_pin: changeNewPin })
      toast('Transaction PIN changed successfully', { type: 'success' })
      resetAll()
      await refreshStatus()
      setMode('change')
    } catch (err) {
      setPinError(errMsg(err, 'Failed to change PIN'))
    } finally {
      setLoading(false)
    }
  }

  // -------------------------
  // FORGOT PIN (OTP RESET)
  // -------------------------
  const handleRequestOtp = async () => {
    setPinError('')
    if (!otpPhone?.trim()) return setPinError('Phone number is required')

    try {
      setLoading(true)
      await resetPinRequest({ phone_number: otpPhone })
      toast('OTP sent to your phone', { type: 'success' })
      setOtpStep(2)
    } catch (err) {
      setPinError(errMsg(err, 'Failed to request OTP'))
    } finally {
      setLoading(false)
    }
  }

  const handleGoToSetNewPin = () => {
    setPinError('')
    if (!is6Digits(otpCode)) return setPinError('Enter the 6-digit OTP code')
    setOtpStep(3)
  }

  const handleConfirmResetPin = async () => {
    setPinError('')
    if (!is6Digits(otpCode)) return setPinError('Enter the 6-digit OTP code')
    if (!is4Digits(resetNewPin))
      return setPinError('New PIN must be exactly 4 digits')
    if (resetNewPin !== resetConfirmPin) return setPinError('PINs do not match')

    try {
      setLoading(true)

      await resetPinConfirm({
        phone_number: otpPhone,
        code: otpCode,
        new_pin: resetNewPin,
      })

      toast('Transaction PIN reset successfully', { type: 'success' })
      resetAll()
      await refreshStatus()
      setMode('change')
    } catch (err) {
      setPinError(errMsg(err, 'Failed to reset PIN'))
    } finally {
      setLoading(false)
    }
  }

  // -------------------------
  // DEV: VERIFY PIN
  // -------------------------
  const handleVerifyDev = async () => {
    setPinError('')
    if (!isDev) return
    if (!is4Digits(verPin)) return setPinError('Enter a valid 4-digit PIN')
    try {
      setLoading(true)
      await verifyTransactionPin(verPin)
      toast('PIN verified ✅', { type: 'success' })
      setVerPin('')
    } catch (err) {
      setPinError(errMsg(err, 'Invalid PIN'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full bg-gray-900 rounded-2xl shadow-xl border border-gray-800 p-6 space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-gray-100">Transaction PIN</h3>
        <p className="text-sm text-gray-400">
          This PIN authorizes transfers and other sensitive actions.
        </p>

        {pinSet === true && pinSetAt && (
          <p className="text-xs text-gray-500 mt-1">
            PIN set: {new Date(pinSetAt).toLocaleString()}
          </p>
        )}
      </div>

      {pinError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3">
          <p className="text-xs text-red-200/90">{pinError}</p>
        </div>
      )}

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
          disabled={loading || !phoneVerified || !canShowSet}
          title={
            !phoneVerified
              ? 'Verify phone to set PIN'
              : pinSet === true
              ? 'PIN already set — use Change or Forgot'
              : undefined
          }
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
          disabled={loading || !phoneVerified || !canShowChange}
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
          disabled={loading || !canShowForgot}
        >
          Forgot PIN (OTP)
        </button>
      </div>

      {/* If we know PIN is set, and user is on Set mode, show a helpful note */}
      {pinSet === true && effectiveMode === 'set' && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3">
          <p className="text-xs text-blue-200/90">
            A PIN is already set on this account. Use <b>Change PIN</b> or <b>Forgot PIN</b>.
          </p>
        </div>
      )}

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
            disabled={loading || pinSet === true}
            onClick={handleSetPin}
            className={`w-full py-2 rounded-lg font-semibold transition-colors ${
              loading || pinSet === true
                ? 'bg-gray-700 text-gray-300'
                : 'bg-green-600 hover:bg-blue-500 text-white'
            }`}
          >
            {loading ? 'Saving…' : pinSet === true ? 'PIN Already Set' : 'Save PIN'}
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
