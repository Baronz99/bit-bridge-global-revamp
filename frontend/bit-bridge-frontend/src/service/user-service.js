// src/service/user-service.js

import axios from 'axios'
import { baseUrl, apiRoute } from '../redux/baseUrl'
import { fetchToken } from '../hooks/localStorage'

export default class UserService {
  constructor() {
    // kept so any existing `new UserService()` doesn't break,
    // even though we only use the static method.
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
    // Backend often returns { data: user, ... }
    const level1 = raw && raw.data ? raw.data : raw
    const user = level1 && level1.data ? level1.data : level1

    return user
  }
}
