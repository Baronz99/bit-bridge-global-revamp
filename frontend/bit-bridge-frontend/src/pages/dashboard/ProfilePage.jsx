// src/pages/dashboard/ProfilePage.jsx

import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { userDelete, userPasswordUpdate, userProfile } from '../../redux/actions/auth'
import { useNavigate } from 'react-router-dom'
import { SET_LOADING } from '../../redux/app'
import AppModal from '../../components/modal/Modal'
import { toast } from 'react-toastify'

// helper from onboarding API
import { updateBasicProfile } from '../../api/onboarding'

// ID type options
const idTypeOptions = [
  { value: '', label: 'Select ID type' },
  { value: 'bvn', label: 'BVN' },
  { value: 'nin', label: 'NIN' },
  { value: 'drivers_license', label: "Driver's licence" },
  { value: 'intl_passport', label: 'International passport' },
]

// Simple country/state options (can extend later)
const countryOptions = [
  { value: '', label: 'Select country' },
  { value: 'Nigeria', label: 'Nigeria' },
]

const stateOptions = [
  { value: '', label: 'Select state' },
  { value: 'FCT', label: 'FCT' },
  { value: 'Lagos', label: 'Lagos' },
  { value: 'Rivers', label: 'Rivers' },
  { value: 'Kano', label: 'Kano' },
  { value: 'Other', label: 'Other' },
]

// Proof of address options
const proofOfAddressOptions = [
  { value: '', label: 'Select proof type' },
  { value: 'utility_bill', label: 'Utility bill' },
  { value: 'bank_statement', label: 'Bank statement' },
  { value: 'rent_receipt', label: 'Rent receipt' },
  { value: 'other', label: 'Other' },
]

const ProfileAccountPage = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { user } = useSelector((state) => state.auth)

  const [userPassword, setUserPassword] = useState({
    confirm_password: '',
    old_password: '',
    password: '',
  })

  const [open, setOpen] = useState(false)

  // main profile state
  const [userInfo, setUserInfo] = useState({
    email: '',
    id_type: '',
    user_profile: {
      first_name: '',
      last_name: '',
      phone_number: '',
      date_of_birth: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      country: '',
      postal_code: '',
      proof_of_address_type: '',
    },
  })

  // local-only inputs for conditional BVN / NIN (not stored yet)
  const [bvn, setBvn] = useState('')
  const [nin, setNin] = useState('')

  // NEW: local file state for uploads
  const [idDocumentFile, setIdDocumentFile] = useState(null)
  const [proofOfAddressFile, setProofOfAddressFile] = useState(null)

  // hydrate local state from Redux user (including address)
  useEffect(() => {
    if (user) {
      const up = user.user_profile || {}
      setUserInfo({
        email: user.email || '',
        id_type: user.id_type || '',
        user_profile: {
          first_name: up.first_name || '',
          last_name: up.last_name || '',
          phone_number: up.phone_number || '',
          // 🔹 Normalise DOB to "YYYY-MM-DD" for <input type="date">
          date_of_birth: up.date_of_birth
            ? String(up.date_of_birth).slice(0, 10)
            : '',
          address_line1: up.address_line1 || '',
          address_line2: up.address_line2 || '',
          city: up.city || '',
          state: up.state || '',
          country: up.country || '',
          postal_code: up.postal_code || '',
          proof_of_address_type: up.proof_of_address_type || '',
        },
      })
      // reset BVN/NIN when user changes, so they don't show stale values
      setBvn('')
      setNin('')
      setIdDocumentFile(null)
      setProofOfAddressFile(null)
    }
  }, [user])

  const handleUserUpdate = async () => {
    try {
      dispatch(SET_LOADING(true))

      // Build FormData so we can send files + nested attributes
      const formData = new FormData()

      formData.append('user[id_type]', userInfo.id_type || '')

      formData.append('user[user_profile_attributes][first_name]', userInfo.user_profile.first_name || '')
      formData.append('user[user_profile_attributes][last_name]', userInfo.user_profile.last_name || '')
      formData.append('user[user_profile_attributes][phone_number]', userInfo.user_profile.phone_number || '')
      formData.append(
        'user[user_profile_attributes][date_of_birth]',
        userInfo.user_profile.date_of_birth || ''
      )
      formData.append(
        'user[user_profile_attributes][address_line1]',
        userInfo.user_profile.address_line1 || ''
      )
      formData.append(
        'user[user_profile_attributes][address_line2]',
        userInfo.user_profile.address_line2 || ''
      )
      formData.append('user[user_profile_attributes][city]', userInfo.user_profile.city || '')
      formData.append('user[user_profile_attributes][state]', userInfo.user_profile.state || '')
      formData.append('user[user_profile_attributes][country]', userInfo.user_profile.country || '')
      formData.append(
        'user[user_profile_attributes][postal_code]',
        userInfo.user_profile.postal_code || ''
      )
      formData.append(
        'user[user_profile_attributes][proof_of_address_type]',
        userInfo.user_profile.proof_of_address_type || ''
      )

      // Attach files only if selected
      if (idDocumentFile) {
        formData.append('user[id_document]', idDocumentFile)
      }

      if (proofOfAddressFile) {
        formData.append('user[proof_of_address]', proofOfAddressFile)
      }

      await updateBasicProfile(formData, true)

      // Refresh Redux user so profile + KYC centre see fresh data
      await dispatch(userProfile())

      toast('Profile updated', { type: 'success' })
    } catch (error) {
      console.error('Error updating profile/basic KYC:', error)
      const backendMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        'Failed to update profile'
      toast(backendMessage, { type: 'error' })
    } finally {
      dispatch(SET_LOADING(false))
    }
  }

  const handlePasswordUpdate = () => {
    if (userPassword.password !== userPassword.confirm_password) {
      toast('password mismatch', { type: 'error' })
      return
    }
    dispatch(SET_LOADING(true))

    dispatch(
      userPasswordUpdate({
        id: user.id,
        data: {
          user: {
            ...userPassword,
          },
        },
      })
    ).then((result) => {
      if (userPasswordUpdate.fulfilled.match(result)) {
        dispatch(SET_LOADING(false))
        toast('password updated', { type: 'success' })
      } else {
        dispatch(SET_LOADING(false))
      }
    })
  }

  const handleUserDelete = () => {
    dispatch(SET_LOADING(true))
    dispatch(userDelete(user.id)).then((result) => {
      if (userDelete.fulfilled.match(result)) {
        toast(result.payload.message, { type: 'success' })
        navigate('/signup')
        dispatch(SET_LOADING(false))
      } else {
        dispatch(SET_LOADING(false))
        toast(result.payload.message, { type: 'error' })
      }
    })
  }

  return (
    <>
      <div className="max-w-5xl mx-auto p-6 space-y-10">
        <h1 className="text-3xl font-bold mb-4 text-white">Account Settings</h1>

        {/* Profile + Light KYC */}
        <div className="bg-white shadow-md rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-semibold mb-4">Personal Info & ID</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Names & phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700">First Name</label>
              <input
                value={userInfo.user_profile.first_name}
                onChange={(e) =>
                  setUserInfo({
                    ...userInfo,
                    user_profile: {
                      ...userInfo.user_profile,
                      first_name: e.target.value,
                    },
                  })
                }
                type="text"
                className="mt-1 block w-full rounded-md border border-gray-300 p-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Last Name</label>
              <input
                value={userInfo.user_profile.last_name}
                onChange={(e) =>
                  setUserInfo({
                    ...userInfo,
                    user_profile: {
                      ...userInfo.user_profile,
                      last_name: e.target.value,
                    },
                  })
                }
                type="text"
                className="mt-1 block w-full rounded-md border border-gray-300 p-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Phone Number</label>
              <input
                value={userInfo.user_profile.phone_number}
                onChange={(e) =>
                  setUserInfo({
                    ...userInfo,
                    user_profile: {
                      ...userInfo.user_profile,
                      phone_number: e.target.value,
                    },
                  })
                }
                type="text"
                className="mt-1 block w-full rounded-md border border-gray-300 p-2"
              />
            </div>

            {/* Date of birth */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Date of birth</label>
              <input
                type="date"
                value={userInfo.user_profile.date_of_birth || ''}
                onChange={(e) =>
                  setUserInfo({
                    ...userInfo,
                    user_profile: {
                      ...userInfo.user_profile,
                      date_of_birth: e.target.value,
                    },
                  })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 p-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                value={userInfo.email}
                disabled
                type="email"
                className="mt-1 block w-full rounded-md border bg-gray-200 border-gray-300 p-2"
              />
            </div>

            {/* ID TYPE SELECT */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">ID Type</label>
              <select
                value={userInfo.id_type || ''}
                onChange={(e) => {
                  const newType = e.target.value
                  setUserInfo({
                    ...userInfo,
                    id_type: newType,
                  })
                  // reset local BVN/NIN when switching type
                  if (newType !== 'bvn') setBvn('')
                  if (newType !== 'nin') setNin('')
                }}
                className="mt-1 block w-full md:w-1/2 rounded-md border border-gray-300 p-2 bg-white"
              >
                {idTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                We’ll use this to match your details with our banking partners.
              </p>

              {/* Conditional BVN input */}
              {userInfo.id_type === 'bvn' && (
                <div className="mt-3 md:w-1/2">
                  <label className="block text-sm font-medium text-gray-700">BVN</label>
                  <input
                    type="text"
                    maxLength={11}
                    value={bvn}
                    onChange={(e) =>
                      setBvn(
                        e.target.value
                          .replace(/\D/g, '')
                          .slice(0, 11)
                      )
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2"
                    placeholder="11-digit BVN (used only for verification)"
                  />
                </div>
              )}

              {/* Conditional NIN input */}
              {userInfo.id_type === 'nin' && (
                <div className="mt-3 md:w-1/2">
                  <label className="block text-sm font-medium text-gray-700">NIN</label>
                  <input
                    type="text"
                    maxLength={11}
                    value={nin}
                    onChange={(e) =>
                      setNin(
                        e.target.value
                          .replace(/\D/g, '')
                          .slice(0, 11)
                      )
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2"
                    placeholder="NIN (used only for verification)"
                  />
                </div>
              )}
            </div>

            {/* Upload ID – now active when appropriate */}
            {(userInfo.id_type === 'drivers_license' ||
              userInfo.id_type === 'intl_passport') && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Upload ID document
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setIdDocumentFile(e.target.files?.[0] || null)}
                  className="mt-1 block w-full md:w-1/2 rounded-md border border-gray-300 p-2 bg-white"
                />
                <p className="mt-1 text-xs text-gray-500">
                  You can upload a clear photo or PDF of your ID. If you upload again, it will
                  replace the previous file.
                </p>
              </div>
            )}

            {/* ADDRESS BLOCK */}
            <div className="md:col-span-2 mt-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Address</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Address line 1
                  </label>
                  <input
                    value={userInfo.user_profile.address_line1}
                    onChange={(e) =>
                      setUserInfo({
                        ...userInfo,
                        user_profile: {
                          ...userInfo.user_profile,
                          address_line1: e.target.value,
                        },
                      })
                    }
                    type="text"
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2"
                    placeholder="Street / house number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Address line 2 (optional)
                  </label>
                  <input
                    value={userInfo.user_profile.address_line2}
                    onChange={(e) =>
                      setUserInfo({
                        ...userInfo,
                        user_profile: {
                          ...userInfo.user_profile,
                          address_line2: e.target.value,
                        },
                      })
                    }
                    type="text"
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2"
                    placeholder="Apartment, estate, etc."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">City</label>
                  <input
                    value={userInfo.user_profile.city}
                    onChange={(e) =>
                      setUserInfo({
                        ...userInfo,
                        user_profile: {
                          ...userInfo.user_profile,
                          city: e.target.value,
                        },
                      })
                    }
                    type="text"
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">State</label>
                  <select
                    value={userInfo.user_profile.state || ''}
                    onChange={(e) =>
                      setUserInfo({
                        ...userInfo,
                        user_profile: {
                          ...userInfo.user_profile,
                          state: e.target.value,
                        },
                      })
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 bg-white"
                  >
                    {stateOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Country</label>
                  <select
                    value={userInfo.user_profile.country || ''}
                    onChange={(e) =>
                      setUserInfo({
                        ...userInfo,
                        user_profile: {
                          ...userInfo.user_profile,
                          country: e.target.value,
                        },
                      })
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 bg-white"
                  >
                    {countryOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Postal code</label>
                  <input
                    value={userInfo.user_profile.postal_code}
                    onChange={(e) =>
                      setUserInfo({
                        ...userInfo,
                        user_profile: {
                          ...userInfo.user_profile,
                          postal_code: e.target.value,
                        },
                      })
                    }
                    type="text"
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Proof of address type
                  </label>
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
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 bg-white"
                  >
                    {proofOfAddressOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* NEW: Proof of address upload */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Upload proof of address
                  </label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setProofOfAddressFile(e.target.files?.[0] || null)}
                    className="mt-1 block w-full md:w-1/2 rounded-md border border-gray-300 p-2 bg-white"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Example: utility bill, bank statement, or rent receipt showing your address.
                    Optional, but helps unlock higher KYC tiers later.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleUserUpdate}
            className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Save profile & ID
          </button>
        </div>

        {/* Change Password */}
        <div className="bg-white shadow-md rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-semibold mb-2">Change Password</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Current Password</label>
              <input
                type="password"
                value={userPassword.old_password}
                onChange={(e) =>
                  setUserPassword({ ...userPassword, old_password: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">New Password</label>
              <input
                type="password"
                value={userPassword.password}
                onChange={(e) =>
                  setUserPassword({ ...userPassword, password: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Confirm New Password
              </label>
              <input
                type="password"
                value={userPassword.confirm_password}
                onChange={(e) =>
                  setUserPassword({ ...userPassword, confirm_password: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 p-2"
              />
            </div>
          </div>
          <button
            onClick={handlePasswordUpdate}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Update Password
          </button>
        </div>

        {/* Delete Account */}
        <div className="bg-white shadow-md rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-red-600 mb-4">Delete Account</h2>
          <p className="text-sm text-gray-600 mb-4">
            Once you delete your account, there is no going back. Please be certain.
          </p>
          <button
            onClick={() => setOpen((prev) => !prev)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Delete My Account
          </button>
        </div>
      </div>

      <AppModal isModalOpen={open} handleCancel={() => setOpen(false)}>
        <div className=" rounded-2xl shadow-lg p-6 max-w-md mx-auto text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-4">Delete Account</h2>
          <p className="text-gray-100 mb-6">
            Are you sure you want to delete your account? This action cannot be undone.
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-2 rounded-xl border border-gray-300 hover:bg-gray-500 text-gray-100 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleUserDelete}
              className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 transition"
            >
              Yes, Delete
            </button>
          </div>
        </div>
      </AppModal>
    </>
  )
}

export default ProfileAccountPage
