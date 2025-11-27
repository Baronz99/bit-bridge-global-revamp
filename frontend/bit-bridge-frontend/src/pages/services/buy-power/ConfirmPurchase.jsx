import { useDispatch, useSelector } from 'react-redux'
import ClassicBtn from '../../../compnents/button/ClassicButton'
import { useEffect } from 'react'
import { getPurchaseOrder } from '../../../redux/actions/purchasePower'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircleOutlined } from '@ant-design/icons'
import BillOrderDetails from '../../../compnents/confirmationDetails/billOrderDetails'

const ComfirmPurchase = () => {
  const { purchaseOrder, message } = useSelector((state) => state.purchase)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryId = searchParams.get('transaction_id')

  const dispatch = useDispatch()

  useEffect(() => {
    dispatch(getPurchaseOrder(queryId))
  }, [])

  return (
    <>
      {message && (
        <div className="bg-green-200 p-4 my-4">
          <p className="text-green-800 items-center flex gap-2 font-semibold text-center">
            <CheckCircleOutlined />
            Transaction Completed
          </p>
        </div>
      )}

      <BillOrderDetails purchaseOrder={purchaseOrder} />

      <div>
        <ClassicBtn onclick={() => navigate('/')}>Back to Home Page</ClassicBtn>
      </div>
    </>
  )
}

export default ComfirmPurchase
