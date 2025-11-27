import { baseUrl } from '../redux/baseUrl'
import request from '../redux/request'

export default class UserService {
  constructor() {
    this.baseUrl = baseUrl
    this.apiRoute = '/api/v1/'
  }

  static async getUserProfile() {
    return await request('users/user_profile')
  }
}
