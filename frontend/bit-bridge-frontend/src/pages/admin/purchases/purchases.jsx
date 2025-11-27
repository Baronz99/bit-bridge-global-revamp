import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { getOrders, updateOrder } from '../../../redux/actions/order'
import dateFormater from '../../../utils/dateFormat'
import BreadCrunbs from '../../../components/Breadcrumbs/BreadCrunbs'
import AppModal from '../../../components/modal/Modal'
import ClickButton from '../../../components/button/Button'
import { toast } from 'react-toastify'
import { nairaFormat } from '../../../utils/nairaFormat'
import { getBillOrders } from '../../../redux/actions/billOrders'

const Purchases = () => {
  const dispatch = useDispatch()
  const { billOrders: orders } = useSelector((state) => state.order)
  const [selectedId, setSelectedId] = useState(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    dispatch(getBillOrders())
  }, [])

  console.log(orders)

  const handleOrderUpdate = (task) => {
    dispatch(
      updateOrder({
        id: selectedId,
        data: { status: task },
      })
    ).then((result) => {
      if (updateOrder.fulfilled.match(result)) {
        toast(result.message, { type: 'success' })
        dispatch(getOrders())
      } else {
        toast(result.message, { type: 'error' })
      }
    })
  }

  return (
    <div className="p-4 bg-gray-100">
      <h3 className="font-semibold text-xl text-gray-900">Bill Orders</h3>

      <div className="mt-4 bg-gray-100 flow-root">
        <div className="mx-4 my-2 sm:mx-6 lg:mx-0">
          <div className="inline-block min-w-full py-2 align-middle">
            <table className="min-w-full border border-gray-200 rounded-md border-separate border-spacing-0 table-auto">
              <thead className="bg-gray-200">
                <tr>
                  <th
                    scope="col"
                    className="sticky top-0 z-10 border-b border-gray-200/50  bg-opacity-75 py-3.5 pl-4 pr-3 text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter sm:pl-6 lg:pl-8"
                  >
                    {' '}
                    Email
                  </th>
                  <th
                    scope="col"
                    className="sticky top-0  z-10 border-b border-gray-200/50 bg- bg-opacity-75 px-3 py-3.5 pr-3 text-left text-xs font-semibold text-gray-900  backdrop-blur backdrop-filter"
                  >
                    Type
                  </th>
                  <th
                    scope="col"
                    className="sticky top-0  z-10 border-b border-gray-200/50 bg- bg-opacity-75 px-3 py-3.5 pr-3 text-left text-xs font-semibold text-gray-900  backdrop-blur backdrop-filter"
                  >
                    Provider
                  </th>
                  <th
                    scope="col"
                    className="sticky top-0 z-10  border-b border-gray-200/50  bg-opacity-75 px-6 py-3.5  text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter sm:table-cell"
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
                    className="sticky top-0 z-0  border-b border-gray-200/50 bg- bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter lg:table-cell"
                  >
                    Time{' '}
                  </th>
                  <th
                    scope="col"
                    className=" top-0 z-0  border-b border-gray-200/50 bg- bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter lg:table-cell bg-gray-500"
                  >
                    {' '}
                  </th>
                </tr>
              </thead>

              <tbody>
                {orders?.map((item) => (
                  <tr key={item?.id}>
                    <td className="whitespace-nowrap border-b border-gray-200 py-2 pl-3 pr-3 text-sm font-normal sm:pl-6 lg:pl-8">
                      <p className="font-medium text-gray-600 leading-5">{item.email} </p>
                    </td>
                    <td className="whitespace-nowrap  border-b border-gray-200 hidden px-3 py-4 text-sm text-gray-900 font-normal sm:table-cell capitalize">
                      {item.service_type}
                    </td>
                    <td className="whitespace-nowrap  border-b border-gray-200 hidden px-3 py-4 text-sm text-gray-900 font-normal sm:table-cell capitalize">
                      {item.biller}
                    </td>
                    <td className="whitespace-nowrap  border-b border-gray-200 hidden px-3 py-4 text-sm text-gray-900 font-normal sm:table-cell capitalize">
                      {item.status}
                    </td>

                    {/* <td className="whitespace-nowrap border-b border-gray-200 hidden px-3 py-3 text-sm text-gray-600 sm:table-cell text-left"><span className="rounded-xl  text-xs border border-gray-200 py-1 px-2.5"> <span className= "text-base <%=set_empt_status(user.status)%>"> &#x2022;</span> <span></span></span></td> */}
                    <td className="relative whitespace-nowrap font-semibold border-b border-gray-200 py-3 pr-4 pl-3 text-left text-gray-900 text-sm sm:pr-8 lg:pr-8">
                      <p className="font-bold">{nairaFormat(item?.total_amount, 'ngn')}</p>

                      {/* {item?.order_items[0].amount ?? "Not Available"} */}
                    </td>

                    <td className="relative whitespace-nowrap border-b text-left border-gray-200 py-3 pr-4 pl-3 text-gray-900  text-sm sm:pr-8 lg:pr-8">
                      {dateFormater(item?.created_at)}
                    </td>

                    <td className="relative z-0 whitespace-nowrap border-b text-center border-gray-200 py-3 pr-4 pl-3 text-gray-900  text-sm sm:pr-8 lg:pr-8">
                      <BreadCrunbs
                        id={item.id}
                        setSelectedId={setSelectedId}
                        link={`/admin/purchases/${item?.id}`}
                        setOpen={setOpen}
                        open={open}
                      />
                      {/* <OptionDropDown id={id} handleDel={()=> {
                                                                                                            setOpen(true)
                                                                                                            setSelectedId(id)
                                                                                                        }}/> */}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AppModal handleCancel={() => setOpen(false)} isModalOpen={open} title={'Approve Orders'}>
        <div className="flex my-6 justify-between">
          <ClickButton onClick={() => handleOrderUpdate('declined')} btnType="decline">
            Decline
          </ClickButton>
          <ClickButton onClick={() => handleOrderUpdate('approved')}>Approve</ClickButton>
        </div>
      </AppModal>
    </div>
  )
}

export default Purchases
