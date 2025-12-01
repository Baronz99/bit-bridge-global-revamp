// src/service/user-service.js

import axios from 'axios'
import { baseUrl, apiRoute } from '../redux/baseUrl'
import { fetchToken } from '../hooks/localStorage'

export default class UserService {
  constructor() {
    // Keep these so any old code using `new UserService()` won't break,
    // even though we only use the static method below.
    this.baseUrl = baseUrl
    this.apiRoute = apiRoute
  }

  /**
   * Fetch the current logged-in user's full profile.
   *
   * - Calls: GET `${baseUrl}${apiRoute}users/user_profile`
   * - Sends Authorization header with the JWT from localStorage
   * - Always returns the plain user object.
   */
  static async getUserProfile() {
    const token = fetchToken()

    const response = await axios.get(
      `${baseUrl}${apiRoute}users/user_profile`,
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        withCredentials: false,
      }
    )

    const raw = response.data
    console.log('user_profile raw response:', raw)

    // Try several common shapes:
    // 1) { data: { user: {...} } }
    if (raw?.data?.user) {
      return raw.data.user
    }

    // 2) { user: {...} }
    if (raw?.user) {
      return raw.user
    }

    // 3) { data: {...} }
    if (raw?.data) {
      return raw.data
    }

    // 4) Fallback: raw itself is the user
    return raw
  }
}
