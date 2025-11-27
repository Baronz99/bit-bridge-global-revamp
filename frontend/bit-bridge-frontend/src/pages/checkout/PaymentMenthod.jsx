import Header from '../../components/header/Header'
import { useDispatch, useSelector } from 'react-redux'
import { createOrder } from '../../redux/actions/order'
import { toast } from 'react-toastify'
import { nairaFormat } from '../../utils/nairaFormat'
import { useEffect, useState } from 'react'
import { GET_CART } from '../../redux/app'
import { getWallet } from '../../redux/actions/wallet'
import OrderSummary from '../../components/orderSummary/OrderSummary'
import { useNavigate } from 'react-router-dom'
import { calculateTotalUSD, clearCartItems } from '../../utils/localStorage'

const PaymentMenthod = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const { totalAmount, cartItems } = useSelector((state) => state.app)
  const [alertText, setAlertText] = useState(false)
  const [convertedTotal, setConvertedTotal] = useState(0)

  const { wallet } = useSelector((state) => state.wallet)
  const { user, loading } = useSelector((state) => state.auth)

  useEffect(() => {
    dispatch(GET_CART())
    dispatch(getWallet())
  }, [])

  const refineCart = cartItems.map((item) => ({
    quantity: 1,
    amount: item.amount,
    product_id: item.product_id,
    provision_id: item.provision_id,
    currency: item.currency,
  }))

  const fetchTotal = async () => {
    const result = await calculateTotalUSD()
    setConvertedTotal(result)
  }
  useEffect(() => {
    fetchTotal()
  }, [cartItems])

  const handlePayment = () => {
    convertedTotal < wallet?.balance
      ? dispatch(
          createOrder({
            order_type: 'buy',
            total_amount: convertedTotal,
            order_items_attributes: refineCart,
          })
        ).then((result) => {
          if (createOrder.fulfilled.match(result)) {
            clearCartItems()

            dispatch(getWallet())

            navigate(`/confirmation-order?orderId=${result.payload.data.id}`)
          } else {
            toast(result?.message, { type: 'error' })
          }
        })
      : setAlertText(true)
  }

  return (
    <div className="m-auto ">
      <Header />

      <div className="py-2 px-4 my-10 max-w-7xl bg-white shadow-sm p-2 m-auto">
        <div className="grid md:grid-cols-checkout gap-20 ">
          <OrderSummary
            convertedTotal={convertedTotal}
            totalAmount={totalAmount}
            cartItems={cartItems}
          />

          <div className="shadow p-4">
            <div className="p-4 bg-white font-medium">
              <h4 className="text-xl font-semibold md:text-3xl my-2 "> select payment method </h4>
              <h3>
                Account Balance: {user ? nairaFormat(wallet.balance, 'usd') : 'Not Available'}{' '}
              </h3>
              <p>
                {!loading && !user && (
                  <span className="text-red-400 text-sm">Sign up to proceed</span>
                )}{' '}
              </p>
              <div>
                <p className="text-2xl font-bold text-green-950">USD</p>
                <p> {nairaFormat(convertedTotal, 'usd')}</p>
                {totalAmount > wallet?.balance && (
                  <p className={`opacity-4 text-gray-500 ${alertText && 'text-red-500'}`}>
                    Not Enough balance
                  </p>
                )}
              </div>

              <div className="py-6">
                <button
                  onClick={handlePayment}
                  className="max-w-md text-center text-white py-2 w-full rounded-3xl bg-primary block m-auto"
                  type="button"
                >
                  Proceed
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PaymentMenthod
