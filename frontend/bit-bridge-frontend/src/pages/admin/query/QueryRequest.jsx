import React, { useState } from 'react'
import FormInput from '../../../components/formInput/FormInput'
import ClickButton from '../../../components/button/Button'
import { useDispatch } from 'react-redux'
import { SET_LOADING } from '../../../redux/app'
import { queryTransaction } from '../../../redux/actions/purchasePower'
import { Button, Form } from 'antd'
import { toast } from 'react-toastify'
import AppModal from '../../../components/modal/Modal'

const QueryRequest = () => {
  const dispatch = useDispatch()
  const [form] = Form.useForm()

  const transactionID = Form.useWatch('query', form)
  const [data, setQueryData] = useState(null)
  const [openModal, setOpenModal] = useState(false)

  const handleQueryTransaction = () => {
    dispatch(SET_LOADING(true))

    dispatch(queryTransaction({ id: transactionID })).then((result) => {
      if (queryTransaction.fulfilled.match(result)) {
        dispatch(SET_LOADING(false))
        toast(result.payload.message ?? 'query successful', { type: 'success' })
        setOpenModal(true)
        setQueryData(result.payload.data)
        return
      } else {
        toast(result.payload.message ?? 'Query Failed', { type: 'error' })
        dispatch(SET_LOADING(false))
      }
    })
  }

  return (
    <div>
      <div className="max-w-5xl shadow mt-10 p-4 rounded">
        <Form
          form={form}
          layout="vertical"
          onFinish={(formData) => {
            handleQueryTransaction(formData)
          }}
          initialValues={{
            query: '',
          }}
          // onSubmit={() => {}}
        >
          <div>
            <FormInput className="whiteBg" required label={'Transaction ID'} name={'query'} />
          </div>
          <Button
            className="border-alt m-auto block w-full h-20 bg-primary text-black rounded-lg  border shadow-md font-medium text-xl"
            type="primary"
            htmlType="submit"
          >
            {' '}
            Submit Query
          </Button>
        </Form>
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
    </div>
  )
}

const Detail = ({ label, value }) => (
  <div className="flex flex-col">
    <span className="font-medium text-gray-600">{label}</span>
    <span className="text-gray-900">{value}</span>
  </div>
)

export default QueryRequest
