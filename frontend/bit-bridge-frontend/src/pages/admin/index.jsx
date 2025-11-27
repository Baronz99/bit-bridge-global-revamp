import { UserAddOutlined } from '@ant-design/icons'
import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { NavLink } from 'react-router-dom'
import { getTransactions } from '../../redux/actions/transaction'
import { nairaFormat } from '../../utils/nairaFormat'
import statusStyle from '../../utils/statusStyle'
import dateFormater from '../../utils/dateFormat'
import { PiHandDepositBold, PiHandWithdrawFill } from 'react-icons/pi'
import { getStatistics } from '../../redux/actions/statistics'

const AdminHome = () => {
  const dispatch = useDispatch()
  const { transactions } = useSelector((state) => state.transaction)
  const { stats } = useSelector((state) => state.stat)

  useEffect(() => {
    dispatch(getTransactions())
    dispatch(getStatistics())
  }, [dispatch])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">
            BitBridge Admin Dashboard
          </h1>
          <p className="text-slate-400 mt-1">
            Monitor users, cash flow and recent activity across the platform.
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-400">Today</p>
          <p className="text-lg font-medium">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex flex-col items-center justify-center shadow-sm">
          <UserAddOutlined className="text-3xl text-sky-400 mb-2" />
          <span className="text-slate-400 text-xs tracking-wide">
            TOTAL USERS
          </span>
          <p className="text-2xl font-semibold mt-1">
            {stats?.users ?? 0}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex flex-col items-center justify-center shadow-sm">
          <PiHandDepositBold className="text-3xl text-emerald-400 mb-2" />
          <span className="text-slate-400 text-xs tracking-wide">
            AMOUNT DEPOSITED
          </span>
          <p className="text-2xl font-semibold mt-1">
            {nairaFormat(stats?.total_deposits ?? 0)}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex flex-col items-center justify-center shadow-sm">
          <PiHandWithdrawFill className="text-3xl text-amber-400 mb-2" />
          <span className="text-slate-400 text-xs tracking-wide">
            AMOUNT WITHDRAWN
          </span>
          <p className="text-2xl font-semibold mt-1">
            {nairaFormat(stats?.total_withdrawals ?? 0)}
          </p>
        </div>
      </div>

      {/* Main content: recent transactions + quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)] gap-6">
        {/* Recent Transactions */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Transactions</h2>
            <span className="text-xs text-slate-400">
              Showing latest {transactions?.slice(0, 6).length ?? 0} records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-800">
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Total Amount</th>
                  <th className="py-2 px-3 text-center hidden sm:table-cell">
                    Status
                  </th>
                  <th className="py-2 px-3 text-center">Address</th>
                  <th className="py-2 px-3 text-center hidden lg:table-cell">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions?.slice(0, 6).map((item) => (
                  <tr
                    key={item?.id}
                    className="border-b border-slate-800 hover:bg-slate-950/60"
                  >
                    <td className="whitespace-nowrap py-2 px-3 text-slate-200">
                      <p className="font-medium capitalize">
                        {item?.transaction_type}
                      </p>
                    </td>

                    <td className="whitespace-nowrap py-2 px-3 text-slate-200">
                      <p className="font-medium">
                        {nairaFormat(item.amount)}
                      </p>
                    </td>

                    <td className="whitespace-nowrap py-2 px-3 text-center hidden sm:table-cell">
                      <span
                        className={`${statusStyle(
                          item?.status
                        )} py-1 px-3 rounded-full inline-block text-xs capitalize`}
                      >
                        {item.status}
                      </span>
                    </td>

                    <td className="whitespace-nowrap py-2 px-3 text-center text-slate-200">
                      {item?.address ?? 'Not Available'}
                    </td>

                    <td className="whitespace-nowrap py-2 px-3 text-center text-slate-400 hidden lg:table-cell">
                      {dateFormater(item?.created_at)}
                    </td>
                  </tr>
                ))}

                {(!transactions || transactions.length === 0) && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-6 text-center text-slate-500 text-sm"
                    >
                      No transactions found yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick admin actions */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-sm">
            <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
            <div className="flex flex-col space-y-3 text-sm">
              <NavLink
                to="/admin/add-product"
                className="w-full text-center py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-colors"
              >
                Add Product
              </NavLink>
              <NavLink
                to="/admin/query"
                className="w-full text-center py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 transition-colors"
              >
                Query Transaction
              </NavLink>
            </div>
          </div>

          {/* Placeholder for future widgets (e.g., system health, flags, etc.) */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-sm">
            <h2 className="text-lg font-semibold mb-3">System Notes</h2>
            <p className="text-sm text-slate-400">
              You can use this space later for alerts, settlement summaries or
              integration health checks.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminHome
