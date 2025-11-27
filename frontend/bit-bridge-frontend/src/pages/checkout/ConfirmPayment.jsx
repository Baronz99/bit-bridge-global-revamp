import { CheckCircleOutlined } from '@ant-design/icons'
import React, { useEffect } from 'react'
import BillOrderDetails from '../../components/confirmationDetails/billOrderDetails'
import ClassicBtn from '../../components/button/ClassicButton'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getRefOrder } from '../../redux/actions/purchasePower'

const ConfirmPayment = () => {
  const { purchaseOrder, message, loading } = useSelector((state) => state.purchase)
  const [searchParams] = useSearchParams()
  const refId = searchParams.get('paymentReference')
  const navigate = useNavigate()
  const queryId = searchParams.get('transaction_id')

  const dispatch = useDispatch()
  console.log(
    purchaseOrder?.status,
    purchaseOrder?.status == 'approved' || purchaseOrder?.status == 'completed'
  )

  useEffect(() => {
    dispatch(getRefOrder(refId))
  }, [])

  return (
    <div className="bg-gray-900 min-h-screen text-white p-6">
      {/* <div>ConfirmPayment</div>
    https://bitbridgeglobal.com/?paymentReference=fbg-1754295884 */}

      {/* https://bitbridgeglobal.com/?paymentReference=fbg-1754295884  */}

      {/* http://localhost:5173/?paymentReference=fbg-1754295884 */}

      {/* https://bitbridgeglobal.com/app-redirect?paymentReference=bbg-1754300805 */}

      {purchaseOrder && (
        <div
          className={`${purchaseOrder?.status == 'approved' || purchaseOrder?.status == 'approved' ? 'bg-green-200' : ' bg-red-200'}  p-4`}
        >
          <p
            className={`${purchaseOrder?.status == 'approved' || purchaseOrder?.status == 'approved' ? 'text-green-800' : ' text-red-800'}  items-center flex gap-2 font-semibold text-center"`}
          >
            <CheckCircleOutlined />

            {`${purchaseOrder?.status == 'approved' || purchaseOrder?.status == 'approved' ? ' Transaction Completed' : '  Transaction Failed'} `}
          </p>
        </div>
      )}

      {refId.startsWith('fbg') ? (
        <div className="bg-gray-900 text-white  flex items-center justify-center">
          <div className="bg-gray-800 rounded-2xl shadow-lg p-6 w-full max-w-2xl">
            <h2 className="text-2xl font-semibold mb-4 text-center">Transaction Details</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <Detail label="Transaction ID" value={purchaseOrder?.id} />
              <Detail label="Status" value={purchaseOrder?.status} badge />
              <Detail
                label="Amount"
                value={`₦${parseFloat(purchaseOrder?.amount).toLocaleString()}`}
              />
              <Detail
                label="Bonus"
                value={`₦${parseFloat(purchaseOrder?.bonus).toLocaleString()}`}
              />
              <Detail label="Type" value={purchaseOrder?.transaction_type} />
              <Detail label="Coin Type" value={purchaseOrder?.coin_type} />
              <Detail label="Wallet ID" value={purchaseOrder?.wallet_id} />
              <Detail label="Bank" value={purchaseOrder?.bank || 'N/A'} />
              <Detail label="Bank Code" value={purchaseOrder?.bank_code || 'N/A'} />
              <Detail label="Sender" value={purchaseOrder?.sender || 'N/A'} />
              <Detail label="Address" value={purchaseOrder?.address || 'N/A'} />
              <Detail
                label="Created At"
                value={new Date(purchaseOrder?.created_at).toLocaleString()}
              />
              <Detail
                label="Updated At"
                value={new Date(purchaseOrder?.updated_at).toLocaleString()}
              />
            </div>
          </div>
        </div>
      ) : (
        <BillOrderDetails purchaseOrder={purchaseOrder} />
      )}

      <div className="bg-gray-800 rounded-2xl shadow-lg p-6 my-4 w-full max-w-2xl m-auto">
        <ClassicBtn onclick={() => navigate('/dashboard/home')}>Back to Home Page</ClassicBtn>
      </div>
    </div>
  )
}

const Detail = ({ label, value, badge = false }) => (
  <div className="flex flex-col">
    <span className="text-gray-400 uppercase text-xs">{label}</span>
    {badge ? (
      <span
        className={`mt-1 inline-block px-2 py-1 rounded-md text-xs font-medium ${
          value === 'approved' || value === 'completed'
            ? 'bg-green-600 text-white'
            : value === 'pending'
              ? 'bg-yellow-600 text-white'
              : 'bg-red-600 text-white'
        }`}
      >
        {value}
      </span>
    ) : (
      <span className="text-white mt-1">{value}</span>
    )}
  </div>
)

export default ConfirmPayment
