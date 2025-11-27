import { useDispatch, useSelector } from 'react-redux'
import { useEffect, useState } from 'react'
import { confirmPayment, getPurchaseOrder } from '../../../redux/actions/purchasePower'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { CheckCircleOutlined } from '@ant-design/icons'
import { toast } from 'react-toastify'
import BillOrderDetails from '../../../components/confirmationDetails/billOrderDetails'
import { SET_LOADING } from '../../../redux/app'
import PaymentOptions from '../../../components/paymentOptions/PaymentOptions'
import { publicKey } from '../../../redux/baseUrl'

const PurchaseDetails = () => {
  const { user } = useSelector((state) => state.auth)

  const { purchaseOrder } = useSelector((state) => state.purchase)
  const [searchParams] = useSearchParams()
  const [id] = useOutletContext()
  const [message, setMessage] = useState()
  const [err, setErr] = useState()
  const navigate = useNavigate()

  const componentProps = {
    email: purchaseOrder?.email ?? user?.emal,
    amount: purchaseOrder?.total_amount * 100,
    publicKey,
    text: 'Pay From Bank',
    onSuccess: () => {
      handleConfirmation('card')
    },
    // onClose: () => alert('Are you sure'),
  }

  const queryId = searchParams.get('transaction_id')
  const dispatch = useDispatch()

  const handleConfirmation = (payment_method) => {
    dispatch(SET_LOADING(true))

    dispatch(confirmPayment({ queryId, payment_method })).then((result) => {
      if (confirmPayment.fulfilled.match(result)) {
        const data = result.payload.data
        dispatch(SET_LOADING(false))

        navigate(`/buy-power/${id}/confirm-payment?transaction_id=${data?.id}`)
      } else {
        const data = result.payload
        dispatch(SET_LOADING(false))
        toast(data?.message || 'Failed to make purchase', { type: 'error' })
        setMessage(data.message)
        setErr(true)
      }
    })
  }

  useEffect(() => {
    dispatch(getPurchaseOrder(queryId))
  }, [])
  return (
    <>
      {message && (
        <div className={`${err ? 'bg-red-200' : 'bg-green-200'} p-4 my-4`}>
          <p
            className={`${err ? 'text-red-800' : 'text-green-800'} items-center flex gap-2 font-semibold text-center`}
          >
            <CheckCircleOutlined />
            {message}
          </p>
        </div>
      )}

      <BillOrderDetails purchaseOrder={purchaseOrder} />

      <PaymentOptions
        componentProps={componentProps}
        handleConfirmation={handleConfirmation}
        purchaseOrder={purchaseOrder}
      />
    </>
  )
}

export default PurchaseDetails
