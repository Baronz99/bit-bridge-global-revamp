// src/pages/dashboard/profile/KycPanel.jsx

import { useId, useMemo } from 'react'

function FilePicker({
  label,
  helper,
  accept,
  file,
  onPick,
  onClear,
  className = '',
}) {
  const inputId = useId()

  return (
    <div className={['space-y-2', className].join(' ')}>
      <label className="block text-sm font-medium text-gray-300">{label}</label>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Hidden input */}
        <input
          id={inputId}
          type="file"
          accept={accept}
          onChange={(e) => onPick(e.target.files?.[0] || null)}
          className="hidden"
        />

        {/* Pick button */}
        <label
          htmlFor={inputId}
          className={[
            'inline-flex items-center justify-center',
            'px-4 py-2 rounded-xl border',
            'border-gray-800 bg-gray-900/60 text-gray-100',
            'hover:bg-gray-900/80 transition cursor-pointer',
            'text-sm font-semibold',
          ].join(' ')}
        >
          Choose file
        </label>

        {/* File status */}
        <div className="flex-1">
          {file ? (
            <div className="flex items-center gap-2">
              <span
                className={[
                  'inline-flex items-center gap-2',
                  'rounded-xl border border-gray-800 bg-gray-950/50',
                  'px-3 py-2 text-sm text-gray-200',
                  'truncate max-w-full',
                ].join(' ')}
                title={file.name}
              >
                <span className="h-2 w-2 rounded-full bg-green-500" />
                <span className="truncate">{file.name}</span>
              </span>

              <button
                type="button"
                onClick={onClear}
                className="px-3 py-2 rounded-xl border border-gray-800 bg-transparent text-gray-200 hover:bg-gray-900/40 text-sm font-semibold"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="text-sm text-gray-500">No file selected</div>
          )}

          {helper && <p className="text-xs text-gray-500 mt-1">{helper}</p>}
        </div>
      </div>
    </div>
  )
}

export default function KycPanel({
  userInfo,
  setUserInfo,

  nin,
  setNin,

  idDocumentFile,
  setIdDocumentFile,
  proofOfAddressFile,
  setProofOfAddressFile,

  idTypeOptions,
  kycLevel,
  stateOptions,
  countryOptions,
  proofOfAddressOptions,
}) {
  const shouldShowIdUpload = useMemo(() => {
    return (
      userInfo.id_type === 'drivers_license' ||
      userInfo.id_type === 'intl_passport' ||
      userInfo.id_type === 'voters_card'
    )
  }, [userInfo.id_type])
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">KYC & Documents</h2>
        <p className="text-sm text-gray-400 mt-1">
          Provide identity and address details for Tier 2 verification.
        </p>
      </div>

      {/* ID Type + NIN */}
      <div className="rounded-2xl border border-gray-800 bg-gray-950/40 p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300">ID Type</label>
          <select
            value={userInfo.id_type || ''}
            onChange={(e) => {
              const newType = e.target.value
              setUserInfo({ ...userInfo, id_type: newType })
              if (newType !== 'nin') setNin('')

              // optional safety: clear uploaded ID doc if switching away
              if (
                newType !== 'drivers_license' &&
                newType !== 'intl_passport' &&
                newType !== 'voters_card'
              ) {
                setIdDocumentFile(null)
              }
            }}
            className="mt-1 w-full md:w-1/2 rounded-xl border border-gray-800 bg-gray-900/60 px-3 py-2 text-gray-100 outline-none"
          >
            {idTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {userInfo.id_type === 'nin' && (
          <div className="md:w-1/2">
            <label className="block text-sm font-medium text-gray-300">NIN</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={11}
              value={nin}
              onChange={(e) => setNin(e.target.value.replace(/\D/g, '').slice(0, 11))}
              className="mt-1 w-full rounded-xl border border-gray-800 bg-gray-900/60 px-3 py-2 text-gray-100 outline-none"
              placeholder="11-digit NIN"
            />
            <p className="text-xs text-gray-500 mt-1">Used only for verification.</p>
          </div>
        )}

        {shouldShowIdUpload && (
          <FilePicker
            label="Upload ID document"
            helper="Accepted: image or PDF."
            accept="image/*,application/pdf"
            file={idDocumentFile}
            onPick={setIdDocumentFile}
            onClear={() => setIdDocumentFile(null)}
            className="md:w-2/3"
          />
        )}
      </div>

      {/* Address */}
      <div className="rounded-2xl border border-gray-800 bg-gray-950/40 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-200">Address</h3>
          <span className="text-xs text-gray-500">Keep this accurate</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300">Address line 1</label>
            <input
              value={userInfo.user_profile.address_line1}
              onChange={(e) =>
                setUserInfo({
                  ...userInfo,
                  user_profile: { ...userInfo.user_profile, address_line1: e.target.value },
                })
              }
              type="text"
              className="mt-1 w-full rounded-xl border border-gray-800 bg-gray-900/60 px-3 py-2 text-gray-100 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">
              Address line 2 (optional)
            </label>
            <input
              value={userInfo.user_profile.address_line2}
              onChange={(e) =>
                setUserInfo({
                  ...userInfo,
                  user_profile: { ...userInfo.user_profile, address_line2: e.target.value },
                })
              }
              type="text"
              className="mt-1 w-full rounded-xl border border-gray-800 bg-gray-900/60 px-3 py-2 text-gray-100 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">City</label>
            <input
              value={userInfo.user_profile.city}
              onChange={(e) =>
                setUserInfo({
                  ...userInfo,
                  user_profile: { ...userInfo.user_profile, city: e.target.value },
                })
              }
              type="text"
              className="mt-1 w-full rounded-xl border border-gray-800 bg-gray-900/60 px-3 py-2 text-gray-100 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">State</label>
            <select
              value={userInfo.user_profile.state || ''}
              onChange={(e) =>
                setUserInfo({
                  ...userInfo,
                  user_profile: { ...userInfo.user_profile, state: e.target.value },
                })
              }
              className="mt-1 w-full rounded-xl border border-gray-800 bg-gray-900/60 px-3 py-2 text-gray-100 outline-none"
            >
              {stateOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">Country</label>
            <select
              value={userInfo.user_profile.country || ''}
              onChange={(e) =>
                setUserInfo({
                  ...userInfo,
                  user_profile: { ...userInfo.user_profile, country: e.target.value },
                })
              }
              className="mt-1 w-full rounded-xl border border-gray-800 bg-gray-900/60 px-3 py-2 text-gray-100 outline-none"
            >
              {countryOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">Postal code</label>
            <input
              value={userInfo.user_profile.postal_code}
              onChange={(e) =>
                setUserInfo({
                  ...userInfo,
                  user_profile: { ...userInfo.user_profile, postal_code: e.target.value },
                })
              }
              type="text"
              className="mt-1 w-full rounded-xl border border-gray-800 bg-gray-900/60 px-3 py-2 text-gray-100 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">Proof of address type</label>
            <select
              value={userInfo.user_profile.proof_of_address_type || ''}
              onChange={(e) =>
                setUserInfo({
                  ...userInfo,
                  user_profile: {
                    ...userInfo.user_profile,
                    proof_of_address_type: e.target.value,
                  },
                })
              }
              className="mt-1 w-full rounded-xl border border-gray-800 bg-gray-900/60 px-3 py-2 text-gray-100 outline-none"
            >
              {proofOfAddressOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <FilePicker
              label="Upload proof of address"
              helper="Accepted: utility bill, bank statement, rent receipt (image or PDF)."
              accept="image/*,application/pdf"
              file={proofOfAddressFile}
              onPick={setProofOfAddressFile}
              onClear={() => setProofOfAddressFile(null)}
              className="md:w-2/3"
            />
          </div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-3">
          <p className="text-xs text-gray-400">
            Tip: Click <span className="text-gray-200 font-semibold">Save changes</span> when you’re
            done.
          </p>
        </div>
      </div>
    </div>
  )
}
