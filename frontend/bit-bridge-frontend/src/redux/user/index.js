import { createSlice } from '@reduxjs/toolkit'
import { getUser, getUsers, userUpdate } from '../actions/user'

const initialState = {
  user: {},
  users: [],
  message: null,
  loading: false,
}

const userSlice = createSlice({
  initialState,
  name: 'user',

  extraReducers: (builder) => {
    builder

      .addCase(userUpdate.fulfilled, (state, action) => {
        return {
          ...state,
          user: action.payload.data,
          loading: false,
        }
      })
      .addCase(userUpdate.rejected, (state, action) => {
        return {
          ...state,
          message: action.payload.message,
          loading: false,
        }
      })
      .addCase(userUpdate.pending, (state) => {
        return {
          ...state,
          loading: true,
        }
      })
      .addCase(getUser.fulfilled, (state, action) => {
        return {
          ...state,
          user: action.payload.data,
          loading: false,
        }
      })
      .addCase(getUser.rejected, (state, action) => {
        return {
          ...state,
          message: action.payload.message,
          loading: false,
        }
      })
      .addCase(getUser.pending, (state) => {
        return {
          ...state,
          loading: true,
        }
      })

      .addCase(getUsers.fulfilled, (state, action) => {
        return {
          ...state,
          users: action.payload.data,
          loading: false,
        }
      })
      .addCase(getUsers.rejected, (state, action) => {
        return {
          ...state,
          message: action.payload.message,
          loading: false,
        }
      })
      .addCase(getUsers.pending, (state) => {
        return {
          ...state,
          loading: true,
        }
      })
  },
})

export default userSlice.reducer
// export const {resetUser} = AuthSlice.actions
