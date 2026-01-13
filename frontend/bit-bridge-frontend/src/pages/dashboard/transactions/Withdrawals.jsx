import { useDispatch, useSelector } from 'react-redux'
import dateFormater from '../../../utils/dateFormat'
import { nairaFormat } from '../../../utils/nairaFormat'
import { useEffect, useMemo } from 'react'
import { NavLink, useOutletContext } from 'react-router-dom'
import { getUserTransactions } from '../../../redux/actions/transaction'
import Loading from '../../../components/loader/Loading'
import statusStyleCard from '../../../utils/statusCard'

const Withdrawals = () => {
  const { transactions, loading } = useSelector((state) => state.transaction)
  const dispatch = useDispatch()

  const ctx = useOutletContext()
  const wallet_type = (ctx?.wallet_type || 'ngn').toLowerCase() === 'usd' ? 'usd' : 'ngn'
  const currencyForFormat = useMemo(() => (wallet_type === 'usd' ? 'usd' : 'ngn'), [wallet_type])

  useEffect(() => {
    dispatch(
      getUserTransactions({
        params: {
          transaction_type: 'withdrawal',
          wallet_type,
        },
      })
    )
  }, [dispatch, wallet_type])

  return (
    <div className="lg:p-10 bg-black py-4 px-2 text-white">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-2xl font-medium text-alt">
          Recent Withdrawals ({wallet_type === 'usd' ? 'USD' : 'NGN'})
        </h4>

        {wallet_type === 'usd' && (
          <span className="text-xs px-3 py-1 rounded-full bg-orange-900/30 border border-orange-700/40 text-orange-200">
            Tunnel (USD)
          </span>
        )}
      </div>

      <div className="min-h-56">
        <div className="h-[500px] overflow-y-auto relative">
          <div className="mt-4 flow-root">
            <div className="inline-block min-w-full py-2 align-middle">
              <table className="min-w-full border border-gray-700 rounded-md border-separate border-spacing-0 table-auto overflow-hidden">
                <thead className="top-0 sticky w-full bg-gray-700/50 left-0">
                  <tr>
                    <th
                      scope="col"
                      className="sticky top-0 z-10 border-b border-gray-600/50 bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold text-gray-300 uppercase backdrop-blur backdrop-filter"
                    >
                      Amount
                    </th>

                    <th
                      scope="col"
                      className="sticky top-0 z-10 border-b border-gray-600/50 bg-opacity-75 px-6 py-3.5 text-left text-xs font-semibold text-gray-300 uppercase backdrop-blur backdrop-filter sm:table-cell"
                    >
                      Bank
                    </th>

                    <th
                      scope="col"
                      className="sticky top-0 z-10 border-b border-gray-600/50 bg-opacity-75 px-6 py-3.5 text-left text-xs font-semibold text-gray-300 uppercase backdrop-blur backdrop-filter sm:table-cell"
                    >
                      Account / Address
                    </th>

                    <th
                      scope="col"
                      className="sticky top-0 z-10 border-b border-gray-600/50 bg-opacity-75 px-3 py-3.5 pr-3 md:px-10 text-left text-xs font-semibold text-gray-300 uppercase backdrop-blur backdrop-filter"
                    >
                      Status
                    </th>

                    <th
                      scope="col"
                      className="sticky top-0 z-10 border-b border-gray-600/50 bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold text-gray-300 uppercase backdrop-blur backdrop-filter lg:table-cell"
                    >
                      Time
                    </th>

                    <th
                      scope="col"
                      className="sticky top-0 z-10 border-b border-gray-600/50 bg-opacity-75 px-3 py-3.5 text-center text-xs font-semibold text-gray-300 uppercase backdrop-blur backdrop-filter lg:table-cell"
                    />
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td className="py-8 text-center justify-center" colSpan={6}>
                        <Loading />
                      </td>
                    </tr>
                  ) : transactions?.length > 0 ? (
                    transactions.map((item) => (
                      <tr key={item?.id}>
                        <td className="whitespace-nowrap border-b border-gray-600 px-3 py-3 text-sm text-gray-200 font-semibold">
                          <p className="font-bold">{nairaFormat(item.amount, currencyForFormat)}</p>
                        </td>

                        <td className="relative max-w-40 whitespace-nowrap border-b border-gray-600 py-3 pr-4 pl-6 text-left text-gray-300 text-sm sm:pr-8 lg:pr-8">
                          {item?.bank ?? 'Not Available'}
                        </td>

                        <td className="relative max-w-40 whitespace-nowrap border-b border-gray-600 py-3 pr-4 pl-6 text-left text-gray-300 text-sm sm:pr-8 lg:pr-8">
                          {item?.address ?? 'Not Available'}
                        </td>

                        <td className="relative whitespace-nowrap border-b border-gray-600 py-3 pr-4 pl-3 text-left text-gray-900 text-sm sm:pr-8 lg:pr-8">
                          <span
                            className={`${statusStyleCard(item?.status)} py-1 w-full max-w-[200px] block text-center px-3 border rounded-3xl`}
                          >
                            {item?.status}
                          </span>
                        </td>

                        <td className="relative whitespace-nowrap border-b text-left border-gray-600 py-3 pr-4 pl-3 text-gray-300 text-sm sm:pr-8 lg:pr-8">
                          {dateFormater(item?.created_at)}
                        </td>

                        <td className="relative whitespace-nowrap border-b text-center border-gray-600 py-3 pr-4 pl-3 text-sm sm:pr-8 lg:pr-8">
                          <NavLink
                            to={`/dashboard/receipt/${item?.id}`}
                            className="text-indigo-300 hover:text-indigo-200 text-xs"
                          >
                            View
                          </NavLink>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="text-center py-10" colSpan={6}>
                        <span className="text-gray-300">No withdrawals found.</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Withdrawals
