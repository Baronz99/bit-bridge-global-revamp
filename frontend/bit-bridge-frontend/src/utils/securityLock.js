export const SECURITY_LOCK_CODE = 'security_lock_active'
export const SECURITY_LOCK_PUBLIC_TITLE = 'Transaction temporarily unavailable'
export const SECURITY_LOCK_PUBLIC_MESSAGE = 'This transaction cant be completed right now. Please try again later.'

export const getSecurityLockSnapshot = (payload) => {
  if (!payload || typeof payload !== 'object') return null
  const root = payload?.data && typeof payload.data === 'object' ? payload.data : payload
  const snapshot = root?.security_lock ?? root
  if (!snapshot || typeof snapshot !== 'object') return null

  const active = snapshot.active === true || snapshot.security_locked === true
  return {
    active,
    security_locked: active,
    security_locked_at: snapshot.security_locked_at ?? null,
    security_lock_reason: snapshot.security_lock_reason ?? null,
    security_lock_source: snapshot.security_lock_source ?? null,
    security_unlocked_at: snapshot.security_unlocked_at ?? null,
    security_unlock_method: snapshot.security_unlock_method ?? null,
    unlock_contact: snapshot.unlock_contact ?? null,
  }
}

export const isSecurityLockError = (error) => {
  const code = String(
    error?.response?.data?.error_code || error?.response?.data?.code || error?.error_code || error?.code || ''
  ).trim()
  return code === SECURITY_LOCK_CODE
}

export const getSecurityLockPublicNotice = (error) => {
  const title = String(error?.response?.data?.title || error?.title || SECURITY_LOCK_PUBLIC_TITLE).trim() || SECURITY_LOCK_PUBLIC_TITLE
  const message = String(
    error?.response?.data?.public_message ||
      error?.response?.data?.message ||
      error?.message ||
      SECURITY_LOCK_PUBLIC_MESSAGE
  ).trim() || SECURITY_LOCK_PUBLIC_MESSAGE

  return { title, message }
}

export const shouldShowSecurityLockBanner = (snapshot) => {
  return snapshot?.active === true || snapshot?.security_locked === true
}
