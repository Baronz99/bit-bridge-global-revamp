import { useDispatch, useSelector } from 'react-redux'
import ClassicBtn from '../../../components/button/ClassicButton'
import { getPurchaseOrder } from '../../../redux/actions/purchasePower'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircleOutlined } from '@ant-design/icons'
import BillOrderDetails from '../../../components/confirmationDetails/billOrderDetails'
import useBillOrderPolling from '../../../hooks/useBillOrderPolling'

const ComfirmCablePurchase = () => {
  const { purchaseOrder } = useSelector((state) => state.purchase)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryId = searchParams.get('transaction_id')

  const dispatch = useDispatch()

  useBillOrderPolling({
    queryId,
    dispatch,
    getPurchaseOrder,
    status: purchaseOrder?.status,
  })

  const statusValue = String(purchaseOrder?.status || '').toLowerCase()
  const isCompleted =
    statusValue === 'completed' || statusValue === 'approved' || statusValue === 'success'

  return (
    <>
      <div className="py-20">
        {isCompleted && (
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
      </div>
    </>
  )
}

export default ComfirmCablePurchase
