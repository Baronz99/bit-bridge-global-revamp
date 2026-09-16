import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useSelector } from 'react-redux'
import BusinessSetupShell from '../../components/business/BusinessSetupShell'
import useSelectedBusiness from '../../hooks/useSelectedBusiness'
import useBusinessOnboardingPresentation from '../../hooks/useBusinessOnboardingPresentation'
import BusinessWorkspaceRequired from '../../components/business/BusinessWorkspaceRequired'
import { getBusinessOnboarding, updateBusinessOnboarding } from '../../api/business'

const cardClass =
  'rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.22)]'

const emptySignatory = {
  full_name: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  title: '',
  date_of_birth: '',
  nationality: 'NG',
  address_line_1: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'NG',
  bvn: '',
  identification_type: '',
  id_document_number: '',
  ownership_percentage: '',
  authorized_signatory: true,
  director: true,
}

const emptyFormData = {
  name: '',
  legal_name: '',
  business_type: '',
  registration_number: '',
  business_bvn: '',
  date_of_registration: '',
  category: '',
  anchor_industry: '',
  website: '',
  tax_identifier: '',
  business_description: '',
  address_line_1: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'NG',
  registered_address_line_1: '',
  registered_city: '',
  registered_state: '',
  registered_postal_code: '',
  registered_country: 'NG',
  contact_email: '',
  contact_phone: '',
}

const fallbackBusinessTypeOptions = [
  { value: 'limited_company', label: 'Limited company' },
  { value: 'business_name', label: 'Business name' },
  { value: 'sole_proprietorship', label: 'Sole proprietorship' },
  { value: 'incorporated_trustees', label: 'Incorporated trustees' },
  { value: 'cooperative', label: 'Cooperative' },
  { value: 'public_incorporated', label: 'Public incorporated' },
  { value: 'government', label: 'Government' },
  { value: 'private_incorporated_gov', label: 'Private incorporated government entity' },
  { value: 'free_zone', label: 'Free zone entity' },
]

const fallbackBusinessCategoryOptions = [
  { value: 'Technology-SoftwareDevelopment', label: 'Technology - Software development' },
  { value: 'Technology-Fintech', label: 'Technology - Fintech' },
  { value: 'Retail-Ecommerce', label: 'Retail - Ecommerce' },
  { value: 'Retail-GeneralCommerce', label: 'Retail - General commerce' },
  { value: 'ProfessionalServices-Consulting', label: 'Professional services - Consulting' },
  { value: 'ProfessionalServices-Legal', label: 'Professional services - Legal' },
  { value: 'Manufacturing-General', label: 'Manufacturing - General' },
  { value: 'Logistics-Transportation', label: 'Logistics - Transportation' },
  { value: 'Construction-RealEstate', label: 'Construction / Real estate' },
  { value: 'Healthcare-MedicalServices', label: 'Healthcare - Medical services' },
  { value: 'Education-Training', label: 'Education - Training' },
  { value: 'Hospitality-FoodAndBeverage', label: 'Hospitality - Food and beverage' },
  { value: 'Agriculture-Agribusiness', label: 'Agriculture - Agribusiness' },
  { value: 'Energy-Utilities', label: 'Energy / Utilities' },
  { value: 'Media-Entertainment', label: 'Media / Entertainment' },
  { value: 'NonProfit-NGO', label: 'Non-profit / NGO' },
]

const fallbackCountryOptions = [
  { value: 'NG', label: 'Nigeria' },
  { value: 'GH', label: 'Ghana' },
  { value: 'KE', label: 'Kenya' },
  { value: 'ZA', label: 'South Africa' },
  { value: 'UG', label: 'Uganda' },
  { value: 'RW', label: 'Rwanda' },
  { value: 'AE', label: 'United Arab Emirates' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
]

const countryNameToCode = Object.fromEntries(
  fallbackCountryOptions.flatMap((option) => [
    [option.value.toLowerCase(), option.value],
    [option.label.toLowerCase(), option.value],
  ])
)

const fallbackNigeriaStateOptions = [
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
]

const nigeriaStateValueMap = Object.fromEntries(
  fallbackNigeriaStateOptions.flatMap((option) => [
    [option.value.toLowerCase(), option.value],
    [option.label.toLowerCase(), option.value],
  ])
)

const fallbackSignatoryTitleOptions = [
  { value: '', label: 'Select title' },
  { value: 'CEO', label: 'CEO' },
  { value: 'COO', label: 'COO' },
  { value: 'CFO', label: 'CFO' },
  { value: 'Founder', label: 'Founder' },
  { value: 'Managing Director', label: 'Managing Director' },
  { value: 'Director', label: 'Director' },
  { value: 'Company Secretary', label: 'Company Secretary' },
  { value: 'Authorised Representative', label: 'Authorised Representative' },
]

const fallbackIdentificationTypeOptions = [
  { value: 'DRIVERS_LICENSE', label: 'Drivers License' },
  { value: 'VOTERS_CARD', label: 'Voters Card' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'NATIONAL_ID', label: 'National Id' },
  { value: 'NIN_SLIP', label: 'NIN Slip' },
]

const companyFields = [
  ['legal_name', 'Legal business name'],
  ['date_of_registration', 'Date of registration'],
]

const contactFields = [
  ['contact_email', 'Contact email'],
  ['contact_phone', 'Contact phone'],
  ['address_line_1', 'Operating address line 1'],
  ['city', 'City'],
  ['state', 'State'],
  ['postal_code', 'Postal code'],
  ['country', 'Country'],
  ['registered_address_line_1', 'Registered address line 1'],
  ['registered_city', 'Registered city'],
  ['registered_state', 'Registered state'],
  ['registered_postal_code', 'Registered postal code'],
  ['registered_country', 'Registered country'],
]

const PROFILE_STEP_SEQUENCE = ['business', 'contact', 'signatory']

const PROFILE_STEP_COPY = {
  business: {
    title: 'Business details',
    description: 'Enter the registered details for your business.',
    primaryLabel: 'Continue',
  },
  contact: {
    title: 'Contact and address',
    description: 'Add the contact and address details for this business.',
    primaryLabel: 'Continue',
  },
  signatory: {
    title: 'Authorised signatory',
    description: 'Add the person authorised to verify and manage this business account.',
    primaryLabel: 'Continue to review',
  },
}

const PRIVATE_INCORPORATED_TYPES = new Set(['limited_company', 'private_incorporated', 'Private_Incorporated'])

const signatoryFieldOrder = [
  ['full_name', 'Full name', true],
  ['first_name', 'First name', false],
  ['middle_name', 'Middle name', false],
  ['last_name', 'Last name', false],
  ['email', 'Email', true],
  ['phone', 'Phone', true],
  ['title', 'Title', true],
  ['date_of_birth', 'Date of birth', true],
  ['nationality', 'Nationality', true],
  ['address_line_1', 'Address line 1', true],
  ['address_line_2', 'Address line 2', false],
  ['city', 'City', true],
  ['state', 'State', true],
  ['postal_code', 'Postal code', true],
  ['country', 'Country', true],
  ['bvn', 'BVN', true],
  ['identification_type', 'Identification type', true],
  ['id_document_number', 'ID document number', true],
]

const CUSTOMER_STATUS_LABELS = {
  draft: 'In progress',
  pending: 'In progress',
  submitted: 'Ready for review',
  under_review: 'In review',
  approved: 'Ready for activation',
  active: 'Account ready',
}

const formatLabel = (value) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())

const BLOCKING_GROUPS = [
  {
    key: 'business',
    title: 'Business details',
    fields: ['name', 'legal_name', 'business_type', 'registration_number', 'business_bvn', 'date_of_registration', 'category', 'anchor_industry', 'business_description'],
  },
  {
    key: 'address',
    title: 'Address',
    fields: [
      'address_line_1',
      'city',
      'state',
      'country',
      'registered_address_line_1',
      'registered_city',
      'registered_state',
      'registered_country',
    ],
  },
  {
    key: 'contact',
    title: 'Contact',
    fields: ['contact_email', 'contact_phone'],
  },
  {
    key: 'signatory',
    title: 'Signatory',
    fields: [
      'signatories',
      'signatory',
      'authorized_signatory',
      'full_name',
      'first_name',
      'middle_name',
      'last_name',
      'email',
      'phone',
      'title',
      'date_of_birth',
      'nationality',
      'address_line_1',
      'address_line_2',
      'city',
      'state',
      'postal_code',
      'country',
      'bvn',
      'identification_type',
      'id_document_number',
    ],
  },
]

const AUTOSAVE_DELAY_MS = 2500

const formatCustomerStatus = (value) => {
  const normalized = String(value || '').toLowerCase()
  return CUSTOMER_STATUS_LABELS[normalized] || 'In progress'
}

const normalizeCountryCode = (value) => {
  const normalized = String(value || '').trim()
  if (!normalized) return ''
  return countryNameToCode[normalized.toLowerCase()] || normalized.toUpperCase()
}

const normalizeStateValue = (countryCode, value) => {
  const normalized = String(value || '').trim()
  if (!normalized) return ''
  if (normalizeCountryCode(countryCode) !== 'NG') return normalized
  return nigeriaStateValueMap[normalized.toLowerCase()] || normalized
}

const REGISTRATION_NUMBER_CONFIG = {
  limited_company: {
    label: 'RC / incorporation number',
    helper: 'Enter the incorporation number exactly as it appears on your CAC certificate. This is usually an RC number.',
    validationMessage: 'Enter the official CAC incorporation number, usually in a format like RC123456.',
    isValid: (value) => /^((RC)[\s/-]*)?\d{4,}$/i.test(value),
  },
  public_incorporated: {
    label: 'RC / incorporation number',
    helper: 'Enter the incorporation number exactly as it appears on your CAC certificate. This is usually an RC number.',
    validationMessage: 'Enter the official CAC incorporation number, usually in a format like RC123456.',
    isValid: (value) => /^((RC)[\s/-]*)?\d{4,}$/i.test(value),
  },
  private_incorporated_gov: {
    label: 'RC / incorporation number',
    helper: 'Enter the incorporation number exactly as it appears on the registration document for this entity.',
    validationMessage: 'Enter the official incorporation number exactly as issued for this entity.',
    isValid: (value) => /^((RC)[\s/-]*)?\d{4,}$/i.test(value),
  },
  business_name: {
    label: 'Business name registration number',
    helper: 'Enter the registration number exactly as it appears on your business name certificate.',
    validationMessage: 'Enter the official business name registration number exactly as issued.',
    isValid: (value) => /^[A-Z0-9/-]{4,}$/i.test(value),
  },
  sole_proprietorship: {
    label: 'Business name registration number',
    helper: 'Enter the registration number exactly as it appears on your business name certificate.',
    validationMessage: 'Enter the official business name registration number exactly as issued.',
    isValid: (value) => /^[A-Z0-9/-]{4,}$/i.test(value),
  },
  incorporated_trustees: {
    label: 'Incorporation / trustees registration number',
    helper: 'Enter the registration number exactly as it appears on the incorporation documents.',
    validationMessage: 'Enter the official trustees registration number exactly as issued.',
    isValid: (value) => /^[A-Z0-9/-]{4,}$/i.test(value),
  },
  cooperative: {
    label: 'Cooperative registration number',
    helper: 'Enter the cooperative registration number exactly as it appears on the registration documents.',
    validationMessage: 'Enter the official cooperative registration number exactly as issued.',
    isValid: (value) => /^[A-Z0-9/-]{4,}$/i.test(value),
  },
  government: {
    label: 'Government registration reference',
    helper: 'Enter the official registration or reference number exactly as issued for this entity.',
    validationMessage: 'Enter the official registration or reference number exactly as issued.',
    isValid: (value) => /^[A-Z0-9/-]{4,}$/i.test(value),
  },
  free_zone: {
    label: 'Registration number',
    helper: 'Enter the official registration number exactly as issued for the free zone entity.',
    validationMessage: 'Enter the official registration number exactly as issued.',
    isValid: (value) => /^[A-Z0-9/-]{4,}$/i.test(value),
  },
}

const getRegistrationNumberConfig = (businessType) =>
  REGISTRATION_NUMBER_CONFIG[businessType] || {
    label: 'Registration / CAC number',
    helper: 'Enter the official business registration number exactly as it appears on your registration documents.',
    validationMessage: 'Enter the official registration number exactly as issued.',
    isValid: (value) => /^[A-Z0-9/-]{4,}$/i.test(value),
  }

const sanitizePhoneInput = (value, maxLength = 16) => {
  const raw = String(value || '')
  const hasPlusPrefix = raw.trim().startsWith('+')
  const digits = raw.replace(/\D/g, '')
  const limited = digits.slice(0, hasPlusPrefix ? Math.max(0, maxLength - 1) : maxLength)
  return `${hasPlusPrefix ? '+' : ''}${limited}`
}

const sanitizeBvnInput = (value, maxLength = 11) => String(value || '').replace(/\D/g, '').slice(0, maxLength)

const buildSignatoryFullName = (item) =>
  [item?.first_name, item?.middle_name, item?.last_name]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ')

const withEmptyOption = (options, emptyLabel) => {
  const normalized = Array.isArray(options) ? options : []
  return normalized.some((option) => option?.value === '') ? normalized : [{ value: '', label: emptyLabel }, ...normalized]
}

const groupBlockingItems = (items) => {
  const collection = Array.isArray(items) ? items : []

  return BLOCKING_GROUPS.map((group) => ({
    ...group,
    items: collection.filter((item) => group.fields.includes(item?.key)),
  })).filter((group) => group.items.length)
}

const normalizeLoadedFormData = (entity, profile) => ({
  ...emptyFormData,
  name: entity?.name || '',
  legal_name: profile.legal_name || '',
  business_type: profile.business_type || '',
  registration_number: profile.registration_number || '',
  business_bvn: sanitizeBvnInput(profile.business_bvn || ''),
  date_of_registration: profile.date_of_registration || '',
  category: profile.category || '',
  anchor_industry: profile.anchor_industry || '',
  business_description: profile.business_description || '',
  website: profile.website || '',
  tax_identifier: profile.tax_identifier || '',
  address_line_1: profile.address_line_1 || '',
  city: profile.city || '',
  state: normalizeStateValue(profile.country || 'NG', profile.state || ''),
  postal_code: profile.postal_code || '',
  country: normalizeCountryCode(profile.country || 'NG') || 'NG',
  registered_address_line_1: profile.registered_address_line_1 || '',
  registered_city: profile.registered_city || '',
  registered_state: normalizeStateValue(profile.registered_country || 'NG', profile.registered_state || ''),
  registered_postal_code: profile.registered_postal_code || '',
  registered_country: normalizeCountryCode(profile.registered_country || 'NG') || 'NG',
  contact_email: profile.contact_email || '',
  contact_phone: sanitizePhoneInput(profile.contact_phone || ''),
})

const normalizeLoadedSignatories = (items) =>
  (Array.isArray(items) && items.length ? items : [emptySignatory]).map((item) => ({
    ...item,
    full_name: item.full_name || buildSignatoryFullName(item),
    phone: sanitizePhoneInput(item.phone || ''),
    bvn: sanitizeBvnInput(item.bvn || ''),
    nationality: normalizeCountryCode(item.nationality || 'NG') || 'NG',
    country: normalizeCountryCode(item.country || 'NG') || 'NG',
    state: normalizeStateValue(item.country || 'NG', item.state || ''),
    ownership_percentage: item.ownership_percentage ?? '',
  }))

const registeredAddressMatchesOperating = (formData) => {
  const registeredValues = [
    formData.registered_address_line_1,
    formData.registered_city,
    formData.registered_state,
    formData.registered_postal_code,
    formData.registered_country,
  ].map((value) => String(value || '').trim())

  if (registeredValues.every((value) => !value)) return true

  return (
    registeredValues[0] === String(formData.address_line_1 || '').trim() &&
    registeredValues[1] === String(formData.city || '').trim() &&
    registeredValues[2] === String(formData.state || '').trim() &&
    registeredValues[3] === String(formData.postal_code || '').trim() &&
    registeredValues[4] === String(formData.country || '').trim()
  )
}

const buildOnboardingPayload = ({ formData, signatories, bvnMaxLength, phoneMaxLength, sameAsOperatingAddress = false }) => ({
  onboarding: {
    ...formData,
    ...(sameAsOperatingAddress
      ? {
          registered_address_line_1: formData.address_line_1,
          registered_city: formData.city,
          registered_state: normalizeStateValue(formData.country, formData.state),
          registered_postal_code: formData.postal_code,
          registered_country: normalizeCountryCode(formData.country),
        }
      : {}),
    business_bvn: sanitizeBvnInput(formData.business_bvn, bvnMaxLength),
    anchor_industry: formData.anchor_industry || '',
    signatories: signatories
      .filter((item) => String(item.full_name || item.first_name || item.last_name || '').trim())
      .map((item) => ({
        id: item.id,
        full_name: item.full_name,
        first_name: item.first_name,
        last_name: item.last_name,
        email: item.email,
        title: item.title,
        date_of_birth: item.date_of_birth,
        nationality: normalizeCountryCode(item.nationality),
        address_line_1: item.address_line_1,
        city: item.city,
        state: normalizeStateValue(item.country, item.state),
        postal_code: item.postal_code,
        country: normalizeCountryCode(item.country),
        bvn: sanitizeBvnInput(item.bvn, bvnMaxLength),
        identification_type: item.identification_type,
        id_document_number: item.id_document_number,
        phone: sanitizePhoneInput(item.phone, phoneMaxLength),
        ownership_percentage:
          item.ownership_percentage === '' || item.ownership_percentage === null || item.ownership_percentage === undefined
            ? null
            : Number(item.ownership_percentage),
        authorized_signatory: Boolean(item.authorized_signatory),
        director: Boolean(item.director),
      })),
  },
})

const BusinessOnboarding = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { ownerMode, selectedBusiness } = useSelectedBusiness()
  const user = useSelector((state) => state.auth?.user || null)
  const { hero, stepper, currentStepContent, blockingItems, compactHelperContent } = useBusinessOnboardingPresentation(
    selectedBusiness?.id,
    'profile'
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [autosaveState, setAutosaveState] = useState('idle')
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [businessEntity, setBusinessEntity] = useState(null)
  const [requirements, setRequirements] = useState(null)
  const [formData, setFormData] = useState(emptyFormData)
  const [signatories, setSignatories] = useState([emptySignatory])
  const [sameAsOperatingAddress, setSameAsOperatingAddress] = useState(true)
  const [showAdditionalBusinessDetails, setShowAdditionalBusinessDetails] = useState(false)
  const autosaveTimerRef = useRef(null)
  const hasHydratedRef = useRef(false)
  const lastSavedSnapshotRef = useRef('')
  const saveRequestRef = useRef(null)
  const phoneMaxLength = requirements?.fields?.contact_phone?.max_length || 16
  const bvnMaxLength = requirements?.fields?.bvn?.max_length || 11

  const applyOnboardingResponse = useCallback((data) => {
    const nextEntity = data.business_entity || null
    const profile = data.profile || {}
    const nextRequirements = data.requirements || null
    const loadedFormData = normalizeLoadedFormData(nextEntity, profile)
    const nextFormData = {
      ...loadedFormData,
      contact_email: loadedFormData.contact_email || user?.email || '',
      contact_phone: loadedFormData.contact_phone || sanitizePhoneInput(user?.user_profile?.phone_number || user?.phone || ''),
    }
    const nextSignatories = normalizeLoadedSignatories(data.signatories)
    const loadedPayload = buildOnboardingPayload({
      formData: loadedFormData,
      signatories: nextSignatories,
      bvnMaxLength,
      phoneMaxLength,
      sameAsOperatingAddress: registeredAddressMatchesOperating(loadedFormData),
    })

    lastSavedSnapshotRef.current = JSON.stringify(loadedPayload.onboarding)
    setBusinessEntity(nextEntity)
    setRequirements(nextRequirements)
    setFormData(nextFormData)
    setSignatories(nextSignatories)
    setSameAsOperatingAddress(registeredAddressMatchesOperating(nextFormData))
    setShowAdditionalBusinessDetails(Boolean(nextFormData.name || nextFormData.website || nextFormData.tax_identifier || nextFormData.business_description))
  }, [bvnMaxLength, phoneMaxLength, user])

  useEffect(() => {
    let active = true

    const loadOnboarding = async () => {
      if (!selectedBusiness?.id) {
        setLoading(false)
        return
      }

      setLoading(true)
      setErrorMessage('')
      try {
        const onboardingRes = await getBusinessOnboarding(selectedBusiness.id)
        if (!active) return

        const data = onboardingRes?.data?.data || {}
        applyOnboardingResponse(data)
        setAutosaveState('saved')
        setLastSavedAt(new Date())
        hasHydratedRef.current = true
      } catch (error) {
        if (!active) return
        setErrorMessage(error?.response?.data?.message || 'Unable to load business onboarding right now.')
        setAutosaveState('error')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadOnboarding()
    return () => {
      active = false
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    }
  }, [applyOnboardingResponse, selectedBusiness?.id])

  const businessTypeOptions = useMemo(() => {
    const options = requirements?.fields?.business_type?.options
    return Array.isArray(options) && options.length ? options : fallbackBusinessTypeOptions
  }, [requirements?.fields?.business_type?.options])

  const businessCategoryOptions = useMemo(() => {
    const options = requirements?.fields?.category?.options
    return Array.isArray(options) && options.length ? options : fallbackBusinessCategoryOptions
  }, [requirements?.fields?.category?.options])
  const anchorIndustryOptions = useMemo(() => {
    const options = requirements?.fields?.anchor_industry?.options
    return withEmptyOption(Array.isArray(options) && options.length ? options : [], 'Select Anchor industry')
  }, [requirements?.fields?.anchor_industry?.options])
  const showAnchorIndustryField = requirements?.fields?.anchor_industry?.visible === true
  const showBusinessBvnField = requirements?.fields?.business_bvn?.visible === true

  const countryOptions = useMemo(() => {
    const options = requirements?.fields?.country?.options
    return Array.isArray(options) && options.length ? options : fallbackCountryOptions
  }, [requirements?.fields?.country?.options])

  const stateOptionsByCountry = useMemo(() => {
    const options = requirements?.fields?.state?.options_by_country
    return options && typeof options === 'object' ? options : { NG: fallbackNigeriaStateOptions }
  }, [requirements?.fields?.state?.options_by_country])

  const signatoryTitleOptions = useMemo(() => {
    const options = requirements?.fields?.title?.options
    return withEmptyOption(Array.isArray(options) && options.length ? options : fallbackSignatoryTitleOptions, 'Select title')
  }, [requirements?.fields?.title?.options])

  const identificationTypeOptions = useMemo(() => {
    const options = requirements?.fields?.identification_type?.options
    return withEmptyOption(
      Array.isArray(options) && options.length ? options : fallbackIdentificationTypeOptions,
      'Select identification type'
    )
  }, [requirements?.fields?.identification_type?.options])
  const signatoryFieldDefinitions = useMemo(
    () =>
      signatoryFieldOrder
        .map(([field, fallbackLabel, defaultVisible]) => {
          const config = requirements?.signatories?.fields?.[field] || {}
          const visible = config.visible ?? defaultVisible
          if (!visible) return null

          return {
            field,
            label: config.label || fallbackLabel,
          }
        })
        .filter(Boolean),
    [requirements?.signatories?.fields]
  )

  const statusLabel = useMemo(() => formatCustomerStatus(businessEntity?.status), [businessEntity?.status])
  const groupedBlockingItems = useMemo(() => groupBlockingItems(blockingItems), [blockingItems])
  const recoveryParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const recoverySection = recoveryParams.get('section') || ''
  const recoverySignatoryIndex = Number.parseInt(recoveryParams.get('signatory') || '', 10)
  const recoveryFields = useMemo(
    () =>
      new Set(
        String(recoveryParams.get('fields') || '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      ),
    [recoveryParams]
  )
  const registrationNumberConfig = useMemo(
    () => getRegistrationNumberConfig(formData.business_type),
    [formData.business_type]
  )
  const registrationNumberError = useMemo(() => {
    const value = String(formData.registration_number || '').trim()
    if (!value) return ''
    if (registrationNumberConfig.isValid(value)) return ''
    return registrationNumberConfig.validationMessage
  }, [formData.registration_number, registrationNumberConfig])
  const profileStepGroups = useMemo(
    () => ({
      business: groupedBlockingItems.find((group) => group.key === 'business')?.items || [],
      contact: [
        ...(groupedBlockingItems.find((group) => group.key === 'contact')?.items || []),
        ...(groupedBlockingItems.find((group) => group.key === 'address')?.items || []),
      ],
      signatory: groupedBlockingItems.find((group) => group.key === 'signatory')?.items || [],
    }),
    [groupedBlockingItems]
  )
  const activeProfileStep = useMemo(() => {
    if (PROFILE_STEP_SEQUENCE.includes(recoverySection)) return recoverySection
    const firstIncompleteStep = PROFILE_STEP_SEQUENCE.find((stepKey) => profileStepGroups[stepKey]?.length)
    return firstIncompleteStep || 'business'
  }, [profileStepGroups, recoverySection])
  const activeProfileStepIndex = PROFILE_STEP_SEQUENCE.indexOf(activeProfileStep)
  const activeProfileStepMeta = PROFILE_STEP_COPY[activeProfileStep] || PROFILE_STEP_COPY.business
  const activeProfileBlockers = profileStepGroups[activeProfileStep] || []
  const requiresDirectorAndOwner = PRIVATE_INCORPORATED_TYPES.has(formData.business_type)
  const directorCount = useMemo(
    () => signatories.filter((item) => Boolean(item.director)).length,
    [signatories]
  )
  const ownerCount = useMemo(
    () => signatories.filter((item) => !Boolean(item.director)).length,
    [signatories]
  )
  const firstOwnerIndex = useMemo(
    () => signatories.findIndex((item) => !Boolean(item.director)),
    [signatories]
  )
  const buildProfileStepRoute = useCallback(
    (stepKey) => {
      const params = new URLSearchParams(location.search)
      params.set('section', stepKey)
      if (stepKey !== 'signatory') params.delete('signatory')
      const query = params.toString()
      return `/dashboard/business/onboarding${query ? `?${query}` : ''}`
    },
    [location.search]
  )

  const autosaveStatusLabel = useMemo(() => {
    if (saving) return 'Saving changes...'
    if (autosaveState === 'saving') return 'Autosaving draft...'
    if (autosaveState === 'error') return 'Autosave failed. Keep this tab open and save again.'
    if (lastSavedAt) return `Draft saved ${lastSavedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    return 'Draft autosaves while you type.'
  }, [autosaveState, lastSavedAt, saving])

  const persistOnboarding = useCallback(async ({ mode = 'autosave', navigateOnReady = false } = {}) => {
    if (!selectedBusiness?.id) return { saved: false }
    if (registrationNumberError) {
      if (mode === 'submit') toast.error(registrationNumberError)
      return { saved: false, skipped: true }
    }

    const payload = buildOnboardingPayload({
      formData,
      signatories,
      bvnMaxLength,
      phoneMaxLength,
      sameAsOperatingAddress,
    })
    const snapshot = JSON.stringify(payload.onboarding)

    if (mode === 'autosave' && snapshot === lastSavedSnapshotRef.current) return { saved: false, skipped: true }
    if (saveRequestRef.current) {
      const result = await saveRequestRef.current
      if (mode === 'submit' && result?.saved && navigateOnReady && result?.data?.readiness?.profile_ready) {
        navigate('/dashboard/business/kyb')
      }
      return result
    }

    if (mode === 'submit') setSaving(true)
    else setAutosaveState('saving')

    setErrorMessage('')

    const request = (async () => {
      try {
        const response = await updateBusinessOnboarding(selectedBusiness.id, payload)
        const data = response?.data?.data || {}

        applyOnboardingResponse(data)
        setAutosaveState('saved')
        setLastSavedAt(new Date())

        if (mode === 'submit') toast.success('Business onboarding profile saved.')
        if (navigateOnReady && data?.readiness?.profile_ready) navigate('/dashboard/business/kyb')

        return { saved: true, data }
      } catch (error) {
        const message = error?.response?.data?.message || 'Unable to save business onboarding.'
        setErrorMessage(message)
        setAutosaveState('error')
        if (mode === 'submit') toast.error(message)
        return { saved: false, error }
      } finally {
        if (mode === 'submit') setSaving(false)
        saveRequestRef.current = null
      }
    })()

    saveRequestRef.current = request
    return request
  }, [
    applyOnboardingResponse,
    bvnMaxLength,
    formData,
    navigate,
    phoneMaxLength,
    registrationNumberError,
    sameAsOperatingAddress,
    selectedBusiness?.id,
    signatories,
  ])

  useEffect(() => {
    if (!hasHydratedRef.current || loading || !selectedBusiness?.id) return
    if (registrationNumberError) {
      setAutosaveState('error')
      return
    }

    const snapshot = JSON.stringify(
      buildOnboardingPayload({
        formData,
      signatories,
      bvnMaxLength,
      phoneMaxLength,
      sameAsOperatingAddress,
      }).onboarding
    )

    if (snapshot === lastSavedSnapshotRef.current) return

    setAutosaveState('dirty')
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(() => {
      persistOnboarding()
    }, AUTOSAVE_DELAY_MS)

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    }
  }, [bvnMaxLength, formData, loading, persistOnboarding, phoneMaxLength, registrationNumberError, sameAsOperatingAddress, selectedBusiness?.id, signatories])

  useEffect(() => {
    if (loading) return
    if (!recoverySection) return

    const targetId =
      recoverySection === 'signatory' && Number.isInteger(recoverySignatoryIndex)
        ? `onboarding-signatory-card-${recoverySignatoryIndex}`
        : `onboarding-${recoverySection}-section`

    const timer = window.setTimeout(() => {
      const element = document.getElementById(targetId)
      if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)

    return () => window.clearTimeout(timer)
  }, [loading, recoverySection, recoverySignatoryIndex, signatories.length])

  const isRecoveredSection = useCallback((section) => recoverySection === section, [recoverySection])

  const isRecoveredField = useCallback(
    (section, field, signatoryIndex = null) => {
      if (recoverySection !== section) return false
      if (section === 'signatory' && Number.isInteger(recoverySignatoryIndex) && signatoryIndex !== recoverySignatoryIndex) return false
      if (!recoveryFields.size) return true
      return recoveryFields.has(field)
    },
    [recoveryFields, recoverySection, recoverySignatoryIndex]
  )

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((current) => {
      const normalizedValue =
        name === 'contact_phone'
          ? sanitizePhoneInput(value, phoneMaxLength)
          : name === 'business_bvn'
          ? sanitizeBvnInput(value, bvnMaxLength)
          : value
      const next = { ...current, [name]: normalizedValue }

      if (name === 'country') {
        next.country = normalizeCountryCode(normalizedValue)
        next.state = normalizeCountryCode(normalizedValue) === 'NG' ? normalizeStateValue('NG', current.state) : current.state
      }

      if (name === 'registered_country') {
        next.registered_country = normalizeCountryCode(normalizedValue)
        next.registered_state =
          normalizeCountryCode(normalizedValue) === 'NG' ? normalizeStateValue('NG', current.registered_state) : current.registered_state
      }

      if (name === 'state') next.state = normalizeStateValue(next.country, value)
      if (name === 'registered_state') next.registered_state = normalizeStateValue(next.registered_country, value)
      if (name === 'category' && normalizedValue !== current.category) next.anchor_industry = ''

      return next
    })
  }

  const handleSignatoryChange = (index, field, value) => {
    setSignatories((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item

        const normalizedValue =
          field === 'phone'
            ? sanitizePhoneInput(value, phoneMaxLength)
            : field === 'bvn'
            ? sanitizeBvnInput(value, bvnMaxLength)
            : field === 'ownership_percentage'
            ? value.replace(/[^0-9]/g, '').slice(0, 3)
            : value
        const next = { ...item, [field]: normalizedValue }
        if (field === 'country' || field === 'nationality') next[field] = normalizeCountryCode(normalizedValue)
        if (field === 'state') next.state = normalizeStateValue(next.country, value)
        if (field === 'country') next.state = normalizeStateValue(next.country, next.state)
        return next
      })
    )
  }

  const handleSignatoryToggle = (index, field, checked) => {
    setSignatories((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: checked } : item))
    )
  }

  const handleSignatoryRoleChange = (index, role) => {
    setSignatories((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item
        if (role === 'DIRECTOR') return { ...item, director: true, ownership_percentage: '' }
        return { ...item, director: false }
      })
    )
  }

  const addSignatory = () => {
    setSignatories((current) => [...current, { ...emptySignatory }])
  }

  const addDirectorSignatory = () => {
    setSignatories((current) => [...current, { ...emptySignatory, director: true, ownership_percentage: '' }])
  }

  const cloneOwnerAsDirector = () => {
    setSignatories((current) => {
      const owner = current.find((item) => !Boolean(item.director))
      if (!owner) return current
      const { id, ownership_percentage, director, ...rest } = owner
      return [...current, { ...emptySignatory, ...rest, id: undefined, director: true, ownership_percentage: '' }]
    })
  }

  const removeSignatory = (index) => {
    setSignatories((current) => (current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : current))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!selectedBusiness?.id) return
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    if (activeProfileStep !== 'signatory') {
      const result = await persistOnboarding({ mode: 'autosave' })
      if (result?.saved !== false || result?.skipped) {
        navigate(buildProfileStepRoute(PROFILE_STEP_SEQUENCE[activeProfileStepIndex + 1] || 'signatory'))
      }
      return
    }

    await persistOnboarding({ mode: 'submit', navigateOnReady: true })
  }

  if (ownerMode !== 'business') return <Navigate to="/dashboard/home" replace />

  if (!selectedBusiness) {
    return <BusinessWorkspaceRequired message="Select a business workspace from the switcher to continue setting up your business account." />
  }

  return (
    <BusinessSetupShell
      eyebrow="Business setup"
      title={hero?.title || selectedBusiness.name}
      subtitle={activeProfileStepMeta.description}
      statusBadge={hero?.statusBadge || 'Complete your business details'}
      saveStatus={autosaveStatusLabel}
      progress={stepper}
      backAction={
        activeProfileStepIndex > 0 ? (
          <Link
            to={buildProfileStepRoute(PROFILE_STEP_SEQUENCE[activeProfileStepIndex - 1])}
            className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            Back
          </Link>
        ) : null
      }
    >
      <section className={cardClass}>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Business details · {activeProfileStepIndex + 1} of {PROFILE_STEP_SEQUENCE.length}
            </div>
            <h2 className="mt-2 text-xl font-semibold text-white">{activeProfileStepMeta.title}</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">{compactHelperContent || currentStepContent?.description}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-3 text-sm text-slate-300">
            Account status: <span className="font-semibold text-white">{statusLabel}</span>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-slate-400">Loading your business details...</div>
        ) : (
          <form className="space-y-6" onSubmit={handleSubmit}>
            {errorMessage ? (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
                {errorMessage}
              </div>
            ) : null}

            {activeProfileBlockers.length ? (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-4">
                <div className="text-sm font-semibold text-white">Focus on these items now</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeProfileBlockers.map((item) => (
                    <span
                      key={item.key}
                      className="rounded-full border border-amber-500/30 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-amber-100"
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-6">
              {activeProfileStep === 'business' ? (
                <div
                  id="onboarding-business-section"
                  className={`space-y-4 rounded-3xl p-1 transition ${
                    isRecoveredSection('business') ? 'ring-1 ring-amber-400/50 ring-offset-0' : ''
                  }`}
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {companyFields.map(([field, label]) => (
                      <div key={field}>
                        <label className="block text-sm font-medium text-slate-300">{label}</label>
                        <input
                          type={field === 'date_of_registration' ? 'date' : 'text'}
                          name={field}
                          value={formData[field]}
                          onChange={handleChange}
                          style={field === 'date_of_registration' ? { colorScheme: 'light' } : undefined}
                          className={`mt-1 w-full rounded-2xl border bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60 ${
                            isRecoveredField('business', field) ? 'border-amber-400/60' : 'border-slate-700'
                          }`}
                        />
                      </div>
                    ))}

                    <div>
                      <label className="block text-sm font-medium text-slate-300">{registrationNumberConfig.label}</label>
                      <input
                        type="text"
                        name="registration_number"
                        value={formData.registration_number}
                        onChange={handleChange}
                        placeholder="Enter registration number"
                        className={`mt-1 w-full rounded-2xl border bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60 ${
                          registrationNumberError || isRecoveredField('business', 'registration_number')
                            ? 'border-amber-500/60'
                            : 'border-slate-700'
                        }`}
                      />
                      {registrationNumberError ? <p className="mt-2 text-xs text-amber-300">{registrationNumberError}</p> : null}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300">Business type</label>
                      <select
                        name="business_type"
                        value={formData.business_type}
                        onChange={handleChange}
                        className={`mt-1 w-full rounded-2xl border bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60 ${
                          isRecoveredField('business', 'business_type') ? 'border-amber-400/60' : 'border-slate-700'
                        }`}
                      >
                        <option value="">Select business type</option>
                        {businessTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300">Business category</label>
                      <select
                        name="category"
                        value={formData.category}
                        onChange={handleChange}
                        className={`mt-1 w-full rounded-2xl border bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60 ${
                          isRecoveredField('business', 'category') ? 'border-amber-400/60' : 'border-slate-700'
                        }`}
                      >
                        <option value="">Select business category</option>
                        {businessCategoryOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {showAnchorIndustryField ? (
                      <div>
                        <label className="block text-sm font-medium text-slate-300">
                          Industry or subcategory
                        </label>
                        <select
                          name="anchor_industry"
                          value={formData.anchor_industry}
                          onChange={handleChange}
                          className={`mt-1 w-full rounded-2xl border bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60 ${
                            isRecoveredField('business', 'anchor_industry') ? 'border-amber-400/60' : 'border-slate-700'
                          }`}
                        >
                          {anchorIndustryOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}

                    {showBusinessBvnField ? <div>
                      <label className="block text-sm font-medium text-slate-300">BVN for business verification</label>
                      <input
                        type="tel"
                        name="business_bvn"
                        value={formData.business_bvn}
                        onChange={handleChange}
                        maxLength={bvnMaxLength}
                        inputMode="numeric"
                        className={`mt-1 w-full rounded-2xl border bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60 ${
                          isRecoveredField('business', 'business_bvn') ? 'border-amber-400/60' : 'border-slate-700'
                        }`}
                        placeholder="11-digit BVN"
                      />
                      <p className="mt-2 text-xs text-slate-500">This is required to complete verification for this business.</p>
                    </div> : null}
                  </div>

                  <details open={showAdditionalBusinessDetails} onToggle={(event) => setShowAdditionalBusinessDetails(event.currentTarget.open)} className="rounded-2xl border border-slate-800 bg-slate-950/35 p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-white">Additional business details <span className="ml-2 text-xs font-normal text-slate-400">Optional</span></summary>
                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                      {[['name', 'Display name', 'The name shown for this business in BitBridge.'], ['website', 'Website', ''], ['tax_identifier', 'Tax identifier', '']].map(([field, label, helper]) => (
                        <div key={field}>
                          <label className="block text-sm font-medium text-slate-300">{label}</label>
                          <input name={field} value={formData[field]} onChange={handleChange} className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60" />
                          {helper ? <p className="mt-2 text-xs text-slate-500">{helper}</p> : null}
                        </div>
                      ))}
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-300">Business description</label>
                        <textarea name="business_description" value={formData.business_description} onChange={handleChange} rows={3} className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60" />
                      </div>
                    </div>
                  </details>
                </div>
              ) : null}

              {activeProfileStep === 'contact' ? (
                <div
                  id="onboarding-contact-section"
                  className={`space-y-4 rounded-3xl p-1 transition ${
                    isRecoveredSection('contact') ? 'ring-1 ring-amber-400/50 ring-offset-0' : ''
                  }`}
                >
                  <div>
                    <h3 className="text-base font-semibold text-white">Business contact</h3>
                    <p className="mt-1 text-sm text-slate-400">You can update these details at any time.</p>
                  </div>
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-3 text-sm text-slate-200">
                    <input type="checkbox" checked={sameAsOperatingAddress} onChange={(event) => setSameAsOperatingAddress(event.target.checked)} className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-[#FFB05A] focus:ring-[#FFB05A]/50" />
                    <span>Registered address is the same as operating address</span>
                  </label>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {contactFields
                      .filter(([field]) => !sameAsOperatingAddress || !field.startsWith('registered_'))
                      .map(([field, label]) => (
                      <div key={field}>
                        <label className="block text-sm font-medium text-slate-300">{label}</label>
                        {field === 'country' || field === 'registered_country' ? (
                          <select
                            name={field}
                            value={formData[field]}
                            onChange={handleChange}
                            className={`mt-1 w-full rounded-2xl border bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60 ${
                              isRecoveredField('contact', field) ? 'border-amber-400/60' : 'border-slate-700'
                            }`}
                          >
                            <option value="">Select country</option>
                            {countryOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : field === 'state' || field === 'registered_state' ? (
                          normalizeCountryCode(field === 'state' ? formData.country : formData.registered_country) === 'NG' ? (
                            <select
                              name={field}
                              value={formData[field]}
                              onChange={handleChange}
                              className={`mt-1 w-full rounded-2xl border bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60 ${
                                isRecoveredField('contact', field) ? 'border-amber-400/60' : 'border-slate-700'
                              }`}
                            >
                              <option value="">Select state</option>
                              {(stateOptionsByCountry.NG || fallbackNigeriaStateOptions).map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              name={field}
                              value={formData[field]}
                              onChange={handleChange}
                              className={`mt-1 w-full rounded-2xl border bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60 ${
                                isRecoveredField('contact', field) ? 'border-amber-400/60' : 'border-slate-700'
                              }`}
                            />
                          )
                        ) : (
                          <input
                            type={field === 'contact_email' ? 'email' : field === 'contact_phone' ? 'tel' : 'text'}
                            name={field}
                            value={formData[field]}
                            onChange={handleChange}
                            maxLength={field === 'contact_phone' ? phoneMaxLength : undefined}
                            inputMode={field === 'contact_phone' ? 'tel' : undefined}
                            className={`mt-1 w-full rounded-2xl border bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60 ${
                              isRecoveredField('contact', field) ? 'border-amber-400/60' : 'border-slate-700'
                            }`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  {!sameAsOperatingAddress ? <p className="text-sm text-slate-400">Enter the registered address for this business.</p> : null}
                </div>
              ) : null}

              {activeProfileStep === 'signatory' ? (
                <div
                  id="onboarding-signatory-section"
                  className={`space-y-4 rounded-3xl p-1 transition ${
                    isRecoveredSection('signatory') ? 'ring-1 ring-amber-400/50 ring-offset-0' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-white">Authorised signatory</h3>
                      <p className="mt-1 text-sm text-slate-400">Only this requirement is in focus right now.</p>
                    </div>
                    <button
                      type="button"
                      onClick={addSignatory}
                      className="rounded-2xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white"
                    >
                      Add another signatory
                    </button>
                  </div>

                  {requiresDirectorAndOwner ? (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Private incorporated checklist
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/55 px-4 py-3 text-sm">
                          <div className="font-semibold text-white">At least one OWNER</div>
                          <div className={ownerCount > 0 ? 'mt-1 text-emerald-300' : 'mt-1 text-amber-200'}>
                            {ownerCount > 0 ? `Ready (${ownerCount})` : 'Missing'}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/55 px-4 py-3 text-sm">
                          <div className="font-semibold text-white">At least one DIRECTOR</div>
                          <div className={directorCount > 0 ? 'mt-1 text-emerald-300' : 'mt-1 text-amber-200'}>
                            {directorCount > 0 ? `Ready (${directorCount})` : 'Missing'}
                          </div>
                        </div>
                      </div>
                      {directorCount < 1 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={addDirectorSignatory}
                            className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-100 transition hover:border-amber-300/60 hover:bg-amber-500/16"
                          >
                            Add director
                          </button>
                          {firstOwnerIndex >= 0 ? (
                            <button
                              type="button"
                              onClick={cloneOwnerAsDirector}
                              className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-200 transition hover:border-slate-500 hover:text-white"
                            >
                              Copy owner as director
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {requirements?.signatories?.officer_rules ? (
                    <details className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                      <summary className="cursor-pointer text-sm font-semibold text-white">Show signatory guidance</summary>
                      <div className="mt-3 space-y-3 text-sm text-slate-300">
                        <div>{requirements.signatories.officer_rules.summary || 'Officer requirements depend on the business registration type and review stage.'}</div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div className="rounded-2xl border border-slate-800 bg-slate-950/55 px-4 py-3">
                            Registration type: <span className="font-semibold text-white">{formatLabel(requirements.signatories.officer_rules.registration_type)}</span>
                          </div>
                          <div className="rounded-2xl border border-slate-800 bg-slate-950/55 px-4 py-3">
                            Accepted roles:{' '}
                            <span className="font-semibold text-white">
                              {Array.isArray(requirements.signatories.officer_rules.accepted_roles) &&
                              requirements.signatories.officer_rules.accepted_roles.length
                                ? requirements.signatories.officer_rules.accepted_roles.join(', ')
                                : 'OWNER, DIRECTOR'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </details>
                  ) : null}

                  {signatories.map((signatory, index) => (
                    <div
                      id={`onboarding-signatory-card-${index}`}
                      key={signatory.id || `new-${index}`}
                      className={`rounded-2xl border bg-slate-950/45 p-4 ${
                        isRecoveredSection('signatory') && recoverySignatoryIndex === index
                          ? 'border-amber-400/60'
                          : 'border-slate-800'
                      }`}
                    >
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-white">Signatory {index + 1}</div>
                        {signatories.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeSignatory(index)}
                            className="text-sm text-rose-300 hover:text-rose-200"
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {signatoryFieldDefinitions.map(({ field, label }) => (
                          <div key={field}>
                            <label className="block text-sm font-medium text-slate-300">{label}</label>
                            {field === 'title' ? (
                              <select
                                value={signatory[field] || ''}
                                onChange={(event) => handleSignatoryChange(index, field, event.target.value)}
                                className={`mt-1 w-full rounded-2xl border bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60 ${
                                  isRecoveredField('signatory', field, index) ? 'border-amber-400/60' : 'border-slate-700'
                                }`}
                              >
                                {signatoryTitleOptions.map((option) => (
                                  <option key={option.value || 'empty'} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            ) : field === 'identification_type' ? (
                              <select
                                value={signatory[field] || ''}
                                onChange={(event) => handleSignatoryChange(index, field, event.target.value)}
                                className={`mt-1 w-full rounded-2xl border bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60 ${
                                  isRecoveredField('signatory', field, index) ? 'border-amber-400/60' : 'border-slate-700'
                                }`}
                              >
                                {identificationTypeOptions.map((option) => (
                                  <option key={option.value || 'empty'} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            ) : field === 'nationality' || field === 'country' ? (
                              <select
                                value={signatory[field] || ''}
                                onChange={(event) => handleSignatoryChange(index, field, event.target.value)}
                                className={`mt-1 w-full rounded-2xl border bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60 ${
                                  isRecoveredField('signatory', field, index) ? 'border-amber-400/60' : 'border-slate-700'
                                }`}
                              >
                                <option value="">Select country</option>
                                {countryOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            ) : field === 'state' ? (
                              normalizeCountryCode(signatory.country) === 'NG' ? (
                                <select
                                  value={signatory[field] || ''}
                                  onChange={(event) => handleSignatoryChange(index, field, event.target.value)}
                                  className={`mt-1 w-full rounded-2xl border bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60 ${
                                    isRecoveredField('signatory', field, index) ? 'border-amber-400/60' : 'border-slate-700'
                                  }`}
                                >
                                  <option value="">Select state</option>
                                  {(stateOptionsByCountry.NG || fallbackNigeriaStateOptions).map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={signatory[field] || ''}
                                  onChange={(event) => handleSignatoryChange(index, field, event.target.value)}
                                  className={`mt-1 w-full rounded-2xl border bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60 ${
                                    isRecoveredField('signatory', field, index) ? 'border-amber-400/60' : 'border-slate-700'
                                  }`}
                                />
                              )
                            ) : (
                              <input
                                type={field === 'date_of_birth' ? 'date' : field === 'email' ? 'email' : field === 'phone' || field === 'bvn' ? 'tel' : 'text'}
                                value={signatory[field] || ''}
                                onChange={(event) => handleSignatoryChange(index, field, event.target.value)}
                                maxLength={field === 'phone' ? phoneMaxLength : field === 'bvn' ? bvnMaxLength : undefined}
                                inputMode={field === 'phone' ? 'tel' : field === 'bvn' ? 'numeric' : undefined}
                                className={`mt-1 w-full rounded-2xl border bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60 ${
                                  isRecoveredField('signatory', field, index) ? 'border-amber-400/60' : 'border-slate-700'
                                }`}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <label className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-3 text-sm text-slate-200">
                          <input
                            type="checkbox"
                            checked={Boolean(signatory.authorized_signatory)}
                            onChange={(event) => handleSignatoryToggle(index, 'authorized_signatory', event.target.checked)}
                            className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-[#FFB05A] focus:ring-[#FFB05A]/50"
                          />
                          <span>This person is an authorised signatory</span>
                        </label>
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-3">
                          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Role for provider</div>
                          <div className="flex flex-wrap gap-3 text-sm text-slate-200">
                            <label className="inline-flex items-center gap-2">
                              <input
                                type="radio"
                                name={`signatory-role-${index}`}
                                checked={Boolean(signatory.director)}
                                onChange={() => handleSignatoryRoleChange(index, 'DIRECTOR')}
                                className="h-4 w-4 border-slate-600 bg-slate-900 text-[#FFB05A] focus:ring-[#FFB05A]/50"
                              />
                              <span>Director</span>
                            </label>
                            <label className="inline-flex items-center gap-2">
                              <input
                                type="radio"
                                name={`signatory-role-${index}`}
                                checked={!Boolean(signatory.director)}
                                onChange={() => handleSignatoryRoleChange(index, 'OWNER')}
                                className="h-4 w-4 border-slate-600 bg-slate-900 text-[#FFB05A] focus:ring-[#FFB05A]/50"
                              />
                              <span>Owner</span>
                            </label>
                          </div>
                        </div>
                      </div>
                      {!signatory.director ? (
                        <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                          <div className="mb-2 text-sm font-semibold text-amber-100">Owner details</div>
                          <p className="mb-3 text-xs text-amber-100/70">
                            With the director toggle off, this signatory will be submitted to Anchor as an owner and must include an ownership percentage.
                          </p>
                          <label className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                            Ownership percentage
                            <input
                              type="text"
                              value={signatory.ownership_percentage ?? ''}
                              onChange={(event) => handleSignatoryChange(index, 'ownership_percentage', event.target.value)}
                              inputMode="numeric"
                              placeholder="e.g. 100"
                              className={`mt-1 w-full rounded-2xl border bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60 ${
                                isRecoveredField('signatory', 'ownership_percentage', index) ? 'border-amber-400/60' : 'border-slate-700'
                              }`}
                            />
                          </label>
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-slate-500">
                          Need to submit this person as an owner instead? Turn off the director toggle and add their ownership percentage.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-2">
              <div className="text-sm text-slate-400">
                {autosaveState === 'error'
                  ? 'Draft changes are not fully saved yet. Fix the highlighted issue or try again.'
                  : 'Only this step is in focus. You can always go back if needed.'}
              </div>
              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl bg-[#FFB05A] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#ffc27d] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? 'Saving your details...'
                  : activeProfileStepMeta.primaryLabel}
              </button>
            </div>
          </form>
        )}
      </section>
    </BusinessSetupShell>
  )
}

export default BusinessOnboarding
