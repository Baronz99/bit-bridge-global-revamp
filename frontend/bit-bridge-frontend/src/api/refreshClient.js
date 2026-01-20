import axios from 'axios'
import { API_BASE_URL } from './config'

const normalizeBaseUrl = (url) => {
  const trimmed = url ? url.replace(/\/+$/, '') : ''
  if (!trimmed) return ''
  return /\/api\/v1$/i.test(trimmed) ? trimmed : `${trimmed}/api/v1`
}

const refreshClient = axios.create({
  baseURL: normalizeBaseUrl(API_BASE_URL),
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  timeout: 60_000,
  withCredentials: false,
})

export default refreshClient
