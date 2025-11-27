import { useDispatch, useSelector } from 'react-redux'
import dateFormater from '../../../utils/dateFormat'
import { nairaFormat } from '../../../utils/nairaFormat'

import { useEffect } from 'react'
import { getUserTransactions } from '../../../redux/actions/transaction'
import Loading from '../../../components/loader/Loading'
import statusStyleCard from '../../../utils/statusCard'

const Withdrawals = () => {
  const { transactions, loading } = useSelector((state) => state.transaction)

  const dispatch = useDispatch()
  useEffect(() => {
    dispatch(getUserTransactions({ type: 'withdrawal' }))
  }, [])

  return (
    <div className="lg:p-10 bg-black py-4 px-2 text-white">
      <h4 className="text-2xl font-medium text-alt">Recent Withdrawals</h4>
      <div className="min-h-56">
        <div className="h-[500px] overflow-y-auto relative">
          <div className="">
            <div className="mt-4 flow-root">
              <div className="">
                <div className="inline-block min-w-full py-2 align-middle">
                  <table className="min-w-full  border border-gray-700 rounded-md border-separate border-spacing-0 table-auto overflow-hidden">
                    <thead className="top-0 sticky w-full bg-gray-700/50 left-0">
                      <tr>
                        <th
                          scope="col"
                          className="sticky top-0 z-10 border-b border-gray-600/50 bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold text-gray-300 uppercase backdrop-blur backdrop-filter"
                        >
                          Amount
                        </th>

                        {/* <th scope="col" className="sticky top-0 z-10 border-b border-gray-200/50  bg-opacity-75 py-3.5 pl-4 pr-3 text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter sm:pl-6 lg:pl-8">  transaction</th> */}
                        <th
                          scope="col"
                          className="sticky  top-0 z-10  border-b border-gray-600/50  bg-opacity-75 px-6 py-3.5  text-left text-xs font-semibold text-gray-300 uppercase backdrop-blur backdrop-filter sm:table-cell"
                        >
                          Bank
                        </th>
                        <th
                          scope="col"
                          className="sticky  top-0 z-10  border-b border-gray-600/50  bg-opacity-75 px-6 py-3.5  text-left text-xs font-semibold text-gray-300 uppercase backdrop-blur backdrop-filter sm:table-cell"
                        >
                          Account Number
                        </th>
                        <th
                          scope="col"
                          className="sticky top-0  z-10 border-b border-gray-600/50 bg- bg-opacity-75 px-3 py-3.5 pr-3 md:px-10 text-left text-xs font-semibold text-gray-300 uppercase  backdrop-blur backdrop-filter"
                        >
                          Status
                        </th>

                        <th
                          scope="col"
                          className="sticky top-0 z-10  border-b border-gray-600/50 bg- bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold  text-gray-300 uppercase backdrop-blur backdrop-filter lg:table-cell"
                        >
                          Time{' '}
                        </th>
                        <th
                          scope="col"
                          className="sticky top-0 z-10  border-b border-gray-600/50 bg- bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold  text-gray-300 uppercase backdrop-blur backdrop-filter lg:table-cell"
                        >
                          {' '}
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {loading ? (
                        <tr>
                          <td className=" py-8 text-center justify-center " colSpan={6}>
                            <span>
                              <Loading />
                            </span>
                          </td>
                        </tr>
                      ) : transactions.length > 0 ? (
                        transactions?.map((item) => (
                          <tr key={item?.id}>
                            <td className="whitespace-nowrap border-b border-gray-600 px-3 py-3 text-sm text-gray-600/90  font-semibold ">
                              <p className="font-bold">{nairaFormat(item.amount, 'usd')}</p>
                            </td>
                            <td className="relative max-w-40 whitespace-nowrap border-b border-gray-600 py-3 pr-4 pl-6 text-left text-gray-300 text-sm sm:pr-8 lg:pr-8">
                              {item?.bank ?? 'Not Available'}
                            </td>
                            <td className="relative max-w-40 whitespace-nowrap border-b border-gray-600 py-3 pr-4 pl-6 text-left text-gray-300 text-sm sm:pr-8 lg:pr-8">
                              {item?.address ?? 'Not Available'}
                            </td>

                            <td className="relative whitespace-nowrap border-b border-gray-600 py-3 pr-4 pl-3 text-left text-gray-900 text-sm sm:pr-8 lg:pr-8">
                              <span
                                className={`${statusStyleCard(item?.status)} py-1 w-full max-w-[200px] block  text-center px-3 border rounded-3xl`}
                              >
                                {item?.status}
                              </span>
                            </td>
                            <td className="relative whitespace-nowrap border-b text-left border-gray-600 py-3 pr-4 pl-3 text-gray-300  text-sm sm:pr-8 lg:pr-8">
                              {dateFormater(item?.created_at)}
                            </td>
                            <td className="relative whitespace-nowrap border-b text-center border-gray-200 py-3 pr-4 pl-3 text-blue-600  text-sm sm:pr-8 lg:pr-8">
                              <span>Details</span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="text-center py-10" colSpan={6}>
                            <span className="text-black">No Transaction</span>
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
      </div>
    </div>
  )
}

export default Withdrawals
