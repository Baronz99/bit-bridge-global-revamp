import test from 'node:test'
import assert from 'node:assert/strict'

import {
  SECURITY_LOCK_CODE,
  SECURITY_LOCK_PUBLIC_MESSAGE,
  SECURITY_LOCK_PUBLIC_TITLE,
  getSecurityLockPublicNotice,
  getSecurityLockSnapshot,
  isSecurityLockError,
  shouldShowSecurityLockBanner,
} from '../securityLock.js'

test('builds a canonical security lock snapshot on web', () => {
  const snapshot = getSecurityLockSnapshot({
    data: {
      security_lock: {
        active: true,
        security_locked_at: '2026-04-26T18:00:00Z',
        unlock_contact: { masked_phone: '+23480****1234' },
      },
    },
  })

  assert.equal(snapshot.active, true)
  assert.equal(snapshot.security_locked, true)
  assert.equal(snapshot.unlock_contact.masked_phone, '+23480****1234')
})

test('detects security lock API errors on web', () => {
  assert.equal(
    isSecurityLockError({ response: { data: { error_code: SECURITY_LOCK_CODE } } }),
    true
  )
  assert.equal(isSecurityLockError({ response: { data: { error_code: 'other' } } }), false)
})

test('falls back to the neutral public notice on web', () => {
  const notice = getSecurityLockPublicNotice({})
  assert.equal(notice.title, SECURITY_LOCK_PUBLIC_TITLE)
  assert.equal(notice.message, SECURITY_LOCK_PUBLIC_MESSAGE)
})

test('shows the dashboard banner only while active on web', () => {
  assert.equal(shouldShowSecurityLockBanner({ active: true }), true)
  assert.equal(shouldShowSecurityLockBanner({ security_locked: true }), true)
  assert.equal(shouldShowSecurityLockBanner({ active: false }), false)
  assert.equal(shouldShowSecurityLockBanner(null), false)
})
