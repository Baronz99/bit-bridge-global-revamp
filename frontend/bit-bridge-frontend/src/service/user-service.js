// src/service/user-service.js (or wherever this file lives)

import { baseUrl } from '../redux/baseUrl'
import request from '../redux/request'

export default class UserService {
  constructor() {
    this.baseUrl = baseUrl
    this.apiRoute = '/api/v1/'
  }

  /**
   * Always return the plain user object, e.g.
   * {
   *   id,
   *   email,
   *   onboarding_stage,
   *   primary_use_case,
   *   user_profile: { first_name, last_name, ... },
   *   ...
   * }
   */
  static async getUserProfile() {
    // Whatever `request` returns, we normalise it.
    const raw = await request('users/user_profile')

    // If request returns axios response -> raw.data = { data: user }
    // If request returns response.data -> raw = { data: user }
    // If it ever returns just user -> raw = user
    const level1 = raw && raw.data ? raw.data : raw      // { data: user } OR user
    const user   = level1 && level1.data ? level1.data : level1  // user

    return user
  }
}
