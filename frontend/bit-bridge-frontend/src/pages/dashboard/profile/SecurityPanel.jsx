// src/pages/dashboard/profile/SecurityPanel.jsx

import TransactionPinSettings from '../../../components/pin/TransactionPinSettings'

export default function SecurityPanel({
  userPassword,
  setUserPassword,
  onPasswordUpdate,
  currentEmail = '',
  pendingEmail = '',
  onOpenEmailChange,

  // ✅ these props come from ProfilePage
  phoneVerified = false,
  onOpenPhoneVerify,
}) {
  const handleOpenVerify = () => {
    if (typeof onOpenPhoneVerify === 'function') onOpenPhoneVerify()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Security</h2>
        <p className="text-sm text-gray-400 mt-1">Manage your password and transaction PIN.</p>
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

      {/* Transaction PIN */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4">
        {phoneVerified ? (
          <TransactionPinSettings />
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-white">Transaction PIN locked</h3>
              <p className="text-sm text-slate-300/80 mt-1">
                To protect your account, you must verify your phone number before setting or
                changing your Transaction PIN.
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

      {/* Change Password */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-white">Change password</h3>
          <p className="text-sm text-slate-300/80 mt-1">Use a strong password you don’t reuse.</p>
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
