import api from './client'
import { getSecurityLockSnapshot } from '../utils/securityLock'

export const getSecurityLock = async () => {
  const response = await api.get('/security_lock')
  return getSecurityLockSnapshot(response?.data)
}

export const activateSecurityLock = async (payload = {}) => {
  const response = await api.post('/security_lock/activate', payload)
  return getSecurityLockSnapshot(response?.data)
}

export const startSecurityLockUnlock = async (payload = {}) => {
  const response = await api.post('/security_lock/unlock/start', payload)
  return response?.data?.data ?? response?.data
}

export const verifySecurityLockUnlock = async (payload = {}) => {
  const response = await api.post('/security_lock/unlock/verify', payload)
  return getSecurityLockSnapshot(response?.data)
}
