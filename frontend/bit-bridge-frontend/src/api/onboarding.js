// src/api/onboarding.js
import axios from 'axios'
import { API_BASE_URL } from './config'

// small helper so all onboarding calls send the JWT
// now accepts an optional options object for special cases (e.g. multipart)
function authHeaders(options = {}) {
  const token = localStorage.getItem('bitglobal')

  const base = {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  // For multipart/form-data we let the browser/axios set the Content-Type with boundary
  if (options.multipart) {
    return base
  }

  // Default: JSON requests
  return {
    ...base,
    'Content-Type': 'application/json',
  }
}

// ---- 1) Basic onboarding stage (optional helper) ----
export async function saveOnboardingStage({ onboarding_stage }) {
  const res = await axios.patch(
    `${API_BASE_URL}/api/v1/users/onboarding_stage`,
    { user: { onboarding_stage } },
    { headers: authHeaders() }
  )
  return res.data
}

// ---- 2) Basic + address profile (used by ProfileAccountPage) ----
// NOTE:
// - If you call updateBasicProfile(payload)         -> sends JSON (old behaviour)
// - If you call updateBasicProfile(formData, true) -> sends FormData (for file uploads)
export async function updateBasicProfile(payload, isFormData = false) {
  if (isFormData) {
    // FormData path (for ID document + proof of address uploads)
    const res = await axios.patch(
      `${API_BASE_URL}/api/v1/users/basic_profile`,
      payload,
      {
        headers: authHeaders({ multipart: true }),
      }
    )
    return res.data
  }

  // Existing JSON behaviour (backwards compatible)
  const res = await axios.patch(
    `${API_BASE_URL}/api/v1/users/basic_profile`,
    {
      user: payload,
    },
    { headers: authHeaders() }
  )
  return res.data
}

// ---- 3) PRIMARY USE CASE (used by UseCaseSetup) ----
// This calls the onboarding controller directly with TOP-LEVEL params
// so the backend sees `primary_use_case` correctly.
export async function saveOnboardingUseCase({ primary_use_case, onboarding_stage }) {
  const res = await axios.patch(
    `${API_BASE_URL}/api/v1/onboarding/use_case`,
    {
      primary_use_case,
      onboarding_stage,
    },
    { headers: authHeaders() }
  )

  return res.data
}

// ---- 4) (Optional) admin KYC level update helper ----
export async function saveKycLevel({ kyc_level, id_type }) {
  const res = await axios.patch(
    `${API_BASE_URL}/api/v1/users/update_kyc_level`,
    {
      user: {
        kyc_level,
        id_type,
      },
    },
    { headers: authHeaders() }
  )

  return res.data
}
