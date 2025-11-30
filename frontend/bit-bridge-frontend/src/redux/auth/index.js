import { createSlice } from '@reduxjs/toolkit'
import {
  sendUserConfirmation,
  userLogin,
  userLogout,
  userProfile,
  userSignUp,
} from '../actions/auth'

const initialState = {
  user: null,
  logged: false,
  loading: true,
}

const AuthSlice = createSlice({
  initialState,
  name: 'auth',
  reducers: {
    resetUser: (state) => {
      return {
        ...state,
        user: {},
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // SIGN UP
      .addCase(userSignUp.fulfilled, (state, action) => {
        return {
          ...state,
          // backend returns { data: user, ... }
          user: action.payload.data,
          logged: true,
          loading: false,
        }
      })
      .addCase(userSignUp.rejected, (state, action) => {
        return {
          ...state,
          message: action.payload.message,
          loading: false,
        }
      })
      .addCase(userSignUp.pending, (state) => {
        return {
          ...state,
          loading: true,
        }
      })

      // LOGIN
      .addCase(userLogin.fulfilled, (state, action) => {
        return {
          ...state,
          // backend returns { data: user, ... }
          user: action.payload.data,
          logged: true,
          loading: false,
        }
      })
      .addCase(userLogin.rejected, (state, action) => {
        return {
          ...state,
          message: action.payload.message,
          loading: false,
        }
      })
      .addCase(userLogin.pending, (state) => {
        return {
          ...state,
          loading: true,
        }
      })

      // RESEND CONFIRMATION
      .addCase(sendUserConfirmation.fulfilled, (state, action) => {
        return {
          ...state,
          // backend returns { message, data: user }
          user: action.payload.data,
          logged: true,
          loading: false,
        }
      })
      .addCase(sendUserConfirmation.pending, (state) => {
        return {
          ...state,
          loading: true,
        }
      })
      .addCase(sendUserConfirmation.rejected, (state) => {
        return {
          ...state,
          loading: false,
        }
      })

      // ✅ USER PROFILE (this is the important one)
      .addCase(userProfile.fulfilled, (state, action) => {
        return {
          ...state,
          // UserService.getUserProfile already returns the plain user object
          // so we use payload directly, NOT payload.data
          user: action.payload,
          logged: true,
          loading: false,
        }
      })
      .addCase(userProfile.pending, (state) => {
        return {
          ...state,
          loading: true,
        }
      })
      .addCase(userProfile.rejected, (state, action) => {
        return {
          ...state,
          message: action.payload?.message,
          logged: false,
          loading: false,
        }
      })

      // LOGOUT
      .addCase(userLogout.fulfilled, (state) => {
        return {
          ...state,
          user: null,
          logged: false,
          loading: false,
        }
      })
  },
})

export default AuthSlice.reducer
export const { resetUser } = AuthSlice.actions
