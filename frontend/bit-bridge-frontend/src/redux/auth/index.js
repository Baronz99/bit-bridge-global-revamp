// frontend/bit-bridge-frontend/src/redux/auth/index.js

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
  message: null, // you already read state.message in some reducers
}

const AuthSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    resetUser: (state) => {
      return {
        ...state,
        user: null,
        logged: false,
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
          message: action.payload?.message,
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
          message: action.payload?.message,
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

      // USER PROFILE
      .addCase(userProfile.fulfilled, (state, action) => {
        // If your thunk ever changes to return { data: user }, this still works.
        const userData = action.payload?.data || action.payload

        return {
          ...state,
          user: userData,
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
          // I’ll leave logged=false as you had it, but you could keep the user logged in if you want.
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
