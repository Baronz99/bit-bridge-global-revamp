// src/service/user-service.js

import axios from 'axios'
import { baseUrl, apiRoute } from '../redux/baseUrl'
import { fetchToken } from '../hooks/localStorage'

export default class UserService {
  constructor() {
    // Kept only so any old instantiations won't explode
    this.baseUrl = baseUrl
    this.apiRoute = apiRoute
  }

  /**
   * Fetch the current logged-in user's full profile.
   *
   * Staging + local backend both respond like:
   * {
   *   "data": {
   *     "id": "...",
   *     "email": "...",
   *     "user_profile": { ... },
   *     ...
   *   }
   * }
   *
   * So we always return raw.data as the user object.
   */
  static async getUserProfile() {
  const token = fetchToken()

  // Build headers safely so we never send "Bearer null"
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }

  // Only add Authorization if token is a real value
  if (token && token !== 'null' && token !== 'undefined') {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await axios.get(
    `${baseUrl}${apiRoute}users/user_profile`,
    {
      headers,
      withCredentials: true, // 👈 send cookies for session auth
    }
  )

  const raw = response.data
  console.log('user_profile raw response:', raw)

  return raw?.data || raw
}

}
