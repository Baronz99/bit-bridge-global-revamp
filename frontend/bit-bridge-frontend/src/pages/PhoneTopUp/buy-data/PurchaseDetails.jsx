import { useDispatch, useSelector } from 'react-redux'
import { useEffect } from 'react'
import { confirmPayment, getPurchaseOrder } from '../../../redux/actions/purchasePower'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { CheckCircleOutlined } from '@ant-design/icons'
import { toast } from 'react-toastify'
import BillOrderDetails from '../../../components/confirmationDetails/billOrderDetails'
import PaymentOptions from '../../../components/paymentOptions/PaymentOptions'
import { publicKey } from '../../../redux/baseUrl'
import { SET_LOADING } from '../../../redux/app'

const PurchaseDataDetails = () => {
  const { purchaseOrder, message } = useSelector((state) => state.purchase)
  const [searchParams] = useSearchParams()
  const [id, toView] = useOutletContext()
  const { user } = useSelector((state) => state.auth)

  const componentProps = {
    email: purchaseOrder?.email ?? user?.emal,
    amount: purchaseOrder?.total_amount * 100,

    publicKey: publicKey,
    text: 'Pay From Bank',
    onSuccess: () => {
      handleConfirmation('card')
    },
    // onClose: () => alert('Are you sure'),
  }

  const navigate = useNavigate()

  const queryId = searchParams.get('transaction_id')
  const dispatch = useDispatch()

  const handleConfirmation = (payment_method) => {
    dispatch(SET_LOADING(true))
    dispatch(confirmPayment({ queryId, payment_method })).then((result) => {
      if (confirmPayment.fulfilled.match(result)) {
        const data = result.payload.data
        dispatch(SET_LOADING(false))

        setTimeout(() => {
          toView()
        }, 300)
        navigate(`/phone-top-up/${id}/confirm-payment?transaction_id=${data?.id}`)
      } else {
        dispatch(SET_LOADING(false))

        const data = result.payload
        toast(data?.message || 'Failed to make purchase', { type: 'error' })
      }
    })
  }

  useEffect(() => {
    dispatch(getPurchaseOrder(queryId))
  }, [])
  return (
    <>
      <div className="py-1">
        {message && (
          <div className="bg-green-200 p-4 my-4">
            <p className="text-green-800 items-center flex gap-2 font-semibold text-center">
              <CheckCircleOutlined />
              Transaction initiated
            </p>
          </div>
        )}

        <BillOrderDetails purchaseOrder={purchaseOrder} />

        <div>
          <PaymentOptions
            componentProps={componentProps}
            handleConfirmation={handleConfirmation}
            purchaseOrder={purchaseOrder}
          />{' '}
          {/* <ClassicBtn onclick={handleConfirmation}>Confirm Payment</ClassicBtn> */}
        </div>
      </div>
    </>
  )
}

export default PurchaseDataDetails
