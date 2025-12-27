// src/pages/dashboard/ProfilePage.jsx

import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { userDelete, userPasswordUpdate, userProfile } from '../../redux/actions/auth'
import { useNavigate } from 'react-router-dom'
import { SET_LOADING } from '../../redux/app'
import AppModal from '../../components/modal/Modal'
import { toast } from 'react-toastify'

import PhoneVerifyModal from '../../components/PhoneVerifyModal'

// Panels
import ProfileInfoPanel from './profile/ProfileInfoPanel'
import KycPanel from './profile/KycPanel'
import SecurityPanel from './profile/SecurityPanel'
import DangerZonePanel from './profile/DangerZonePanel'

// helper from onboarding API
import { updateKycProfile } from '../../api/onboarding'

// ID type options
const idTypeOptions = [
  { value: '', label: 'Select ID type' },
  { value: 'nin', label: 'NIN' },
  { value: 'drivers_license', label: "Driver's licence" },
  { value: 'intl_passport', label: 'International passport' },
  { value: 'voters_card', label: "Voter's card" },
]

// Simple country options (extend later)
const countryOptions = [
  { value: '', label: 'Select country' },
  { value: 'Nigeria', label: 'Nigeria' },
]

// ✅ Nigeria states (36) + FCT + Other
const stateOptions = [
  { value: '', label: 'Select state' },
  { value: 'Abia', label: 'Abia' },
  { value: 'Adamawa', label: 'Adamawa' },
  { value: 'Akwa Ibom', label: 'Akwa Ibom' },
  { value: 'Anambra', label: 'Anambra' },
  { value: 'Bauchi', label: 'Bauchi' },
  { value: 'Bayelsa', label: 'Bayelsa' },
  { value: 'Benue', label: 'Benue' },
  { value: 'Borno', label: 'Borno' },
  { value: 'Cross River', label: 'Cross River' },
  { value: 'Delta', label: 'Delta' },
  { value: 'Ebonyi', label: 'Ebonyi' },
  { value: 'Edo', label: 'Edo' },
  { value: 'Ekiti', label: 'Ekiti' },
  { value: 'Enugu', label: 'Enugu' },
  { value: 'FCT', label: 'FCT (Abuja)' },
  { value: 'Gombe', label: 'Gombe' },
  { value: 'Imo', label: 'Imo' },
  { value: 'Jigawa', label: 'Jigawa' },
  { value: 'Kaduna', label: 'Kaduna' },
  { value: 'Kano', label: 'Kano' },
  { value: 'Katsina', label: 'Katsina' },
  { value: 'Kebbi', label: 'Kebbi' },
  { value: 'Kogi', label: 'Kogi' },
  { value: 'Kwara', label: 'Kwara' },
  { value: 'Lagos', label: 'Lagos' },
  { value: 'Nasarawa', label: 'Nasarawa' },
  { value: 'Niger', label: 'Niger' },
  { value: 'Ogun', label: 'Ogun' },
  { value: 'Ondo', label: 'Ondo' },
  { value: 'Osun', label: 'Osun' },
  { value: 'Oyo', label: 'Oyo' },
  { value: 'Plateau', label: 'Plateau' },
  { value: 'Rivers', label: 'Rivers' },
  { value: 'Sokoto', label: 'Sokoto' },
  { value: 'Taraba', label: 'Taraba' },
  { value: 'Yobe', label: 'Yobe' },
  { value: 'Zamfara', label: 'Zamfara' },
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

  // Sidebar active section
  const [active, setActive] = useState('profile') // profile | kyc | security | danger

  const [userPassword, setUserPassword] = useState({
    confirm_password: '',
    old_password: '',
    password: '',
  })

  const [open, setOpen] = useState(false)
  const [showPhoneModal, setShowPhoneModal] = useState(false)

  // When user clicks "Verify", we seed the modal with whatever is in the input
  const [pendingPhone, setPendingPhone] = useState('')

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

  const [bvn, setBvn] = useState('')
  const [nin, setNin] = useState('')

  const [idDocumentFile, setIdDocumentFile] = useState(null)
  const [proofOfAddressFile, setProofOfAddressFile] = useState(null)

  const up = user?.user_profile || {}

  const phoneVerified =
    user?.phone_verified === true ||
    !!user?.phone_verified_at ||
    !!up?.phone_verified_at

  // IMPORTANT:
  // Never push phone_e164 into the editable input.
  // Editable input must always remain "phone_number" (local format).
  const editablePhoneNumber = up?.phone_number || ''

  useEffect(() => {
    if (!user) return

    setUserInfo({
      email: user.email || '',
      id_type: user.id_type || '',
      user_profile: {
        first_name: up.first_name || '',
        last_name: up.last_name || '',
        phone_number: editablePhoneNumber,
        date_of_birth: up.date_of_birth ? String(up.date_of_birth).slice(0, 10) : '',
        address_line1: up.address_line1 || '',
        address_line2: up.address_line2 || '',
        city: up.city || '',
        state: up.state || '',
        country: up.country || '',
        postal_code: up.postal_code || '',
        proof_of_address_type: up.proof_of_address_type || '',
        bvn_status: up.bvn_status || '',
        bvn_rejection_reason: up.bvn_rejection_reason || '',
        bvn_verified_at: up.bvn_verified_at || '',
      },
    })

    setBvn(up.bvn || '')
    setNin('')
    setIdDocumentFile(null)
    setProofOfAddressFile(null)
    setPendingPhone('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const headerSubtitle = useMemo(() => {
    if (active === 'profile') return 'Basic information and contact details'
    if (active === 'kyc') return 'Identity and address verification'
    if (active === 'security') return 'Password and transaction PIN'
    if (active === 'danger') return 'Account deletion and irreversible actions'
    return ''
  }, [active])

  const handleUserUpdate = async () => {
    try {
      if (active === 'kyc') {
        if (!bvn || String(bvn).length !== 11) {
          toast('BVN is required for Tier 1 verification.', { type: 'error' })
          return
        }
      }
      dispatch(SET_LOADING(true))

      const formData = new FormData()

      formData.append('user[id_type]', userInfo.id_type || '')
      formData.append('user[user_profile_attributes][bvn]', bvn || '')

      formData.append('user[user_profile_attributes][first_name]', userInfo.user_profile.first_name || '')
      formData.append('user[user_profile_attributes][last_name]', userInfo.user_profile.last_name || '')
      formData.append('user[user_profile_attributes][phone_number]', userInfo.user_profile.phone_number || '')
      formData.append('user[user_profile_attributes][date_of_birth]', userInfo.user_profile.date_of_birth || '')
      formData.append('user[user_profile_attributes][address_line1]', userInfo.user_profile.address_line1 || '')
      formData.append('user[user_profile_attributes][address_line2]', userInfo.user_profile.address_line2 || '')
      formData.append('user[user_profile_attributes][city]', userInfo.user_profile.city || '')
      formData.append('user[user_profile_attributes][state]', userInfo.user_profile.state || '')
      formData.append('user[user_profile_attributes][country]', userInfo.user_profile.country || '')
      formData.append('user[user_profile_attributes][postal_code]', userInfo.user_profile.postal_code || '')
      formData.append(
        'user[user_profile_attributes][proof_of_address_type]',
        userInfo.user_profile.proof_of_address_type || ''
      )

      if (idDocumentFile) formData.append('user[id_document]', idDocumentFile)
      if (proofOfAddressFile) formData.append('user[proof_of_address]', proofOfAddressFile)

      await updateKycProfile(formData, true)

      // ✅ Refresh Redux user and immediately sync local form state from server
      const refreshedAction = await dispatch(userProfile())
      const newUser = refreshedAction.payload
      const up2 = newUser?.user_profile || {}

      setUserInfo((prev) => ({
        ...prev,
        email: newUser?.email || prev.email,
        id_type: newUser?.id_type || prev.id_type,
        user_profile: {
          ...prev.user_profile,
          first_name: up2.first_name || '',
          last_name: up2.last_name || '',
          // ✅ keep input as phone_number, NOT phone_e164
          phone_number: up2.phone_number || '',
          date_of_birth: up2.date_of_birth ? String(up2.date_of_birth).slice(0, 10) : '',
          address_line1: up2.address_line1 || '',
          address_line2: up2.address_line2 || '',
          city: up2.city || '',
          state: up2.state || '',
          country: up2.country || '',
          postal_code: up2.postal_code || '',
          proof_of_address_type: up2.proof_of_address_type || '',
          bvn_status: up2.bvn_status || '',
          bvn_rejection_reason: up2.bvn_rejection_reason || '',
          bvn_verified_at: up2.bvn_verified_at || '',
        },
      }))

      setBvn(up2.bvn || '')
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

  const NavButton = ({ id, title, desc }) => {
    const isActive = active === id
    return (
      <button
        type="button"
        onClick={() => setActive(id)}
        className={[
          'relative w-full text-left rounded-2xl border px-4 py-3 transition',
          'backdrop-blur',
          isActive
            ? 'bg-white/10 text-white border-white/15 ring-1 ring-blue-500/30 shadow'
            : 'bg-white/5 text-slate-100 border-white/10 hover:bg-white/8',
        ].join(' ')}
      >
        <span
          className={[
            'absolute left-0 top-3 bottom-3 w-1 rounded-r',
            isActive ? 'bg-blue-400/80' : 'bg-transparent',
          ].join(' ')}
        />
        <div className="font-semibold">{title}</div>
        <div className="text-xs text-slate-300/70 mt-1">{desc}</div>
      </button>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-[#070A12]">
        <div className="pointer-events-none fixed inset-0">
          <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-blue-500/15 blur-3xl" />
          <div className="absolute top-40 -right-24 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 md:px-6 py-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Account Settings</h1>
              <p className="text-sm text-slate-300/80 mt-1">{headerSubtitle}</p>
            </div>

            <button
              type="button"
              onClick={handleUserUpdate}
              className={[
                'inline-flex items-center justify-center px-4 py-2 rounded-xl',
                'bg-blue-600/90 text-white font-semibold hover:bg-blue-600 transition',
                'shadow-[0_10px_30px_-12px_rgba(37,99,235,0.6)]',
              ].join(' ')}
            >
              Save changes
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <aside className="lg:col-span-4">
              <div className="sticky top-6 space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4">
                  <div className="text-sm font-semibold text-white">Settings</div>
                  <div className="text-xs text-slate-300/70 mt-1">
                    Manage your profile, verification, security and account status.
                  </div>
                </div>

                <NavButton id="profile" title="Personal info" desc="Name, phone number, date of birth" />
                <NavButton id="kyc" title="KYC & Documents" desc="ID type, address, uploads" />
                <NavButton id="security" title="Security" desc="Password and transaction PIN" />
                <NavButton id="danger" title="Danger zone" desc="Delete your account" />
              </div>
            </aside>

            <main className="lg:col-span-8">
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 md:p-6">
                {active === 'profile' && (
                  <ProfileInfoPanel
                    userInfo={userInfo}
                    setUserInfo={setUserInfo}
                    phoneVerified={phoneVerified}
                    onOpenPhoneVerify={() => {
                      setPendingPhone(String(userInfo?.user_profile?.phone_number || '').trim())
                      setShowPhoneModal(true)
                    }}
                  />
                )}

                {active === 'kyc' && (
                  <KycPanel
                    userInfo={userInfo}
                    setUserInfo={setUserInfo}
                    bvn={bvn}
                    setBvn={setBvn}
                    nin={nin}
                    setNin={setNin}
                    idDocumentFile={idDocumentFile}
                    setIdDocumentFile={setIdDocumentFile}
                    proofOfAddressFile={proofOfAddressFile}
                    setProofOfAddressFile={setProofOfAddressFile}
                    idTypeOptions={idTypeOptions}
                    kycLevel={user?.kyc_level}
                    stateOptions={stateOptions}
                    countryOptions={countryOptions}
                    proofOfAddressOptions={proofOfAddressOptions}
                  />
                )}

                {active === 'security' && (
                  <SecurityPanel
                    userPassword={userPassword}
                    setUserPassword={setUserPassword}
                    onPasswordUpdate={handlePasswordUpdate}
                    phoneVerified={phoneVerified}
                    onOpenPhoneVerify={() => {
                      setPendingPhone(String(userInfo?.user_profile?.phone_number || '').trim())
                      setShowPhoneModal(true)
                    }}
                  />
                )}

                {active === 'danger' && <DangerZonePanel onOpenDelete={() => setOpen(true)} />}
              </div>
            </main>
          </div>
        </div>
      </div>

      <AppModal isModalOpen={open} handleCancel={() => setOpen(false)}>
        <div className="rounded-2xl shadow-lg p-6 max-w-md mx-auto text-center">
          <h2 className="text-xl font-semibold text-red-500 mb-4">Delete Account</h2>
          <p className="text-slate-200 mb-6">
            Are you sure you want to delete your account? This action cannot be undone.
          </p>
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUserDelete}
              className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 transition"
            >
              Yes, Delete
            </button>
          </div>
        </div>
      </AppModal>

      <PhoneVerifyModal
        open={showPhoneModal}
        onClose={async () => {
          setShowPhoneModal(false)
          setPendingPhone('')
          await dispatch(userProfile())
        }}
        // ✅ Seed with whatever user is trying to verify (fallback to profile phone)
        defaultPhone={pendingPhone || up?.phone_number || userInfo?.user_profile?.phone_number || ''}
      />
    </>
  )
}

export default ProfileAccountPage

