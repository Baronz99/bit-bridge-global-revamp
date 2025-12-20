// src/service/user-service.js

import client from '../api/client'
import { baseUrl, apiRoute } from '../redux/baseUrl'

export default class UserService {
  constructor() {
    // Kept only so any old instantiations won't explode
    this.baseUrl = baseUrl
    this.apiRoute = apiRoute
  }

  /**
   * Fetch the current logged-in user's profile.
   *
   * Expected:
   * { data: <user or serializer> } OR { data: { data: <user> } }
   */
  static async getUserProfile() {
    try {
      const response = await client.get('/users/user_profile')
      const raw = response?.data

      // Avoid noisy logs in production
      if (import.meta?.env?.DEV) {
        console.log('user_profile raw response:', raw)
      }

      // Normalize shapes
      // - some serializers: { data: { ... } }
      // - some: { data: UserSerializer.new(...) } => nested again
      return raw?.data?.data || raw?.data || raw
    } catch (err) {
      // Let global client interceptor handle 401 redirect.
      // But still throw useful errors for non-401.
      const status = err?.response?.status
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Failed to fetch user profile'

      if (import.meta?.env?.DEV) {
        console.error('getUserProfile failed:', { status, msg })
      }

      throw err
    }
  }
}
