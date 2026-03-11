import PropTypes from 'prop-types'
import { useDispatch, useSelector } from 'react-redux'
import dateFormater from '../../../utils/dateFormat'
import nairaFormat from '../../../utils/nairaFormat'
import { useEffect, useMemo, useState } from 'react'
import { NavLink, useOutletContext } from 'react-router-dom'
import { getUserTransactions } from '../../../redux/actions/transaction'
import AppModal from '../../../components/modal/Modal'
import Loading from '../../../components/loader/Loading'
import statusStyleCard from '../../../utils/statusCard'
import { resolveReceiptReference } from '../../../utils/receiptReference'

const Deposits = ({ walletTypeOverride = null }) => {
  const [toggle, setToggle] = useState(false)
  const [viewImage, setViewImage] = useState(null)

  const { transactions, loading } = useSelector((state) => state.transaction)
  const dispatch = useDispatch()

  const ctx = useOutletContext()
  const wallet_type = (walletTypeOverride || ctx?.wallet_type || 'ngn').toLowerCase() === 'usd' ? 'usd' : 'ngn'

  const currencyForFormat = useMemo(() => (wallet_type === 'usd' ? 'usd' : 'ngn'), [wallet_type])
  const visibleTransactions = useMemo(
    () => (Array.isArray(transactions) ? transactions.filter((item) => item?.show_in_primary_feed !== false) : []),
    [transactions]
  )
  const displayAmount = (item) => item?.display_total ?? item?.display_amount ?? item?.amount
  const displayStatus = (item) => String(item?.lifecycle_state || item?.status || 'pending').toLowerCase()
  const statusForStyle = (item) => {
    const state = displayStatus(item)
    if (state === 'completed') return 'approved'
    if (state === 'reserved') return 'initialized'
    if (state === 'released') return 'failed'
    return state
  }

  useEffect(() => {
    dispatch(
      getUserTransactions({
        params: {
          transaction_type: 'deposit',
          wallet_type,
        },
      })
    )
  }, [dispatch, wallet_type])

  return (
    <>
      <div className="lg:p-10 bg-black py-4 px-2 text-white">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-2xl font-medium text-alt">
            Recent Deposits ({wallet_type === 'usd' ? 'USD' : 'NGN'})
          </h4>

          {wallet_type === 'usd' && (
            <span className="text-xs px-3 py-1 rounded-full bg-orange-900/30 border border-orange-700/40 text-orange-200">
              Tunnel (USD)
            </span>
          )}
        </div>

        <div className="h-[500px] overflow-y-auto relative">
          <div className="mt-4 flow-root">
            <div className="inline-block min-w-full py-2 align-middle">
              <table className="min-w-full border border-gray-700 rounded-md border-separate border-spacing-0 table-auto overflow-hidden">
                <thead className="top-0 sticky bg-gray-700/50 w-full left-0">
                  <tr>
                    <th
                      scope="col"
                      className="sticky top-0 z-10 border-b border-gray-200/50 bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold text-gray-300 backdrop-blur backdrop-filter uppercase"
                    >
                      Amount
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-10 border-b border-gray-200/50 bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold text-gray-300 backdrop-blur backdrop-filter uppercase"
                    >
                      Bonus
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-10 border-b border-gray-200/50 bg-opacity-75 pl-2 py-3.5 pr-3 text-center text-xs font-semibold text-gray-300 backdrop-blur backdrop-filter uppercase"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-10 border-b border-gray-200/50 bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold text-gray-300 backdrop-blur backdrop-filter lg:table-cell uppercase"
                    >
                      Time
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-10 border-b border-gray-200/50 bg-opacity-75 px-3 py-3.5 text-center text-xs font-semibold text-gray-300 backdrop-blur backdrop-filter uppercase"
                    >
                      Receipt
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td className="py-8 text-center justify-center" colSpan={6}>
                        <Loading />
                      </td>
                    </tr>
                  ) : visibleTransactions?.length > 0 ? (
                    visibleTransactions.map((item) => (
                      <tr key={item?.id}>
                        <td className="whitespace-nowrap border-b border-gray-200 px-3 py-3 text-sm text-gray-300 font-semibold">
                          <p className="font-bold">{nairaFormat(displayAmount(item), currencyForFormat)}</p>
                        </td>

                        <td className="whitespace-nowrap border-b border-gray-200 px-3 py-3 text-sm text-gray-100 font-semibold">
                          <p className="font-bold">{nairaFormat(item.bonus || 0, currencyForFormat)}</p>
                        </td>

                        <td className="relative whitespace-nowrap border-b border-gray-200 py-3 pr-4 pl-3 text-left text-gray-900 text-sm sm:pr-8 lg:pr-8">
                          <span
                            className={`${statusStyleCard(statusForStyle(item))} py-1 w-full max-w-[200px] block m-auto text-center px-3 border rounded-3xl`}
                          >
                            {displayStatus(item)}
                          </span>
                          {item?.display_message ? (
                            <p className="text-xs text-slate-400 mt-2">{item.display_message}</p>
                          ) : null}
                        </td>

                        <td className="relative whitespace-nowrap border-b text-left border-gray-200 py-3 pr-4 pl-3 text-gray-300 text-sm sm:pr-8 lg:pr-8">
                          {dateFormater(item?.created_at)}
                        </td>
                        <td className="relative whitespace-nowrap border-b border-gray-200 py-3 pr-4 pl-3 text-center text-sm sm:pr-8 lg:pr-8">
                          {resolveReceiptReference(item, { kindHint: 'wallet', preferWallet: true }) ? (
                            <NavLink
                              to={`/dashboard/receipt/${resolveReceiptReference(item, { kindHint: 'wallet', preferWallet: true })}`}
                              className="text-indigo-300 hover:text-indigo-200 text-xs"
                            >
                              View receipt
                            </NavLink>
                          ) : (
                            <span className="text-slate-500 text-xs">Receipt unavailable</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="text-center py-10" colSpan={7}>
                        <span className="text-gray-300">No deposits found.</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <AppModal isModalOpen={toggle} handleCancel={() => setToggle(false)}>
        <div className="max-w-lg bg-white h-[500px] w-full">
          <img src={viewImage} alt="" className="h-full w-full" />
        </div>
      </AppModal>
    </>
  )
}


Deposits.propTypes = {
  walletTypeOverride: PropTypes.oneOf(['ngn', 'usd']),
}

export default Deposits

