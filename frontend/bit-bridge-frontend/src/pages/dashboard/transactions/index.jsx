import { NavLink, Outlet, useSearchParams } from 'react-router-dom'

const Transactions = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  // ✅ wallet_type filter: ngn | usd
  const walletTypeRaw = (searchParams.get('wallet_type') || 'ngn').toLowerCase()
  const wallet_type = walletTypeRaw === 'usd' ? 'usd' : 'ngn'

  const setWalletType = (next) => {
    const normalized = next === 'usd' ? 'usd' : 'ngn'
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      p.set('wallet_type', normalized)
      return p
    })
  }

  const active =
    'bg-alt rounded-tr-lg rounded-tl-lg bg-alt text-gray-900 px-3 py-1 font-semibold'
  const normal =
    'rounded-tr-lg rounded-tl-lg bg-gray-500 text-gray-200 px-3 py-1 font-semibold'

  // ✅ helper to keep wallet_type in tab links
  const withWalletType = (path) => `${path}?wallet_type=${wallet_type}`

  return (
    <div>
      <div className="px-4">
        {/* ✅ Wallet type switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="text-xs text-gray-300">
            Viewing wallet:{' '}
            <span className="font-semibold">
              {wallet_type === 'usd' ? 'USD (Tunnel)' : 'NGN (Bridge)'}
            </span>
          </div>

          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWalletType('ngn')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                wallet_type === 'ngn'
                  ? 'bg-alt text-black border-alt'
                  : 'bg-slate-900 text-slate-200 border-slate-700 hover:border-alt/70'
              }`}
            >
              Bridge (NGN)
            </button>

            <button
              type="button"
              onClick={() => setWalletType('usd')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                wallet_type === 'usd'
                  ? 'bg-orange-500 text-black border-orange-400'
                  : 'bg-slate-900 text-slate-200 border-slate-700 hover:border-orange-400/70'
              }`}
            >
              Tunnel (USD)
            </button>
          </div>
        </div>

        {/* ✅ Tabs (preserve wallet_type param) */}
        <ul className="flex gap-5 px-2">
          <li>
            <NavLink
              to={withWalletType('/dashboard/transactions/orders')}
              className={({ isActive }) => (isActive ? active : normal)}
            >
              Order
            </NavLink>
          </li>

          <li>
            <NavLink
              to={withWalletType('/dashboard/transactions/deposits')}
              className={({ isActive }) => (isActive ? active : normal)}
            >
              Deposits
            </NavLink>
          </li>

          <li>
            <NavLink
              to={withWalletType('/dashboard/transactions/withdrawals')}
              className={({ isActive }) => (isActive ? active : normal)}
            >
              Withdrawals
            </NavLink>
          </li>
        </ul>

        {/* ✅ Pass wallet_type down to nested routes via Outlet context */}
        <div className="mt-3">
          <Outlet context={{ wallet_type }} />
        </div>
      </div>
    </div>
  )
}

export default Transactions
