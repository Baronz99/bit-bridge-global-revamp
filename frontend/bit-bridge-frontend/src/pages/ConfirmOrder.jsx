import { useEffect, useState } from 'react'

import { FaCheck } from 'react-icons/fa'
import { useDispatch, useSelector } from 'react-redux'
import { useSearchParams } from 'react-router-dom'

import ScrollToTop from '../hooks/scrollToTop'
import OrderSummary from '../components/orderSummary/OrderSummary'
import DiscoverBtn from '../components/button/DiscoverBtn'
import { nairaFormat } from '../utils/nairaFormat'
import { getOrder } from '../redux/actions/order'
import { converter } from '../api/currencyConverter'
import { calculateTotalUSD } from '../utils/localStorage'
import { updateCardToken } from '../redux/actions/orderToken'
import { SET_LOADING } from '../redux/app'
import { splitString } from '../utils'
// import Loader from './Loader';

const ConfirmOrder = () => {
  const [query] = useSearchParams()
  const orderId = query.get('orderId')
  const dispatch = useDispatch()
  const [setConversion] = useState([])
  const [convertedTotal, setConvertedTotal] = useState(0)

  const { order, status } = useSelector((state) => state.order)
  ScrollToTop()
  useEffect(() => {
    dispatch(getOrder(orderId))
  }, [])
  const handleConversion = async (fromCurr, toCurr, amount) => {
    const newvalue = await converter({ fromCurr, toCurr, amount })

    return newvalue?.calc
  }

  useEffect(() => {
    ;(async () => {
      const _cartItems = await Promise.all(
        order?.order_items?.map(async (item) => ({
          ...item,
          usdConversion: await handleConversion(item?.currency, 'usd', item?.value),
        }))
      )

      setConversion(_cartItems)
    })()
  }, [])
  const fetchTotal = async () => {
    const result = await calculateTotalUSD()
    setConvertedTotal(result)
  }
  useEffect(() => {
    fetchTotal()
  }, [])

  return (
    <section className="py-10 px-4 sm:px-10 ">
      <div className="flex m-auto max-w-7xl gap-5 flex-col md:flex-row">
        <div className="flex-1 p-5 rounded-lg py-10  bg-white">
          <p className="text-base font-medium text-gray-600">Refresh browser to view Gift code</p>

          <div>
            {/* <p className="uppercase text-xl md:text-3xl">
              <span>Invoice </span>
              {' '}
              : #
              {order?.invoice_number}
            </p> */}
          </div>

          {status == 'success' && (
            <div className="border border-green-600 flex px-4 py-6 items-center gap-4 rounded bg-green-100/60">
              <span className="w-6 h-6 rounded-full flex justify-center items-center bg-green-300/70 border border-green-600">
                <FaCheck className="text-green-700" />
              </span>{' '}
              Order Placed Successfully
            </div>
          )}

          <div className="border p-4 my-4">
            <p className="text-base font-medium text-gray-500">Mode</p>
            <p className="capitalize text-sm font-semibold text-gray-600">
              {order?.payment_method}
            </p>
          </div>

          <div className="my-4">
            <span className="text-lg uppercase">Items</span>
            {order?.order_items?.map((item) => (
              <>
                <div
                  key={item.id}
                  className="flex justify-between border my-2 rounded-xl py-4 px-4 gap-3"
                >
                  <div className="w-16 h-16 border rounded p-1">
                    <img
                      src={
                        item?.photo_url
                          ? item?.photo_url
                          : `/images/providers/${splitString(item?.product?.provider)}.webp`
                      }
                      alt=""
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item?.product?.provider}</p>
                    <p className="text-sm font-medium">{item?.provision?.name}</p>
                    <p>
                      Quantity:
                      {item?.quantity}
                    </p>
                  </div>
                  <div>
                    <p className="text-base font-semibold">{nairaFormat(item?.amount, 'usd')}</p>
                  </div>
                </div>

                {item?.card_token && (
                  <div className="border flex m-auto flex-col justify-between  h-40 max-w-[300px] w-full rounded-lg shadow p-4 px-2">
                    <div className="flex justify-between ">
                      <p className="text-gray-800 font-semibold">{item?.provision?.name}</p>
                      <p>{nairaFormat(item?.amount, item?.currency)}</p>
                    </div>
                    <div>
                      <button
                        onClick={() => {
                          dispatch(SET_LOADING(true))
                          dispatch(
                            updateCardToken({ id: item?.card_token?.id, data: { reveal: true } })
                          ).then((result) => {
                            if (updateCardToken.fulfilled.match(result)) {
                              dispatch(getOrder(orderId))
                              dispatch(SET_LOADING(false))
                            } else {
                              dispatch(SET_LOADING(false))
                            }
                          })
                        }}
                        className="border m-auto block px-4 rounded-lg text-sm bg-alt font-semibold"
                      >
                        Reveal code
                      </button>
                    </div>
                    <div>
                      <small>GIft Card Code</small>

                      <p className="bg-gray-300 text-center py-1">
                        {item?.card_token?.reveal ? item?.card_token?.token : '************'}
                      </p>
                    </div>
                  </div>
                )}
              </>
            ))}
          </div>

          <div className="flex justify-between">
            <DiscoverBtn
              className="flex gap-2 w-full text-center justify-center"
              link="/"
              btnText="Back to Home"
            >
              {' '}
            </DiscoverBtn>
          </div>
        </div>
        <OrderSummary
          convertedTotal={Number(order?.total_amount)}
          netAmount={order?.net_total}
          cartItems={order?.order_items}
          counter={order?.order_items?.length}
        />
      </div>
    </section>
  )
}

export default ConfirmOrder
