import { createSlice } from '@reduxjs/toolkit'
import { getStatistics } from '../actions/statistics'

const initialState = {
  stats: {},
  message: null,
  loading: false,
}

const statisticsSlice = createSlice({
  initialState,
  name: 'statistics',

  extraReducers: (builder) => {
    builder

      .addCase(getStatistics.fulfilled, (state, action) => {
        return {
          ...state,
          stats: action.payload.data,
          loading: false,
        }
      })
      .addCase(getStatistics.rejected, (state, action) => {
        return {
          ...state,
          message: action.payload.message,
          loading: false,
        }
      })
      .addCase(getStatistics.pending, (state) => {
        return {
          ...state,
          loading: true,
        }
      })
  },
})

export default statisticsSlice.reducer
// export const {resetUser} = AuthSlice.actions
