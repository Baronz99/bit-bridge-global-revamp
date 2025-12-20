// src/pages/dashboard/profile/ProfileInfoPanel.jsx

export default function ProfileInfoPanel({
  userInfo,
  setUserInfo,
  phoneVerified,
  onOpenPhoneVerify,
}) {
  const handlePhoneChange = (e) => {
    // If already verified, phone cannot be edited from profile form.
    // Phone changes must go through OTP modal (which can enforce password/pin).
    if (phoneVerified) return

    setUserInfo({
      ...userInfo,
      user_profile: { ...userInfo.user_profile, phone_number: e.target.value },
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Personal info</h2>
        <p className="text-sm text-slate-300/80 mt-1">
          Update your details used across the app.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* First name */}
        <div>
          <label className="block text-sm font-medium text-slate-200">First Name</label>
          <input
            value={userInfo.user_profile.first_name}
            onChange={(e) =>
              setUserInfo({
                ...userInfo,
                user_profile: { ...userInfo.user_profile, first_name: e.target.value },
              })
            }
            type="text"
            className={[
              'mt-1 w-full rounded-xl border border-white/10 bg-white/10',
              'px-3 py-2 text-white placeholder:text-slate-400/80',
              'outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/40',
            ].join(' ')}
          />
        </div>

        {/* Last name */}
        <div>
          <label className="block text-sm font-medium text-slate-200">Last Name</label>
          <input
            value={userInfo.user_profile.last_name}
            onChange={(e) =>
              setUserInfo({
                ...userInfo,
                user_profile: { ...userInfo.user_profile, last_name: e.target.value },
              })
            }
            type="text"
            className={[
              'mt-1 w-full rounded-xl border border-white/10 bg-white/10',
              'px-3 py-2 text-white placeholder:text-slate-400/80',
              'outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/40',
            ].join(' ')}
          />
        </div>

        {/* Phone */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-200">Phone Number</label>

          <input
            value={userInfo.user_profile.phone_number}
            onChange={handlePhoneChange}
            type="text"
            disabled={phoneVerified}
            className={[
              'mt-1 w-full rounded-xl border border-white/10',
              phoneVerified ? 'bg-white/5 text-slate-300/70' : 'bg-white/10 text-white',
              'px-3 py-2 placeholder:text-slate-400/80',
              'outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/40',
            ].join(' ')}
            placeholder="e.g. 090..., 234..., +234..."
          />

          <div className="mt-2 flex items-center gap-2">
            {phoneVerified ? (
              <>
                <span className="inline-flex items-center gap-2 text-sm font-medium text-emerald-300">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                  Phone verified
                </span>

                <button
                  type="button"
                  onClick={onOpenPhoneVerify}
                  className={[
                    'inline-flex items-center px-3 py-1.5 rounded-xl',
                    'border border-amber-500/40 bg-amber-500/10 text-amber-200',
                    'text-sm font-semibold hover:bg-amber-500/15 transition',
                  ].join(' ')}
                >
                  Change phone
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onOpenPhoneVerify}
                className={[
                  'inline-flex items-center px-3 py-1.5 rounded-xl',
                  'border border-blue-500/40 bg-blue-500/10 text-blue-200',
                  'text-sm font-semibold hover:bg-blue-500/15 transition',
                ].join(' ')}
              >
                Verify phone number
              </button>
            )}
          </div>

          {phoneVerified ? (
            <p className="mt-2 text-xs text-slate-300/70">
              To change a verified phone number, use{' '}
              <span className="text-white font-semibold">Change phone</span>.
            </p>
          ) : null}
        </div>

        {/* DOB */}
        <div>
          <label className="block text-sm font-medium text-slate-200">Date of birth</label>
          <input
            type="date"
            value={userInfo.user_profile.date_of_birth || ''}
            onChange={(e) =>
              setUserInfo({
                ...userInfo,
                user_profile: { ...userInfo.user_profile, date_of_birth: e.target.value },
              })
            }
            className={[
              'mt-1 w-full rounded-xl border border-white/10 bg-white/10',
              'px-3 py-2 text-white',
              'outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/40',
            ].join(' ')}
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-slate-200">Email</label>
          <input
            value={userInfo.email}
            disabled
            type="email"
            className={[
              'mt-1 w-full rounded-xl border border-white/10 bg-white/5',
              'px-3 py-2 text-slate-300/70 outline-none',
            ].join(' ')}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs text-slate-300/80">
          Tip: Click <span className="text-white font-semibold">Save changes</span> on the top
          right after editing.
        </p>
      </div>
    </div>
  )
}
