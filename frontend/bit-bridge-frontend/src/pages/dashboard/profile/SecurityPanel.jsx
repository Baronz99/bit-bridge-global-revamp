import { useMemo, useState } from 'react'
import { toast } from 'react-toastify'

import TransactionPinSettings from '../../../components/pin/TransactionPinSettings'
import {
  activateSecurityLock,
  startSecurityLockUnlock,
  verifySecurityLockUnlock,
} from '../../../api/securityLock'
import {
  SECURITY_LOCK_PUBLIC_MESSAGE,
  getSecurityLockPublicNotice,
  getSecurityLockSnapshot,
} from '../../../utils/securityLock'

export default function SecurityPanel({
  userPassword,
  setUserPassword,
  onPasswordUpdate,
  currentEmail = '',
  pendingEmail = '',
  onOpenEmailChange,
  phoneVerified = false,
  onOpenPhoneVerify,
  securityLock = null,
  onRefreshSecurity,
}) {
  const [activatePin, setActivatePin] = useState('')
  const [activateLoading, setActivateLoading] = useState(false)
  const [unlockPassword, setUnlockPassword] = useState('')
  const [unlockOtpCode, setUnlockOtpCode] = useState('')
  const [unlockStarted, setUnlockStarted] = useState(false)
  const [unlockLoading, setUnlockLoading] = useState(false)

  const snapshot = useMemo(() => getSecurityLockSnapshot(securityLock), [securityLock])
  const securityLockActive = snapshot?.active === true || snapshot?.security_locked === true
  const maskedPhone = snapshot?.unlock_contact?.masked_phone || 'your verified phone number'

  const handleOpenVerify = () => {
    if (typeof onOpenPhoneVerify === 'function') onOpenPhoneVerify()
  }

  const refreshSecurity = async () => {
    if (typeof onRefreshSecurity === 'function') {
      await onRefreshSecurity()
    }
  }

  const handleActivate = async () => {
    if (!/^\d{4}$/.test(String(activatePin || '').trim())) {
      toast('Enter your 4-digit transaction PIN to continue.', { type: 'error' })
      return
    }

    try {
      setActivateLoading(true)
      await activateSecurityLock({
        pin: String(activatePin).trim(),
        reason: 'User activated Security Lock',
      })
      setActivatePin('')
      await refreshSecurity()
      toast('Security Lock is active.', { type: 'success' })
    } catch (error) {
      const notice = getSecurityLockPublicNotice(error)
      toast(notice.message, { type: 'error' })
    } finally {
      setActivateLoading(false)
    }
  }

  const handleUnlockStart = async () => {
    if (!unlockPassword.trim()) {
      toast('Enter your current password to continue.', { type: 'error' })
      return
    }

    try {
      setUnlockLoading(true)
      const response = await startSecurityLockUnlock({ current_password: unlockPassword.trim() })
      setUnlockStarted(true)
      toast(response?.message || `Verification code sent to ${maskedPhone}.`, { type: 'success' })
    } catch (error) {
      toast(
        error?.response?.data?.message || error?.message || 'Unable to start unlock right now.',
        { type: 'error' }
      )
    } finally {
      setUnlockLoading(false)
    }
  }

  const handleUnlockVerify = async () => {
    if (!/^\d{6}$/.test(String(unlockOtpCode || '').trim())) {
      toast('Enter the 6-digit verification code sent to your phone.', { type: 'error' })
      return
    }

    try {
      setUnlockLoading(true)
      await verifySecurityLockUnlock({ otp_code: String(unlockOtpCode).trim() })
      setUnlockPassword('')
      setUnlockOtpCode('')
      setUnlockStarted(false)
      await refreshSecurity()
      toast('Security Lock was removed.', { type: 'success' })
    } catch (error) {
      toast(
        error?.response?.data?.message || error?.message || 'Unable to verify the code right now.',
        { type: 'error' }
      )
    } finally {
      setUnlockLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Security</h2>
        <p className="text-sm text-gray-400 mt-1">Manage your password, transaction PIN, and protected account mode.</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Security Lock</h3>
            <p className="text-sm text-slate-300/80 mt-1">
              {securityLockActive
                ? 'Security Lock is active. Outgoing transactions are paused while your account is protected.'
                : 'Pause outgoing activity while keeping balances, receipts, deposits, and account access available.'}
            </p>
          </div>
          <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${securityLockActive ? 'border-amber-400/30 bg-amber-400/10 text-amber-100' : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'}`}>
            {securityLockActive ? 'Active' : 'Ready'}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">What stays available</div>
          <p className="text-sm text-slate-200/85">
            Dashboard, balances, cards in read-only mode, activity, receipts, KYC, deposit account details, and inbound deposits remain available.
          </p>
        </div>

        {securityLockActive ? (
          <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <div>
              <h4 className="text-sm font-semibold text-white">Unlock Security Lock</h4>
              <p className="mt-1 text-sm text-slate-300/80">
                Confirm your current password, then verify the code sent to {maskedPhone}. Outgoing transactions resume after verification.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="block text-sm font-medium text-slate-200/80">Current password</span>
                <input
                  type="password"
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-600/50"
                  placeholder="Enter current password"
                />
              </label>

              <label className="space-y-2">
                <span className="block text-sm font-medium text-slate-200/80">Phone verification code</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={unlockOtpCode}
                  onChange={(e) => setUnlockOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-600/50"
                  placeholder="123456"
                />
              </label>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleUnlockStart}
                disabled={unlockLoading}
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-blue-600/90 text-white font-semibold hover:bg-blue-600 transition disabled:opacity-60"
              >
                {unlockLoading && !unlockStarted ? 'Sending code...' : 'Send verification code'}
              </button>
              <button
                type="button"
                onClick={handleUnlockVerify}
                disabled={unlockLoading || !unlockStarted}
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-white font-semibold hover:bg-white/10 transition disabled:opacity-50"
              >
                {unlockLoading && unlockStarted ? 'Unlocking...' : 'Verify and unlock'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <div>
              <h4 className="text-sm font-semibold text-white">Activate Security Lock</h4>
              <p className="mt-1 text-sm text-slate-300/80">
                Confirm with your transaction PIN to pause outgoing activity immediately on the server.
              </p>
            </div>

            <label className="space-y-2">
              <span className="block text-sm font-medium text-slate-200/80">Transaction PIN</span>
              <input
                type="password"
                inputMode="numeric"
                value={activatePin}
                onChange={(e) => setActivatePin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-amber-500/40"
                placeholder="Enter 4-digit PIN"
              />
            </label>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleActivate}
                disabled={activateLoading}
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-amber-600/90 text-white font-semibold hover:bg-amber-600 transition disabled:opacity-60"
              >
                {activateLoading ? 'Activating...' : 'Activate Security Lock'}
              </button>
              <div className="text-xs text-slate-300/70 sm:self-center">
                While active, outgoing actions return: {SECURITY_LOCK_PUBLIC_MESSAGE}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-white">Email address</h3>
          <p className="text-sm text-slate-300/80 mt-1">
            Change your login email with your current password and an OTP sent to your verified phone.
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Current email</div>
          <div className="mt-2 text-sm font-semibold text-white">{currentEmail || 'Email not available'}</div>
          {pendingEmail ? (
            <div className="mt-2 text-xs text-amber-300">
              Pending confirmation: {pendingEmail}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onOpenEmailChange}
            className={[
              'inline-flex items-center justify-center px-4 py-2 rounded-xl',
              'bg-amber-600/90 text-white font-semibold hover:bg-amber-600 transition',
              'shadow-[0_10px_30px_-12px_rgba(245,158,11,0.45)]',
            ].join(' ')}
          >
            {pendingEmail ? 'Resend email change OTP' : 'Change email'}
          </button>

          <div className="text-xs text-slate-300/70 sm:self-center">
            Login stays on your current email until the new address is confirmed.
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4">
        {phoneVerified ? (
          <TransactionPinSettings />
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-white">Transaction PIN locked</h3>
              <p className="text-sm text-slate-300/80 mt-1">
                To protect your account, you must verify your phone number before setting or changing your Transaction PIN.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleOpenVerify}
                className={[
                  'inline-flex items-center justify-center px-4 py-2 rounded-xl',
                  'bg-blue-600/90 text-white font-semibold hover:bg-blue-600 transition',
                  'shadow-[0_10px_30px_-12px_rgba(37,99,235,0.6)]',
                ].join(' ')}
              >
                Verify phone to continue
              </button>

              <div className="text-xs text-slate-300/70 sm:self-center">
                After verification, reload is automatic.
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-slate-200/80">
                Tip: If you lost access to your PIN, verifying your phone also enables OTP reset.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-white">Change password</h3>
          <p className="text-sm text-slate-300/80 mt-1">Use a strong password you dont reuse.</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-200/80">Current Password</label>
            <input
              type="password"
              value={userPassword.old_password}
              onChange={(e) => setUserPassword({ ...userPassword, old_password: e.target.value })}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-600/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200/80">New Password</label>
            <input
              type="password"
              value={userPassword.password}
              onChange={(e) => setUserPassword({ ...userPassword, password: e.target.value })}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-600/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200/80">
              Confirm New Password
            </label>
            <input
              type="password"
              value={userPassword.confirm_password}
              onChange={(e) =>
                setUserPassword({ ...userPassword, confirm_password: e.target.value })
              }
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-600/50"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onPasswordUpdate}
          className={[
            'mt-2 px-4 py-2 rounded-xl font-semibold transition',
            'bg-emerald-600/90 text-white hover:bg-emerald-600',
            'shadow-[0_10px_30px_-12px_rgba(16,185,129,0.45)]',
          ].join(' ')}
        >
          Update Password
        </button>
      </div>
    </div>
  )
}
