import { useDispatch, useSelector } from 'react-redux'
import ClassicBtn from '../../../components/button/ClassicButton'
import { useEffect } from 'react'
import { getPurchaseOrder } from '../../../redux/actions/purchasePower'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { nairaFormat } from '../../../utils/nairaFormat'
import { CheckCircleOutlined } from '@ant-design/icons'

const ComfirmDataPurchase = () => {
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
      <div className="py-1">
        {message && (
          <div className="bg-green-200 p-4 my-4">
            <p className="text-green-800 items-center flex gap-2 font-semibold text-center">
              <CheckCircleOutlined />
              Transaction Completed
            </p>
          </div>
        )}

        <div className="p-4 border rounded-lg">
          <div className="my-4 gap-4 md:flex-row flex-col  flex">
            <p className="w-60 md:w-60 md:border-b px-2 font-semibold">Phone Number</p>
            <p className="flex-1 border-b px-2">{purchaseOrder?.meter_number}</p>
          </div>
          <div className="my-4 gap-4 md:flex-row flex-col  flex">
            <p className="w-60 md:w-60 md:border-b px-2 font-semibold">Amount</p>
            <p className="flex-1 border-b px-2">{nairaFormat(purchaseOrder?.amount ?? 0)}</p>
          </div>

          {purchaseOrder?.amount && (
            <div className="gap-4 my-4 md:flex-row flex-col  flex">
              <p className="w-60 md:w-60 border-b px-2 font-semibold">Service Charge</p>
              <p className="flex-1 border-b px-2">{nairaFormat(100)}</p>
            </div>
          )}

          <div className="gap-4 my-4 md:flex-row flex-col flex">
            <p className="w-60 md:w-60 md:border-b px-2 font-semibold">Total Payable Amount</p>
            <p className="flex-1 border-b px-2">
              {nairaFormat(Number(purchaseOrder?.total_amount ?? 0))}
            </p>
          </div>

          <div className="gap-4 my-4 md:flex-row flex-col flex">
            <p className="w-60 md:w-60 border-b px-2 font-semibold">Transaction ID</p>
            <p className="flex-1 border-b px-2">{purchaseOrder?.transaction_id}</p>
          </div>
          <div className="gap-4 my-4 md:flex-row flex-col  flex">
            <p className="w-60 border-b px-2  md:w-60 font-semibold">Status</p>
            <p className="flex-1 border-b px-2 text-green-700">{purchaseOrder?.status}</p>
          </div>
          <div className="gap-4 my-4 md:flex-row flex-col  flex">
            <p className="w-60 px-2 md:w-60 font-semibold">Purchase ID</p>
            <p className="flex-1 px-2">{purchaseOrder?.id}</p>
          </div>
        </div>

        <div>
          <ClassicBtn onclick={() => navigate('/')}>Back to Home Page</ClassicBtn>
        </div>
      </div>
    </>
  )
}

export default ComfirmDataPurchase
