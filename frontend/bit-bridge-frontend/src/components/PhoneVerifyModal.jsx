// src/components/PhoneVerifyModal.jsx

import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { toast } from 'react-toastify'
import { sendPhoneOtp, confirmPhoneOtp } from '../redux/actions/phoneVerification'
import { resetPhoneVerification } from '../redux/phoneVerification'

const fmt = (s) => {
  const v = Math.max(0, Number.isFinite(s) ? s : 0)
  const m = Math.floor(v / 60)
  const r = v % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

/**
 * onClose can be called as:
 *  - onClose()
 *  - onClose({ refreshed: true, status: "verified" | "already_verified" })
 */
const PhoneVerifyModal = ({ open, onClose, defaultPhone }) => {
  const dispatch = useDispatch()

  const {
    sending,
    verifying,
    sent,
    error,
    reason,
    expiresAt,
    expiresInSeconds,
    requiresPassword,
  } = useSelector((s) => s.phoneVerification || {})

  const [phone, setPhone] = useState(defaultPhone || '')
  const [code, setCode] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')

  // Monnify-style countdown uses OTP expiry
  const [expireLeft, setExpireLeft] = useState(null)

  const showFallback = useMemo(() => reason === 'sms_provider_unavailable', [reason])

  // Reset modal state when opening/closing
  useEffect(() => {
    if (!open) {
      dispatch(resetPhoneVerification())
      setCode('')
      setPhone(defaultPhone || '')
      setCurrentPassword('')
      setExpireLeft(null)
      return
    }

    // when modal opens, hydrate phone
    setPhone(defaultPhone || '')
    setCode('')
    setCurrentPassword('')
    setExpireLeft(null)
  }, [open, defaultPhone, dispatch])

  // Start expiry countdown when OTP is sent
  useEffect(() => {
    if (!open) return
    if (!sent) return

    if (typeof expiresInSeconds === 'number') {
      setExpireLeft(Math.max(0, expiresInSeconds))
      return
    }

    if (expiresAt) {
      const s = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
      setExpireLeft(s)
    }
  }, [open, sent, expiresAt, expiresInSeconds])

  // Tick down once per second
  useEffect(() => {
    if (!open) return
    const id = setInterval(() => {
      setExpireLeft((v) => (typeof v === 'number' ? Math.max(0, v - 1) : v))
    }, 1000)
    return () => clearInterval(id)
  }, [open])

  if (!open) return null

  const closeAndRefresh = (status) => {
    // Let parent refresh Redux userProfile() (your Settings page already does this)
    onClose?.({ refreshed: true, status })
  }

  const handleSend = async () => {
    const res = await dispatch(
      sendPhoneOtp({
        phone_number: phone,
        current_password: currentPassword || undefined,
      })
    )

    if (res.meta?.requestStatus !== 'fulfilled') return

    const status = res.payload?.status

    // ✅ Backend short-circuit: no OTP needed, phone restored as verified
    if (status === 'already_verified') {
      toast('Phone already verified ✅', { type: 'success' })
      closeAndRefresh('already_verified')
      return
    }

    if (status === 'sent') {
      toast('OTP sent', { type: 'success' })
    }
  }

  const handleVerify = async () => {
    const res = await dispatch(confirmPhoneOtp({ phone_number: phone, code }))

    if (res.meta?.requestStatus !== 'fulfilled') return

    const status = res.payload?.status

    // ✅ Both should flip UI after refresh
    if (status === 'verified') {
      toast('Phone verified ✅', { type: 'success' })
      closeAndRefresh('verified')
      return
    }

    if (status === 'already_verified') {
      toast('Phone already verified ✅', { type: 'success' })
      closeAndRefresh('already_verified')
      return
    }

    // If backend returns something unexpected but fulfilled, still close safely
    closeAndRefresh(status || 'ok')
  }

  const otpExpired = sent && typeof expireLeft === 'number' && expireLeft === 0
  const resendLocked = sent && typeof expireLeft === 'number' && expireLeft > 0

  const sendBtnLabel = !sent
    ? 'Send code'
    : resendLocked
      ? `OTP expires in ${fmt(expireLeft)}`
      : 'OTP expired — Resend OTP'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-5 text-slate-100">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Phone verification
            </p>
            <h3 className="text-lg font-semibold">Verify your phone number</h3>
          </div>
          <button
            onClick={() => onClose?.()}
            className="text-slate-400 hover:text-slate-200"
            type="button"
          >
            ✕
          </button>
        </div>

        {showFallback ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="font-semibold text-amber-200">
              Phone verification is temporarily unavailable.
            </p>
            <p className="text-xs text-amber-100/80 mt-1">Please try again later.</p>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded-xl border border-slate-700 text-xs"
                onClick={handleSend}
                disabled={sending}
              >
                Try again
              </button>
            </div>
          </div>
        ) : (
          <>
            <label className="block text-xs text-slate-400 mb-1">Phone number</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="090..., 234..., +234..."
              className="w-full rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm outline-none focus:border-alt"
            />

            {requiresPassword ? (
              <div className="mt-3">
                <label className="block text-xs text-slate-400 mb-1">
                  Current password (required to change a verified phone)
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm outline-none focus:border-alt"
                />
              </div>
            ) : null}

            <div className="mt-3">
              <button
                type="button"
                onClick={handleSend}
                disabled={
                  sending ||
                  !phone ||
                  (requiresPassword && !currentPassword) ||
                  (sent && resendLocked) // locked only while OTP is still valid
                }
                className="w-full rounded-xl bg-alt text-black px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                {sending ? 'Sending…' : sendBtnLabel}
              </button>

              <p className="mt-2 text-[11px] text-slate-500">
                We’ll send an OTP via SMS (DND supported).
              </p>

              {sent && typeof expireLeft === 'number' && !otpExpired ? (
                <p className="mt-1 text-[11px] text-slate-400">
                  OTP expires in{' '}
                  <span className="text-slate-200 font-semibold">{fmt(expireLeft)}</span>
                </p>
              ) : null}

              {otpExpired ? (
                <p className="mt-1 text-[11px] text-amber-200/90">
                  OTP expired — you can resend now.
                </p>
              ) : null}
            </div>

            {sent ? (
              <div className="mt-4">
                <label className="block text-xs text-slate-400 mb-1">Enter OTP</label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm outline-none focus:border-alt"
                />

                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={verifying || code.length !== 6 || otpExpired}
                  className="mt-3 w-full rounded-xl border border-alt text-alt px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
                >
                  {verifying ? 'Verifying…' : 'Verify phone'}
                </button>
              </div>
            ) : null}

            {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
          </>
        )}
      </div>
    </div>
  )
}

export default PhoneVerifyModal
