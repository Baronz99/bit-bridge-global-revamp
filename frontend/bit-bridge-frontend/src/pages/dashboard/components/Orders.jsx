import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { getUserOrders } from '../../../redux/actions/order'
import dateFormater from '../../../utils/dateFormat'
import { nairaFormat } from '../../../utils/nairaFormat'
import Loading from '../../../components/loader/Loading'

const OrderTransact = () => {
  const dispatch = useDispatch()
  const { orders, loading } = useSelector((state) => state.order)

  useEffect(() => {
    dispatch(getUserOrders())
  }, [])

  return (
    <div className="px-1 md:px-4 sm:px-6 w-full lg:px-8 overflow-x-auto hover:border-gray-900">
      <div className="mt-4 flow-root">
        <div className="">
          <div className="inline-block min-w-full py-2 align-middle">
            <table className="min-w-full bg-gray-300 border border-gray-200 rounded-md border-separate border-spacing-0 table-auto overflow-hidden">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="sticky top-0 z-10 border-b border-gray-200/50  bg-opacity-75 py-3.5 pl-4 pr-3 text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter sm:pl-6 lg:pl-8"
                  >
                    {' '}
                    order
                  </th>
                  {/* <th scope="col" className="sticky top-0  z-10 border-b border-gray-200/50 bg- bg-opacity-75 px-3 py-3.5 pr-3 text-left text-xs font-semibold text-gray-900  backdrop-blur backdrop-filter">Type</th> */}
                  <th
                    scope="col"
                    className="sticky top-0 z-10  border-b border-gray-200/50  bg-opacity-75 px-0 py-3.5  text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter sm:table-cell"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="sticky top-0 z-10 border-b border-gray-200/50 bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter"
                  >
                    Amount
                  </th>
                  <th
                    scope="col"
                    className="sticky top-0 z-10  border-b border-gray-200/50 bg- bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter lg:table-cell"
                  >
                    Provision{' '}
                  </th>
                  <th
                    scope="col"
                    className="sticky top-0 z-10  border-b border-gray-200/50 bg- bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter lg:table-cell"
                  >
                    Time{' '}
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-10">
                      <Loading />
                    </td>
                  </tr>
                ) : (
                  orders?.map((item) => (
                    <tr key={item?.id}>
                      <td className="whitespace-nowrap border-b border-gray-200 py-2 pl-3 pr-3 text-sm font-normal sm:pl-6 lg:pl-8">
                        <p className="font-medium text-gray-600 leading-5">{item.order_type} </p>
                      </td>
                      <td className="whitespace-nowrap  border-b border-gray-200 hidde px-0 md:px-3 py-4 text-sm text-gray-900 font-normal sm:table-cell capitalize">
                        {item.status}
                      </td>

                      {/* <td className="whitespace-nowrap border-b border-gray-200 hidden px-3 py-3 text-sm text-gray-600 sm:table-cell text-left"><span className="rounded-xl  text-xs border border-gray-200 py-1 px-2.5"> <span className= "text-base <%=set_empt_status(user.status)%>"> &#x2022;</span> <span></span></span></td> */}
                      <td className="relative whitespace-nowrap font-semibold border-b border-gray-200 py-3 md:pr-4 pl-3 text-left text-gray-900 text-sm sm:pr-8 lg:pr-8">
                        {nairaFormat(item?.total_amount, 'usd')}
                      </td>
                      <td className="whitespace-nowrap border-b border-gray-200 px-3 py-3 text-sm text-gray-600/90  font-semibold ">
                        {item?.order_items.map((item) => (
                          <div key={item?.id}>
                            <p className="font-bold text-gray-700 capitalize">
                              {item?.provision?.name}
                            </p>

                            <p>{nairaFormat(item?.amount, item?.provision?.currency)}</p>
                          </div>
                        ))}
                      </td>

                      <td className="relative whitespace-nowrap border-b text-left border-gray-200 py-3 pr-4 pl-3 text-gray-900  text-sm sm:pr-8 lg:pr-8">
                        {dateFormater(item?.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OrderTransact
