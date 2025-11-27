import { useDispatch, useSelector } from 'react-redux'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { CheckCircleOutlined } from '@ant-design/icons'
import { toast } from 'react-toastify'

import { SET_LOADING } from '../../redux/app'
import { publicKey } from '../../redux/baseUrl'
import { confirmPayment, getPurchaseOrder } from '../../redux/actions/purchasePower'
import BillOrderDetails from '../../components/confirmationDetails/billOrderDetails'
import PaymentOptions from '../../components/paymentOptions/PaymentOptions'
import { nairaFormat } from '../../utils/nairaFormat'
import SwitchButton from '../../components/button/switchButton'

const DashboardPurchaseDetails = () => {
  const { user } = useSelector((state) => state.auth)
  const { wallet, loading } = useSelector((state) => state.wallet)
  const [applyCommission, setApplyCommission] = useState(false)

  const { purchaseOrder } = useSelector((state) => state.purchase)
  const [searchParams] = useSearchParams()
  const [id, data, service] = useOutletContext()
  const [message, setMessage] = useState()
  const [err, setErr] = useState()
  const navigate = useNavigate()

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

  const queryId = searchParams.get('transaction_id')
  const dispatch = useDispatch()

  const handleConfirmation = useCallback(
    (payment_method) => {
      dispatch(SET_LOADING(true))
      dispatch(
        confirmPayment({ queryId, data: { payment_method, use_commission: applyCommission } })
      ).then((result) => {
        if (confirmPayment.fulfilled.match(result)) {
          const data = result.payload.data

          dispatch(SET_LOADING(false))
          navigate(
            `/dashboard/utilities/${service}/${id}/confirm-payment?transaction_id=${data?.id}`
          )
        } else {
          const data = result.payload
          dispatch(SET_LOADING(false))
          toast(data?.message || 'Failed to make purchase', { type: 'error' })
          setMessage(data.message)
          setErr(true)
        }
      })
    },
    [queryId, dispatch, navigate, applyCommission]
  )

  const handleCommission = (checked) => {
    console.log(checked)
    setApplyCommission((prev) => !prev)
  }

  useEffect(() => {
    dispatch(getPurchaseOrder(queryId))
  }, [])

  return (
    <>
      {(purchaseOrder?.service_type === 'VTU' || purchaseOrder?.service_type === 'DATA') && (
        <div className="bg-gray-900 flex justify-between items-center rounded-lg my-10 p-4">
          <div>
            <span className="text-lg font-medium"> {nairaFormat(wallet?.balance, 'ngn')} </span>
            <p className="flex gap-4 my-0"> {nairaFormat(wallet?.commission ?? 0, 'ngn')}</p>
          </div>
          {/* <button
              disabled={wallet.commission < 1}
              onClick={() => setApplyCommission((prev) => !prev)}
              className={`${applyCommission ? 'bg-alt' : ' bg-primary hover:bg-alt hover:text-primary'} transition-all hover:bg-alt rounded-md duration-200 ease-linear px-4 py-2`}
            >
              apply Commission
            </button> */}

          <SwitchButton onChange={handleCommission} />
        </div>
      )}
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

      <BillOrderDetails purchaseOrder={purchaseOrder} applyCommission={applyCommission} />

      <PaymentOptions
        componentProps={componentProps}
        handleConfirmation={handleConfirmation}
        purchaseOrder={purchaseOrder}
        // redirect_url={`https://www.bitbridgeglobal.com/checkout`}
        redirect_url={`https://www.bitbridgeglobal.com/checkout`}
      />
    </>
  )
}

export default DashboardPurchaseDetails
