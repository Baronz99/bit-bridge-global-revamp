import { useDispatch, useSelector } from 'react-redux'
import { useEffect } from 'react'
import { confirmPayment, getPurchaseOrder } from '../../../redux/actions/purchasePower'
import { NavLink, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { CheckCircleOutlined } from '@ant-design/icons'
import { toast } from 'react-toastify'
import { SET_LOADING } from '../../../redux/app'
import BillOrderDetails from '../../../compnents/confirmationDetails/billOrderDetails'

const PurchaseCableDetails = () => {
  const { purchaseOrder, message } = useSelector((state) => state.purchase)
  const { user } = useSelector((state) => state.auth)
  const [searchParams] = useSearchParams()
  const [id] = useOutletContext()

  const navigate = useNavigate()

  const queryId = searchParams.get('transaction_id')
  const dispatch = useDispatch()

  const handleConfirmation = (payment_method) => {
    dispatch(SET_LOADING(true))
    dispatch(confirmPayment({ queryId, payment_method })).then((result) => {
      if (confirmPayment.fulfilled.match(result)) {
        const data = result.payload

        dispatch(SET_LOADING(false))
        toast(data?.message || 'Order confirmed', { type: 'success' })

        navigate(`/utility-services/${id}/confirm-payment?transaction_id=${data?.data.id}`)
      } else {
        const data = result.payload
        dispatch(SET_LOADING(false))

        toast(data?.message || 'Failed to make purchase', { type: 'error' })
      }
    })
  }

  useEffect(() => {
    dispatch(getPurchaseOrder(queryId))
  }, [])

  return (
    <>
      <div className="py-20">
        {message && (
          <div className="bg-green-200 p-4 my-4">
            <p className="text-green-800 items-center flex gap-2 font-semibold text-center">
              <CheckCircleOutlined />
              Transaction initiated
            </p>
          </div>
        )}

        <BillOrderDetails purchaseOrder={purchaseOrder} />
      </div>
      <div className="bg-gray-100 flex justify-center items-center flex-col gap-6 min-h-60 p-4 md:p-8 rounded-lg">
        {user ? (
          <div className="w-full">
            <button
              className="border-alt m-auto block max-w-sm w-full h-20 bg-alt rounded-lg border px-4 py-2 shadow-md text-primary text-xl font-medium"
              onClick={() => handleConfirmation('wallet')}
            >
              Pay from Wallet
            </button>
          </div>
        ) : (
          <p className="text-center font-medium text-primary text-lg">
            <NavLink className={'hover:text-alt'} to={'/login'}>
              Login
            </NavLink>{' '}
            to pay with from your wallet
          </p>
        )}

        <p className="text-xs text-gray-500 text-center">
          Bank/card bill checkout is disabled. Fund wallet to continue.
        </p>
      </div>
    </>
  )
}

export default PurchaseCableDetails
