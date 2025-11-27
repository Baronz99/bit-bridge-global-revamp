import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { getUserBillOrders } from '../../../redux/actions/order'
import { nairaFormat } from '../../../utils/nairaFormat'
import dateFormater from '../../../utils/dateFormat'
import Loading from '../../../components/loader/Loading'
import statusStyleCard from '../../../utils/statusCard'

const Orders = () => {
  const dispatch = useDispatch()
  const { billOrders, loading } = useSelector((state) => state.order)

  useEffect(() => {
    dispatch(getUserBillOrders())
  }, [dispatch])

  return (
    <div className="w-full px-4 md:px-6 py-4 text-slate-100">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">
            Recent Orders
          </h1>
          <p className="mt-1 text-sm text-slate-400 max-w-xl">
            All your electricity, TV, airtime and other bill payments in one place.
          </p>
        </div>
      </div>

      {/* Orders table card */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 py-4 px-2 md:px-4">
        <div className="h-[500px] overflow-x-auto">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full border border-slate-800 rounded-md border-separate border-spacing-0 table-auto overflow-hidden">
              <thead className="bg-slate-800/80">
                <tr>
                  <th
                    scope="col"
                    className="sticky top-0 z-10 border-b border-slate-700 bg-opacity-75 px-3 py-3.5 text-left text-[11px] font-semibold text-slate-300 uppercase backdrop-blur backdrop-filter"
                  >
                    Order ID
                  </th>
                  <th
                    scope="col"
                    className="sticky top-0 z-10 border-b border-slate-700 bg-opacity-75 py-3.5 pl-4 pr-3 text-left text-[11px] font-semibold text-slate-300 uppercase backdrop-blur backdrop-filter sm:pl-6 lg:pl-8"
                  >
                    Type
                  </th>
                  <th
                    scope="col"
                    className="sticky top-0 z-10 border-b border-slate-700 bg-opacity-75 px-3 py-3.5 text-center text-[11px] font-semibold text-slate-300 uppercase backdrop-blur backdrop-filter"
                  >
                    Amount
                  </th>
                  <th
                    scope="col"
                    className="sticky top-0 z-10 border-b border-slate-700 bg-opacity-75 px-3 py-3.5 text-left md:text-center text-[11px] font-semibold text-slate-300 uppercase backdrop-blur backdrop-filter lg:table-cell"
                  >
                    Recipient
                  </th>
                  <th
                    scope="col"
                    className="sticky top-0 z-10 border-b border-slate-700 bg-opacity-75 px-6 py-3.5 text-center text-[11px] font-semibold text-slate-300 uppercase backdrop-blur backdrop-filter sm:table-cell"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="sticky top-0 z-10 border-b border-slate-700 bg-opacity-75 px-3 py-3.5 text-center text-[11px] font-semibold text-slate-300 uppercase backdrop-blur backdrop-filter lg:table-cell"
                  >
                    Time
                  </th>
                  <th
                    scope="col"
                    className="sticky top-0 z-10 border-b border-slate-700 bg-opacity-75 px-3 py-3.5 text-center text-[11px] font-semibold text-slate-300 uppercase backdrop-blur backdrop-filter lg:table-cell"
                  >
                    {/* actions */}
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td className="py-10 text-center" colSpan={7}>
                      <Loading />
                    </td>
                  </tr>
                ) : billOrders.length > 0 ? (
                  billOrders.map((item) => (
                    <tr key={item?.id} className="bg-black">
                      <td className="whitespace-nowrap border-b border-slate-800 py-2 pl-2 pr-3 text-sm">
                        <p className="font-medium text-slate-200 text-xs md:text-sm truncate max-w-[140px] md:max-w-[200px]">
                          {item.id}
                        </p>
                      </td>

                      <td className="whitespace-nowrap border-b border-slate-800 py-2 pl-3 pr-3 text-sm font-normal sm:pl-6 lg:pl-8">
                        <p className="font-medium text-alt leading-5 text-xs md:text-sm capitalize">
                          {item.service_type}
                        </p>
                      </td>

                      <td className="whitespace-nowrap border-b border-slate-800 px-3 py-3 text-sm text-center">
                        <span className="font-semibold text-slate-100">
                          {nairaFormat(item?.total_amount, 'ngn')}
                        </span>
                      </td>

                      <td className="whitespace-nowrap border-b border-slate-800 px-3 py-3 text-xs md:text-sm text-slate-200 md:text-center text-left">
                        <p className="font-semibold truncate max-w-[160px] md:max-w-xs">
                          {item?.meter_number}
                        </p>
                      </td>

                      <td className="whitespace-nowrap border-b border-slate-800 px-3 py-3 text-sm">
                        <span
                          className={`${statusStyleCard(
                            item?.status
                          )} py-1 w-full max-w-[200px] block text-center px-3 border rounded-3xl`}
                        >
                          {item?.status}
                        </span>
                      </td>

                      <td className="whitespace-nowrap border-b border-slate-800 px-3 py-3 text-xs md:text-sm text-slate-300 text-center">
                        {dateFormater(item?.created_at)}
                      </td>

                      <td className="whitespace-nowrap border-b border-slate-800 px-3 py-3 text-xs md:text-sm text-indigo-300 text-center cursor-pointer hover:text-indigo-200">
                        <span>Details</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-10 text-center text-sm text-slate-400" colSpan={7}>
                      No orders yet. Once you pay for electricity, TV or airtime,
                      they’ll show up here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Orders
