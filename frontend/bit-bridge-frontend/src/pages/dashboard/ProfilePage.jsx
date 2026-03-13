// src/pages/dashboard/ProfilePage.jsx

import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { userDelete, userPasswordUpdate, userProfile } from '../../redux/actions/auth'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { SET_LOADING, setThemeMode } from '../../redux/app'
import AppModal from '../../components/modal/Modal'
import { toast } from 'react-toastify'

import PhoneVerifyModal from '../../components/PhoneVerifyModal'

// Panels
import ProfileInfoPanel from './profile/ProfileInfoPanel'
import KycPanel from './profile/KycPanel'
import SecurityPanel from './profile/SecurityPanel'
import DangerZonePanel from './profile/DangerZonePanel'
import FeesLimitsPanel from './profile/FeesLimitsPanel' // ✅ NEW

// helper from onboarding API
import { updateKycProfile } from '../../api/onboarding'
import { verifyNin } from '../../api/kyc'
import { confirmEmailChange, requestEmailChange } from '../../api/emailChange'

// ID type options
const idTypeOptions = [
  { value: '', label: 'Select ID type' },
  { value: 'nin', label: 'NIN' },
  { value: 'drivers_license', label: "Driver's licence" },
  { value: 'intl_passport', label: 'International passport' },
  { value: 'voters_card', label: "Voter's card" },
]

// Country options (global list for nationality selection)
const countryOptions = [
  { value: '', label: 'Select country' },
  { value: 'Afghanistan', label: 'Afghanistan' },
  { value: 'Albania', label: 'Albania' },
  { value: 'Algeria', label: 'Algeria' },
  { value: 'Andorra', label: 'Andorra' },
  { value: 'Angola', label: 'Angola' },
  { value: 'Antigua and Barbuda', label: 'Antigua and Barbuda' },
  { value: 'Argentina', label: 'Argentina' },
  { value: 'Armenia', label: 'Armenia' },
  { value: 'Australia', label: 'Australia' },
  { value: 'Austria', label: 'Austria' },
  { value: 'Azerbaijan', label: 'Azerbaijan' },
  { value: 'Bahamas', label: 'Bahamas' },
  { value: 'Bahrain', label: 'Bahrain' },
  { value: 'Bangladesh', label: 'Bangladesh' },
  { value: 'Barbados', label: 'Barbados' },
  { value: 'Belarus', label: 'Belarus' },
  { value: 'Belgium', label: 'Belgium' },
  { value: 'Belize', label: 'Belize' },
  { value: 'Benin', label: 'Benin' },
  { value: 'Bhutan', label: 'Bhutan' },
  { value: 'Bolivia', label: 'Bolivia' },
  { value: 'Bosnia and Herzegovina', label: 'Bosnia and Herzegovina' },
  { value: 'Botswana', label: 'Botswana' },
  { value: 'Brazil', label: 'Brazil' },
  { value: 'Brunei', label: 'Brunei' },
  { value: 'Bulgaria', label: 'Bulgaria' },
  { value: 'Burkina Faso', label: 'Burkina Faso' },
  { value: 'Burundi', label: 'Burundi' },
  { value: 'Cabo Verde', label: 'Cabo Verde' },
  { value: 'Cambodia', label: 'Cambodia' },
  { value: 'Cameroon', label: 'Cameroon' },
  { value: 'Canada', label: 'Canada' },
  { value: 'Central African Republic', label: 'Central African Republic' },
  { value: 'Chad', label: 'Chad' },
  { value: 'Chile', label: 'Chile' },
  { value: 'China', label: 'China' },
  { value: 'Colombia', label: 'Colombia' },
  { value: 'Comoros', label: 'Comoros' },
  { value: 'Congo (Brazzaville)', label: 'Congo (Brazzaville)' },
  { value: 'Congo (Kinshasa)', label: 'Congo (Kinshasa)' },
  { value: 'Costa Rica', label: 'Costa Rica' },
  { value: "Cote d'Ivoire", label: "Cote d'Ivoire" },
  { value: 'Croatia', label: 'Croatia' },
  { value: 'Cuba', label: 'Cuba' },
  { value: 'Cyprus', label: 'Cyprus' },
  { value: 'Czechia', label: 'Czechia' },
  { value: 'Denmark', label: 'Denmark' },
  { value: 'Djibouti', label: 'Djibouti' },
  { value: 'Dominica', label: 'Dominica' },
  { value: 'Dominican Republic', label: 'Dominican Republic' },
  { value: 'Ecuador', label: 'Ecuador' },
  { value: 'Egypt', label: 'Egypt' },
  { value: 'El Salvador', label: 'El Salvador' },
  { value: 'Equatorial Guinea', label: 'Equatorial Guinea' },
  { value: 'Eritrea', label: 'Eritrea' },
  { value: 'Estonia', label: 'Estonia' },
  { value: 'Eswatini', label: 'Eswatini' },
  { value: 'Ethiopia', label: 'Ethiopia' },
  { value: 'Fiji', label: 'Fiji' },
  { value: 'Finland', label: 'Finland' },
  { value: 'France', label: 'France' },
  { value: 'Gabon', label: 'Gabon' },
  { value: 'Gambia', label: 'Gambia' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Germany', label: 'Germany' },
  { value: 'Ghana', label: 'Ghana' },
  { value: 'Greece', label: 'Greece' },
  { value: 'Grenada', label: 'Grenada' },
  { value: 'Guatemala', label: 'Guatemala' },
  { value: 'Guinea', label: 'Guinea' },
  { value: 'Guinea-Bissau', label: 'Guinea-Bissau' },
  { value: 'Guyana', label: 'Guyana' },
  { value: 'Haiti', label: 'Haiti' },
  { value: 'Honduras', label: 'Honduras' },
  { value: 'Hungary', label: 'Hungary' },
  { value: 'Iceland', label: 'Iceland' },
  { value: 'India', label: 'India' },
  { value: 'Indonesia', label: 'Indonesia' },
  { value: 'Iran', label: 'Iran' },
  { value: 'Iraq', label: 'Iraq' },
  { value: 'Ireland', label: 'Ireland' },
  { value: 'Israel', label: 'Israel' },
  { value: 'Italy', label: 'Italy' },
  { value: 'Jamaica', label: 'Jamaica' },
  { value: 'Japan', label: 'Japan' },
  { value: 'Jordan', label: 'Jordan' },
  { value: 'Kazakhstan', label: 'Kazakhstan' },
  { value: 'Kenya', label: 'Kenya' },
  { value: 'Kiribati', label: 'Kiribati' },
  { value: 'Kuwait', label: 'Kuwait' },
  { value: 'Kyrgyzstan', label: 'Kyrgyzstan' },
  { value: 'Laos', label: 'Laos' },
  { value: 'Latvia', label: 'Latvia' },
  { value: 'Lebanon', label: 'Lebanon' },
  { value: 'Lesotho', label: 'Lesotho' },
  { value: 'Liberia', label: 'Liberia' },
  { value: 'Libya', label: 'Libya' },
  { value: 'Liechtenstein', label: 'Liechtenstein' },
  { value: 'Lithuania', label: 'Lithuania' },
  { value: 'Luxembourg', label: 'Luxembourg' },
  { value: 'Madagascar', label: 'Madagascar' },
  { value: 'Malawi', label: 'Malawi' },
  { value: 'Malaysia', label: 'Malaysia' },
  { value: 'Maldives', label: 'Maldives' },
  { value: 'Mali', label: 'Mali' },
  { value: 'Malta', label: 'Malta' },
  { value: 'Marshall Islands', label: 'Marshall Islands' },
  { value: 'Mauritania', label: 'Mauritania' },
  { value: 'Mauritius', label: 'Mauritius' },
  { value: 'Mexico', label: 'Mexico' },
  { value: 'Micronesia', label: 'Micronesia' },
  { value: 'Moldova', label: 'Moldova' },
  { value: 'Monaco', label: 'Monaco' },
  { value: 'Mongolia', label: 'Mongolia' },
  { value: 'Montenegro', label: 'Montenegro' },
  { value: 'Morocco', label: 'Morocco' },
  { value: 'Mozambique', label: 'Mozambique' },
  { value: 'Myanmar', label: 'Myanmar' },
  { value: 'Namibia', label: 'Namibia' },
  { value: 'Nauru', label: 'Nauru' },
  { value: 'Nepal', label: 'Nepal' },
  { value: 'Netherlands', label: 'Netherlands' },
  { value: 'New Zealand', label: 'New Zealand' },
  { value: 'Nicaragua', label: 'Nicaragua' },
  { value: 'Niger', label: 'Niger' },
  { value: 'Nigeria', label: 'Nigeria' },
  { value: 'North Korea', label: 'North Korea' },
  { value: 'North Macedonia', label: 'North Macedonia' },
  { value: 'Norway', label: 'Norway' },
  { value: 'Oman', label: 'Oman' },
  { value: 'Pakistan', label: 'Pakistan' },
  { value: 'Palau', label: 'Palau' },
  { value: 'Panama', label: 'Panama' },
  { value: 'Papua New Guinea', label: 'Papua New Guinea' },
  { value: 'Paraguay', label: 'Paraguay' },
  { value: 'Peru', label: 'Peru' },
  { value: 'Philippines', label: 'Philippines' },
  { value: 'Poland', label: 'Poland' },
  { value: 'Portugal', label: 'Portugal' },
  { value: 'Qatar', label: 'Qatar' },
  { value: 'Romania', label: 'Romania' },
  { value: 'Russia', label: 'Russia' },
  { value: 'Rwanda', label: 'Rwanda' },
  { value: 'Saint Kitts and Nevis', label: 'Saint Kitts and Nevis' },
  { value: 'Saint Lucia', label: 'Saint Lucia' },
  { value: 'Saint Vincent and the Grenadines', label: 'Saint Vincent and the Grenadines' },
  { value: 'Samoa', label: 'Samoa' },
  { value: 'San Marino', label: 'San Marino' },
  { value: 'Sao Tome and Principe', label: 'Sao Tome and Principe' },
  { value: 'Saudi Arabia', label: 'Saudi Arabia' },
  { value: 'Senegal', label: 'Senegal' },
  { value: 'Serbia', label: 'Serbia' },
  { value: 'Seychelles', label: 'Seychelles' },
  { value: 'Sierra Leone', label: 'Sierra Leone' },
  { value: 'Singapore', label: 'Singapore' },
  { value: 'Slovakia', label: 'Slovakia' },
  { value: 'Slovenia', label: 'Slovenia' },
  { value: 'Solomon Islands', label: 'Solomon Islands' },
  { value: 'Somalia', label: 'Somalia' },
  { value: 'South Africa', label: 'South Africa' },
  { value: 'South Korea', label: 'South Korea' },
  { value: 'South Sudan', label: 'South Sudan' },
  { value: 'Spain', label: 'Spain' },
  { value: 'Sri Lanka', label: 'Sri Lanka' },
  { value: 'Sudan', label: 'Sudan' },
  { value: 'Suriname', label: 'Suriname' },
  { value: 'Sweden', label: 'Sweden' },
  { value: 'Switzerland', label: 'Switzerland' },
  { value: 'Syria', label: 'Syria' },
  { value: 'Taiwan', label: 'Taiwan' },
  { value: 'Tajikistan', label: 'Tajikistan' },
  { value: 'Tanzania', label: 'Tanzania' },
  { value: 'Thailand', label: 'Thailand' },
  { value: 'Timor-Leste', label: 'Timor-Leste' },
  { value: 'Togo', label: 'Togo' },
  { value: 'Tonga', label: 'Tonga' },
  { value: 'Trinidad and Tobago', label: 'Trinidad and Tobago' },
  { value: 'Tunisia', label: 'Tunisia' },
  { value: 'Turkey', label: 'Turkey' },
  { value: 'Turkmenistan', label: 'Turkmenistan' },
  { value: 'Tuvalu', label: 'Tuvalu' },
  { value: 'Uganda', label: 'Uganda' },
  { value: 'Ukraine', label: 'Ukraine' },
  { value: 'United Arab Emirates', label: 'United Arab Emirates' },
  { value: 'United Kingdom', label: 'United Kingdom' },
  { value: 'United States', label: 'United States' },
  { value: 'Uruguay', label: 'Uruguay' },
  { value: 'Uzbekistan', label: 'Uzbekistan' },
  { value: 'Vanuatu', label: 'Vanuatu' },
  { value: 'Vatican City', label: 'Vatican City' },
  { value: 'Venezuela', label: 'Venezuela' },
  { value: 'Vietnam', label: 'Vietnam' },
  { value: 'Yemen', label: 'Yemen' },
  { value: 'Zambia', label: 'Zambia' },
  { value: 'Zimbabwe', label: 'Zimbabwe' },
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

const VALID_PROFILE_SECTIONS = ['profile', 'kyc', 'security', 'fees', 'danger']

const resolveActiveSection = (value) =>
  VALID_PROFILE_SECTIONS.includes(value) ? value : 'profile'
const ProfileAccountPage = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useSelector((state) => state.auth)
  const { themeMode } = useSelector((state) => state.app || {})

  // Sidebar active section
  const [active, setActive] = useState('profile') // profile | kyc | security | fees | danger ✅

  const [userPassword, setUserPassword] = useState({
    confirm_password: '',
    old_password: '',
    password: '',
  })

  const [open, setOpen] = useState(false)
  const [showPhoneModal, setShowPhoneModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailChangeStep, setEmailChangeStep] = useState('request')
  const [emailChangeLoading, setEmailChangeLoading] = useState(false)
  const [emailChangeInfo, setEmailChangeInfo] = useState('')
  const [emailChangeForm, setEmailChangeForm] = useState({
    new_email: '',
    current_password: '',
    phone_otp_code: '',
  })

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
      id_document_url: '',
      proof_of_address_url: '',
    },
  })
  const [nin, setNin] = useState('')

  const [idDocumentFile, setIdDocumentFile] = useState(null)
  const [proofOfAddressFile, setProofOfAddressFile] = useState(null)

  const up = user?.user_profile || {}

  const phoneVerified =
    user?.phone_verified === true ||
    !!user?.phone_verified_at ||
    !!up?.phone_verified_at

  useEffect(() => {
    const nextSection = resolveActiveSection(searchParams.get('section'))
    setActive((current) => (current === nextSection ? current : nextSection))
  }, [searchParams])

  const openSection = (section) => {
    const nextSection = resolveActiveSection(section)
    setActive(nextSection)
    setSearchParams({ section: nextSection })
  }

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
        id_document_url: up.id_document_url || '',
        proof_of_address_url: up.proof_of_address_url || '',
      },
    })

    setNin('')
    setIdDocumentFile(null)
    setProofOfAddressFile(null)
    setPendingPhone('')
    setEmailChangeForm({
      new_email: '',
      current_password: '',
      phone_otp_code: '',
    })
    setEmailChangeInfo('')
    setEmailChangeStep('request')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const headerSubtitle = useMemo(() => {
    if (active === 'profile') return 'Basic information and contact details'
    if (active === 'kyc') return 'Identity and address verification'
    if (active === 'security') return 'Password and transaction PIN'
    if (active === 'fees') return 'Transparent fees, limits and pricing' // ✅ NEW
    if (active === 'danger') return 'Account deletion and irreversible actions'
    return ''
  }, [active])

  const themeOptions = [
    { id: 'dark', label: 'Top style' },
    { id: 'light', label: 'Light' },
    { id: 'shadow', label: 'Shadow' },
  ]

  const handleThemeChange = (mode) => {
    dispatch(setThemeMode(mode))
  }

  const handleUserUpdate = async () => {
    try {
      if (active === 'kyc') {
      }
      dispatch(SET_LOADING(true))

      const formData = new FormData()

      const isKycSave = active === 'kyc'
      const submittedNin = String(nin || '').replace(/\D/g, '')
      const shouldVerifyNin = isKycSave && userInfo.id_type === 'nin' && submittedNin.length === 11

      if (isKycSave || userInfo.id_type) {
        formData.append('user[id_type]', userInfo.id_type || '')
      }

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

      if (shouldVerifyNin) {
        try {
          const ninRes = await verifyNin(submittedNin)
          const ninPayload = ninRes?.data || {}
          const displayTitle = String(ninPayload?.display?.title || '').trim()
          const displayMessage = String(ninPayload?.display?.message || '').trim()
          const fallbackMessage =
            ninPayload?.message ||
            (ninPayload?.status === 'verified'
              ? 'NIN verified successfully.'
              : ninPayload?.status === 'mismatch'
              ? 'NIN details do not match your profile records.'
              : 'NIN verification submitted.')

          toast(
            displayTitle && displayMessage ? `${displayTitle}: ${displayMessage}` : displayMessage || fallbackMessage,
            { type: ninPayload?.status === 'verified' ? 'success' : 'info' }
          )
        } catch (ninErr) {
          const ninPayload = ninErr?.response?.data || {}
          const ninMessage =
            ninPayload?.display?.message || ninPayload?.message || ninPayload?.error || 'NIN verification failed.'
          toast(ninMessage, { type: 'error' })
        }
      }

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
          id_document_url: up2.id_document_url || '',
          proof_of_address_url: up2.proof_of_address_url || '',
        },
      }))

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

  const openEmailChangeModal = () => {
    setEmailChangeInfo('')
    setEmailChangeStep('request')
    setEmailChangeForm({
      new_email: '',
      current_password: '',
      phone_otp_code: '',
    })
    setShowEmailModal(true)
  }

  const closeEmailChangeModal = () => {
    if (emailChangeLoading) return
    setShowEmailModal(false)
    setEmailChangeInfo('')
    setEmailChangeStep('request')
    setEmailChangeForm({
      new_email: '',
      current_password: '',
      phone_otp_code: '',
    })
  }

  const handleEmailOtpRequest = async () => {
    setEmailChangeLoading(true)
    setEmailChangeInfo('')
    try {
      const response = await requestEmailChange({
        new_email: emailChangeForm.new_email,
        current_password: emailChangeForm.current_password,
      })
      setEmailChangeStep('confirm')
      setEmailChangeInfo(
        response?.message || 'Verification code sent to your verified phone number.'
      )
      toast(response?.message || 'Verification code sent to your phone.', { type: 'success' })
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        'Unable to send verification code.'
      setEmailChangeInfo(message)
      toast(message, { type: 'error' })
    } finally {
      setEmailChangeLoading(false)
    }
  }

  const handleEmailChangeConfirm = async () => {
    setEmailChangeLoading(true)
    setEmailChangeInfo('')
    try {
      const response = await confirmEmailChange({
        new_email: emailChangeForm.new_email,
        current_password: emailChangeForm.current_password,
        phone_otp_code: emailChangeForm.phone_otp_code,
      })
      const nextUser = await dispatch(userProfile()).unwrap()
      setUserInfo((prev) => ({
        ...prev,
        email: nextUser?.email || prev.email,
      }))
      if (emailChangeForm.new_email) {
        const nextEmail = emailChangeForm.new_email.trim().toLowerCase()
        localStorage.setItem('email', nextEmail)
        localStorage.setItem('confirmation_flow', 'email-change')
      }
      toast(response?.message || 'Email change initiated. Check your new inbox.', { type: 'success' })
      closeEmailChangeModal()
      navigate('/check-email?flow=email-change')
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        'Unable to confirm email change.'
      setEmailChangeInfo(message)
      toast(message, { type: 'error' })
    } finally {
      setEmailChangeLoading(false)
    }
  }

  const NavButton = ({ id, title, desc }) => {
    const isActive = active === id
    return (
      <button
        type="button"
        onClick={() => openSection(id)}
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
      <div className="bb-profile-shell min-h-screen bg-[#070A12]">
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

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="bb-panel rounded-2xl border border-white/10 bg-white/5 backdrop-blur px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-300/70 mb-2">
                  Theme
                </div>
                <div className="flex items-center gap-2">
                  {themeOptions.map((option) => {
                    const isActive = themeMode === option.id
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handleThemeChange(option.id)}
                        className={[
                          'px-3 py-1.5 rounded-full text-xs font-semibold transition',
                          isActive
                            ? 'bg-blue-500/90 text-white shadow'
                            : 'bg-white/10 text-slate-200 hover:bg-white/20',
                        ].join(' ')}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
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
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <aside className="lg:col-span-4">
              <div className="sticky top-6 space-y-3">
                <div className="bb-panel rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4">
                  <div className="text-sm font-semibold text-white">Settings</div>
                  <div className="text-xs text-slate-300/70 mt-1">
                    Manage your profile, verification, security and account status.
                  </div>
                </div>

                <NavButton id="profile" title="Personal info" desc="Name, phone number, date of birth" />
                <NavButton id="kyc" title="KYC & Documents" desc="ID type, address, uploads" />
                <NavButton id="security" title="Security" desc="Password and transaction PIN" />

                {/* ✅ NEW */}
                <NavButton id="fees" title="Fees & Limits" desc="Pricing, transfer fees, card limits" />

                <NavButton id="danger" title="Danger zone" desc="Delete your account" />
              </div>
            </aside>

            <main className="lg:col-span-8">
              <div className="bb-panel rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 md:p-6">
                {active === 'profile' && (
                  <ProfileInfoPanel
                    userInfo={userInfo}
                    setUserInfo={setUserInfo}
                    phoneVerified={phoneVerified}
                    countryOptions={countryOptions}
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
                    currentEmail={user?.email || userInfo.email}
                    pendingEmail={user?.unconfirmed_email || ''}
                    onOpenEmailChange={openEmailChangeModal}
                    phoneVerified={phoneVerified}
                    onOpenPhoneVerify={() => {
                      setPendingPhone(String(userInfo?.user_profile?.phone_number || '').trim())
                      setShowPhoneModal(true)
                    }}
                  />
                )}

                {/* ✅ NEW */}
                {active === 'fees' && <FeesLimitsPanel />}

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

      <AppModal isModalOpen={showEmailModal} handleCancel={closeEmailChangeModal}>
        <div className="rounded-2xl shadow-lg p-6 max-w-lg mx-auto text-white">
          <h2 className="text-xl font-semibold mb-2">Change email</h2>
          <p className="text-sm text-slate-300 mb-5">
            Secure this change with your current password and an OTP sent to your verified phone.
            Your login email will only switch after you confirm the link in the new inbox.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-200/80">New email</label>
              <input
                type="email"
                value={emailChangeForm.new_email}
                onChange={(e) =>
                  setEmailChangeForm((prev) => ({ ...prev, new_email: e.target.value }))
                }
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-amber-500/40"
                placeholder="new-email@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200/80">Current password</label>
              <input
                type="password"
                value={emailChangeForm.current_password}
                onChange={(e) =>
                  setEmailChangeForm((prev) => ({ ...prev, current_password: e.target.value }))
                }
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-amber-500/40"
                placeholder="Enter current password"
              />
            </div>

            {emailChangeStep === 'confirm' ? (
              <div>
                <label className="block text-sm font-medium text-slate-200/80">
                  Phone verification code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={emailChangeForm.phone_otp_code}
                  onChange={(e) =>
                    setEmailChangeForm((prev) => ({
                      ...prev,
                      phone_otp_code: e.target.value.replace(/\D/g, '').slice(0, 6),
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-amber-500/40"
                  placeholder="Enter 6-digit OTP"
                />
              </div>
            ) : null}

            {emailChangeInfo ? (
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-200">
                {emailChangeInfo}
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-end">
            <button
              type="button"
              onClick={closeEmailChangeModal}
              className="px-4 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white transition"
            >
              Cancel
            </button>
            {emailChangeStep === 'confirm' ? (
              <button
                type="button"
                disabled={emailChangeLoading}
                onClick={handleEmailChangeConfirm}
                className="px-4 py-2 rounded-xl bg-amber-600 text-white hover:bg-amber-700 transition disabled:opacity-60"
              >
                {emailChangeLoading ? 'Confirming...' : 'Confirm email change'}
              </button>
            ) : (
              <button
                type="button"
                disabled={emailChangeLoading}
                onClick={handleEmailOtpRequest}
                className="px-4 py-2 rounded-xl bg-amber-600 text-white hover:bg-amber-700 transition disabled:opacity-60"
              >
                {emailChangeLoading ? 'Sending code...' : 'Send phone OTP'}
              </button>
            )}
          </div>
        </div>
      </AppModal>
    </>
  )
}

export default ProfileAccountPage








