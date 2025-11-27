import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useParams } from 'react-router-dom'
import { getOrder } from '../../../redux/actions/order'
import { nairaFormat } from '../../../utils/nairaFormat'
// import ClassicBtn from '../../../compnents/button/ClassicButton'
import AppModal from '../../../components/modal/Modal'

import './styles.scss'
import { createCardToken } from '../../../redux/actions/orderToken'
import { toast } from 'react-toastify'
import { getBillOrder } from '../../../redux/actions/billOrders'
import dateFormater from '../../../utils/dateFormat'
import { SET_LOADING } from '../../../redux/app'
import { queryTransaction } from '../../../redux/actions/purchasePower'
import Detail from '../../../components/queryDetails/Details'

const ViewOrder = () => {
  const { id } = useParams()
  const dispatch = useDispatch()
  const { billOrder: order } = useSelector((state) => state.order)
  // const {cardToken} = useSelector(state => state.orderToken)
  const [open, setOpen] = useState(null)
  const [openModal, setOpenModal] = useState(false)
  const [data, setQueryData] = useState(null)

  useEffect(() => {
    dispatch(getBillOrder(id))
    handleUpdate
  }, [])

  const handleUpdate = (values) => {
    dispatch(createCardToken({ card_token: values })).then((result) => {
      if (createCardToken.fulfilled.match(result)) {
        toast(result?.payload?.message, { type: 'success' })
        dispatch(getOrder(id))

        setOpen(false)
      } else {
        toast(result.payload?.message || 'Something went wrong', { type: 'error' })
      }
    })
  }

  const handleQueryTransaction = () => {
    dispatch(SET_LOADING(true))

    dispatch(queryTransaction({ id })).then((result) => {
      if (queryTransaction.fulfilled.match(result)) {
        dispatch(SET_LOADING(false))
        toast(result.payload.message ?? 'query successful', { type: 'success' })
        setOpenModal(true)
        setQueryData(result.payload.data)
        return
      } else {
        console.log(result)

        toast(result.payload.message ?? 'Query Failed', { type: 'error' })

        dispatch(SET_LOADING(false))
      }
    })
  }

  const statusColor = (s) => {
    const status = (s || '').toLowerCase()
    if (status === 'success' || status === 'completed') return 'bg-green-100 text-green-800'
    if (status === 'pending' || status === 'in_progress') return 'bg-yellow-100 text-yellow-800'
    if (status === 'failed' || status === 'error') return 'bg-red-100 text-red-800'
    if (status === 'disputed') return 'bg-orange-100 text-orange-800'
    return 'bg-gray-100 text-gray-800'
  }

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text || '')
      toast('Copied items', { type: 'success' })
    } catch (err) {
      console.error('Copy failed', err)
    }
  }

  console.log(order)

  return (
    <>
      <div className="m-auto max-w-7xl my-4">
        <div className="mt-1 flex justify-end">
          <button
            onClick={handleQueryTransaction}
            className="px-4 py-2  rounded-lg hover:bg-blue-700  border-alt my-10 block bg-primary text-white  border shadow-md "
          >
            Requery Transaction
          </button>
        </div>
        <article className="max-w-3xl mx-auto p-4 md:p-6 bg-white rounded-2xl shadow-md border border-gray-100">
          <header className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">Transaction</h3>
              <p className="text-sm text-gray-500">{order.email}</p>
            </div>

            <div className="text-right">
              <p className="text-xl font-bold">{nairaFormat(order?.total_amount)}</p>
              <p
                className={`mt-2 inline-block px-3 py-1 text-sm rounded-full ${statusColor(order?.status)}`}
              >
                {order?.status}
              </p>
            </div>
          </header>

          <section className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-gray-400">Provider</label>
              <div className="text-sm font-medium">{order?.biller}</div>

              <label className="mt-3 text-xs text-gray-400">Service</label>
              <div className="text-sm">
                {order?.service_type} • {order?.meter_type}
              </div>

              <label className="mt-3 text-xs text-gray-400">Tariff Class</label>
              <div className="text-sm">{order?.tariff_class}</div>

              <label className="mt-3 text-xs text-gray-400">Recipient</label>
              <div className="text-sm">{order?.meter_number}</div>

              <label className="mt-3 text-xs text-gray-400">Payment Method</label>
              <div className="text-sm">
                {order?.payment_method} • {order?.payment_type}
              </div>

              <label className="mt-3 text-xs text-gray-400">Meter Type:</label>

              <div>
                <p className="text-base font-medium">
                  <span className="capitalize font-normal text-sm"> {order?.meter_type}</span>
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-400">Order ID</label>
              <div className="flex items-center gap-2">
                <code className="text-sm break-all bg-gray-50 px-2 py-1 rounded">{id}</code>
                <button
                  onClick={() => copyToClipboard(id)}
                  className="text-sm px-2 py-1 border rounded text-gray-600 hover:bg-gray-50"
                >
                  Copy
                </button>
              </div>

              <label className="mt-3 text-xs text-gray-400">Transaction ID</label>
              <div className="flex items-center gap-2">
                <code className="text-sm break-all bg-gray-50 px-2 py-1 rounded">
                  {order.transaction_id || '—'}
                </code>
                <button
                  onClick={() => copyToClipboard(id)}
                  className="text-sm px-2 py-1 border rounded text-gray-600 hover:bg-gray-50"
                >
                  Copy
                </button>
              </div>

              <label className="mt-3 text-xs text-gray-400">Name</label>
              <div className="text-sm">{order?.name}</div>

              <label className="mt-3 text-xs text-gray-400">Date</label>
              <div className="text-sm">{dateFormater(order?.created_at)}</div>
            </div>
          </section>

          <div>
            {order?.token && (
              <div>
                <p className="text-xl font-medium">
                  Token: <span className="capitalize font-normal"> {order?.token}</span>
                </p>
              </div>
            )}
          </div>

          <section className="mt-4">
            <label className="text-xs text-gray-400">Response Message</label>
            <div className="mt-2 text-sm text-gray-700 bg-gray-50 p-3 rounded">{order?.reason}</div>
          </section>

          <footer className="mt-4 flex items-center justify-between">
            <div className="text-xs text-gray-500">Name/Phone: {order?.name}</div>
            <div id="tx-copy-feedback" className="text-sm text-gray-500" />
          </footer>
        </article>
      </div>

      {data && (
        <AppModal handleCancel={() => setOpenModal(false)} isModalOpen={openModal}>
          <div className="max-w-2xl mx-auto bg-white shadow-md rounded-2xl p-6 mt-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Transaction Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
              <Detail label="Order ID" value={data.orderId} />
              <Detail label="Disco" value={data.disco} />
              <Detail label="Amount Generated" value={`₦${data.amountGenerated}`} />
              <Detail label="Total Amount Paid" value={`₦${data.totalAmountPaid}`} />
              <Detail label="Vend Amount" value={`₦${data.vendAmount}`} />
              <Detail label="Units" value={data.units} />
              <Detail label="Vend Time" value={data.vendTime} />
              <Detail label="Token" value={data.token || 'N/A'} />
              <Detail label="Receipt No" value={data.receiptNo} />
              <Detail label="Response" value={data.responseMessage} />
              <Detail label="Response Code" value={data.responseCode} />
              <Detail label="Name" value={data.name} />
              <Detail label="Phone No" value={data.phoneNo || 'N/A'} />
              <Detail label="Address" value={data.address} />
              <Detail label="Debt Amount" value={`₦${data.debtAmount}`} />
              <Detail label="Debt Remaining" value={`₦${data.debtRemaining}`} />
              <Detail label="Demand Category" value={data.demandCategory} />
              <Detail label="Asset Provider" value={data.assetProvider} />
              <Detail label="Tariff Index" value={data.tariffIndex || 'N/A'} />
              <Detail label="Charges" value={`₦${data.charges}`} />
            </div>
          </div>
        </AppModal>
      )}
    </>
  )
}

export default ViewOrder
