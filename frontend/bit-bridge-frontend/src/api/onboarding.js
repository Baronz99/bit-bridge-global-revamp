// src/api/onboarding.js
import axios from 'axios'
import { API_BASE_URL } from './config'

// small helper so all onboarding calls send the JWT
function authHeaders() {
  const token = localStorage.getItem('bitglobal')

  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
// NOTE: we expect a payload shaped like:
// {
//   id_type,
//   user_profile_attributes: { first_name, last_name, phone_number, ... }
// }
export async function updateBasicProfile(payload) {
  const res = await axios.patch(
    `${API_BASE_URL}/api/v1/users/basic_profile`,
    {
      user: payload,
    },
    { headers: authHeaders() }
  )
  return res.data
}

// ---- 3) PRIMARY USE CASE (this is what UseCaseSetup uses) ----
export async function saveOnboardingUseCase({ primary_use_case, onboarding_stage }) {
  const res = await axios.patch(
    `${API_BASE_URL}/api/v1/users/use_case`,
    {
      user: {
        primary_use_case,
        onboarding_stage,
      },
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
