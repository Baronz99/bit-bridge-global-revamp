import axios from 'axios'
import { API_BASE_URL } from './config'

const normalizeBaseUrl = (url) => (url ? url.replace(/\/+$/, '') : '')

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
