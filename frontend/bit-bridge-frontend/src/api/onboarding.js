// src/api/onboarding.js
import axios from 'axios'
import { API_BASE_URL } from './config'

// small helper so all onboarding calls send the JWT
function authHeaders() {
  const token = localStorage.getItem('bitglobal')

  return {
    Accept: 'application/json',
    // NOTE: we'll override Content-Type for FormData requests
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

// ---- 1) Onboarding stage only ----
export async function saveOnboardingStage({ onboarding_stage }) {
  const res = await axios.patch(
    `${API_BASE_URL}/api/v1/users/onboarding_stage`,
    { user: { onboarding_stage } },
    { headers: authHeaders() }
  )
  return res.data
}

// ---- 2) Basic + address profile (JSON OR FormData) ----
// JSON shape (used on UseCaseSetup):
//   updateBasicProfile({ id_type, user_profile_attributes: { ... } })
//
// FormData shape (used on ProfileAccountPage):
//   const fd = new FormData()
//   fd.append('user[id_type]', 'bvn')
//   fd.append('user[user_profile_attributes][first_name]', 'John')
//   ...
//   updateBasicProfile(fd, true)
export async function updateBasicProfile(payload, isFormData = false) {
  const url = `${API_BASE_URL}/api/v1/users/basic_profile`

  // 🔹 FormData path – used by ProfileAccountPage with file uploads
  if (isFormData) {
    const res = await axios.patch(url, payload, {
      headers: {
        ...authHeaders(),
        // let the browser set correct boundary
        'Content-Type': 'multipart/form-data',
      },
    })
    return res.data
  }

  // 🔹 JSON path – used by UseCaseSetup (no files)
  const res = await axios.patch(
    url,
    {
      user: payload,
    },
    { headers: authHeaders() }
  )
  return res.data
}

// ---- 3) PRIMARY USE CASE (used by UseCaseSetup) ----
// Sends a flat payload that OnboardingController#update_use_case accepts.
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
