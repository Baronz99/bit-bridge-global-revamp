// src/api/onboarding.js
import client from './client'

// ---- 1) Basic onboarding stage (optional helper) ----
// PATCH /api/v1/users/onboarding_stage
export async function saveOnboardingStage({ onboarding_stage }) {
  const res = await client.patch('/users/onboarding_stage', {
    user: { onboarding_stage },
  })
  return res.data
}

/**
 * 2) BASIC PROFILE (name, phone, DOB)
 *
 * PATCH /api/v1/onboarding/profile
 *
 * Supports TWO modes:
 *  A) JSON mode: pass an object, it will be wrapped under { user: payload }
 *  B) FormData mode: pass FormData and set isFormData = true
 */
export async function updateBasicProfile(payload, isFormData = false) {
  const url = '/onboarding/profile'

  if (isFormData) {
    // Do not set Content-Type manually; axios will set multipart boundary.
    const res = await client.patch(url, payload, {
      headers: { 'Content-Type': undefined },
    })
    return res.data
  }

  const res = await client.patch(url, { user: payload })
  return res.data
}

/**
 * 2b) EXTENDED KYC PROFILE (address + uploads)
 *
 * PATCH /api/v1/users/basic_profile
 */
export async function updateKycProfile(payload, isFormData = false) {
  const url = '/users/basic_profile'

  if (isFormData) {
    const res = await client.patch(url, payload, {
      headers: { 'Content-Type': undefined },
    })
    return res.data
  }

  const res = await client.patch(url, { user: payload })
  return res.data
}

// ---- 3) PRIMARY USE CASE (used by UseCaseSetup) ----
// PATCH /api/v1/onboarding/use_case
export async function saveOnboardingUseCase({ primary_use_case, onboarding_stage }) {
  const res = await client.patch('/onboarding/use_case', {
    primary_use_case,
    onboarding_stage,
  })
  return res.data
}

// ---- 4) (Optional) admin KYC level update helper ----
// PATCH /api/v1/users/update_kyc_level
export async function saveKycLevel({ kyc_level, id_type }) {
  const res = await client.patch('/users/update_kyc_level', {
    user: { kyc_level, id_type },
  })
  return res.data
}
