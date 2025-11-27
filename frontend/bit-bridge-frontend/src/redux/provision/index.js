import { createSlice } from '@reduxjs/toolkit'
import { createProvision, getProvisions } from '../actions/provision'

const initialState = {
  provision: {},
  provisions: [],
  giftcards: [],
  mobileProviders: [],
  airtime: [],
  dataBundles: [],
  services: [],
  utilities: [],

  loading: true,
}

const provisionSlice = createSlice({
  initialState,
  name: 'provision',

  extraReducers: (builder) => {
    builder
      .addCase(createProvision.fulfilled, (state, action) => {
        return {
          ...state,
          provision: action.payload.data,
        }
      })
      .addCase(createProvision.rejected, (state, action) => {
        return {
          ...state,
          message: action.payload.message,
        }
      })
      .addCase(createProvision.pending, (state) => {
        return {
          ...state,
        }
      })

      .addCase(getProvisions.fulfilled, (state, action) => {
        const products = action.payload.data
        // utilities: filteredUtilities,

        const filteredGiftCards = products.filter((item) => item.product.category === 'gift card')
        const filteredMobileProvider = products.filter(
          (item) => item.product.category === 'mobile provider'
        )
        const filteredServices = products.filter((item) => item.product.category === 'service')
        const airtime = products.filter((item) => item.service_type === 'VTU')
        const databundles = products.filter((item) => item.service_type === 'DATA')
        const filteredUtilities = products.filter((item) => item.product.category === 'utility')

        return {
          ...state,
          products: action.payload.data,
          giftcards: filteredGiftCards,
          services: filteredServices,
          airtime: airtime,
          dataBundles: databundles,
          mobileProviders: filteredMobileProvider,
          utilities: filteredUtilities,
          loading: false,
        }
      })
      .addCase(getProvisions.rejected, (state, action) => {
        return {
          ...state,
          message: action.payload.message,
          loading: false,
        }
      })
      .addCase(getProvisions.pending, (state) => {
        return {
          ...state,
          loading: true,
        }
      })
  },
})

export default provisionSlice.reducer
// export const {resetUser} = AuthSlice.actions
