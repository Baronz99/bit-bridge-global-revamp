// src/api/onboarding.js
import axios from 'axios'
import { API_BASE_URL } from './config'

// small helper so all onboarding calls send the JWT
function authHeaders() {
  const token = localStorage.getItem('bitglobal')

  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
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

/**
 * 2) BASIC + ADDRESS PROFILE
 *
 * This helper supports TWO modes:
 *
 *  A) JSON mode (no file uploads):
 *     updateBasicProfile({
 *       id_type,
 *       user_profile_attributes: { first_name, last_name, phone_number, date_of_birth, ... }
 *     })
 *
 *     -> sends:
 *        { user: { id_type, user_profile_attributes: { ... } } }
 *        as JSON
 *
 *  B) FormData mode (file uploads, used on Profile page):
 *     const fd = new FormData()
 *     fd.append('user[id_type]', 'bvn')
 *     fd.append('user[user_profile_attributes][first_name]', 'John')
 *     ...
 *     fd.append('user[id_document]', file)
 *
 *     updateBasicProfile(fd, true)
 *
 *     -> sends raw FormData; Rails sees params[:user] correctly.
 */
export async function updateBasicProfile(payload, isFormData = false) {
  const url = `${API_BASE_URL}/api/v1/users/basic_profile`

  if (isFormData) {
    // 🚨 IMPORTANT:
    // Do NOT wrap FormData inside { user: ... }.
    // We already encoded keys like "user[...]" in the FormData itself.
    //
    // Also, we remove the JSON Content-Type header so the browser
    // can set the correct multipart boundary for us.
    const jsonHeaders = authHeaders()
    const { 'Content-Type': _ignored, ...formHeaders } = jsonHeaders

    const res = await axios.patch(url, payload, {
      headers: formHeaders,
    })
    return res.data
  }

  // JSON path – used by UseCaseSetup (no files)
  const res = await axios.patch(
    url,
    { user: payload },
    {
      headers: authHeaders(),
    }
  )

  return res.data
}

// ---- 3) PRIMARY USE CASE (used by UseCaseSetup) ----
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
