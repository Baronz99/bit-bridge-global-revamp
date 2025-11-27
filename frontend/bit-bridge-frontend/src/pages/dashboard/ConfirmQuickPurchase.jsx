import { useDispatch, useSelector } from 'react-redux'
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircleOutlined } from '@ant-design/icons'

import { getPurchaseOrder } from '../../redux/actions/purchasePower'
import { getWallet } from '../../redux/actions/wallet'
import BillOrderDetails from '../../components/confirmationDetails/billOrderDetails'
import ClassicBtn from '../../components/button/ClassicButton'

const ComfirmQuickPurchase = () => {
  const { purchaseOrder, message } = useSelector((state) => state.purchase)
  const { id } = useParams()
  const navigate = useNavigate()

  const dispatch = useDispatch()

  useEffect(() => {
    dispatch(getPurchaseOrder(id))
    dispatch(getWallet())
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
        <ClassicBtn onclick={() => navigate('/dashboard/home')}>Back to Home Page</ClassicBtn>
      </div>
    </>
  )
}

export default ComfirmQuickPurchase
