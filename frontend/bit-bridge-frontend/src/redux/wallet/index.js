import { createSlice } from '@reduxjs/toolkit'
import { activateTunnel, convertNgnToUsd, getWallet } from '../actions/wallet'

const initialState = {
  data: {
    wallets: [],
    bridge: null,
    tunnel: null, // ✅ was [] but tunnel is a wallet object, keep it consistent
  },
  loading: false,
  message: null,
}

const walletSlice = createSlice({
  initialState,
  name: 'wallet',

  reducers: {
    resetWalletState: () => initialState,
  },

  extraReducers: (builder) => {
    builder
      // -------------------------
      // GET WALLET (Bridge)
      // -------------------------
      .addCase(getWallet.pending, (state) => {
        state.loading = true
        state.message = null
      })
      .addCase(getWallet.fulfilled, (state, action) => {
        state.loading = false
        state.message = null
        state.data = action.payload?.data || initialState.data
      })
      .addCase(getWallet.rejected, (state, action) => {
        state.loading = false
        state.message = action.payload?.message || 'Failed to load wallets'
      })

      // -------------------------
      // ACTIVATE TUNNEL (USD)
      // -------------------------
      .addCase(activateTunnel.pending, (state) => {
        state.loading = true
        state.message = null
      })
      .addCase(activateTunnel.fulfilled, (state, action) => {
        state.loading = false
        state.message = null

        // Backend returns: { message, data: WalletSerializer... }
        const tunnelWallet = action.payload?.data || null

        // Persist into data.tunnel, and also into data.wallets list if you are using it anywhere.
        state.data.tunnel = tunnelWallet

        // keep an updated wallets array if your UI uses it
        const existing = Array.isArray(state.data.wallets) ? state.data.wallets : []
        const withoutSame = tunnelWallet?.id ? existing.filter((w) => w?.id !== tunnelWallet.id) : existing
        state.data.wallets = tunnelWallet ? [...withoutSame, tunnelWallet] : existing
      })
      .addCase(activateTunnel.rejected, (state, action) => {
        state.loading = false
        state.message = action.payload?.message || 'Failed to activate tunnel wallet'
      })

      // -------------------------
      // CONVERT NGN → USD
      // -------------------------
      .addCase(convertNgnToUsd.pending, (state) => {
        state.loading = true
        state.message = null
      })
      .addCase(convertNgnToUsd.fulfilled, (state, action) => {
        state.loading = false
        state.message = null

        // Expected backend response:
        // { message, data: { ngn_wallet: ..., usd_wallet: ..., conversion: ... } }
        const ngn = action.payload?.data?.ngn_wallet || null
        const usd = action.payload?.data?.usd_wallet || null

        if (ngn) state.data.bridge = ngn
        if (usd) state.data.tunnel = usd

        // keep wallets list updated
        const existing = Array.isArray(state.data.wallets) ? state.data.wallets : []
        let next = existing

        if (ngn?.id) next = next.filter((w) => w?.id !== ngn.id).concat(ngn)
        if (usd?.id) next = next.filter((w) => w?.id !== usd.id).concat(usd)

        state.data.wallets = next
      })
      .addCase(convertNgnToUsd.rejected, (state, action) => {
        state.loading = false
        state.message = action.payload?.message || 'Conversion failed'
      })
  },
})

export default walletSlice.reducer
export const { resetWalletState } = walletSlice.actions
