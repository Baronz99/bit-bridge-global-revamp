import { Form } from 'antd'
import PropTypes from 'prop-types'

import { useNavigate, useOutletContext } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { CheckCircleOutlined } from '@ant-design/icons'

import FormInput from '../../../../components/formInput/FormInput'
import ClassicBtn from '../../../../components/button/ClassicButton'
import { createPurchaseOrder, getPriceList } from '../../../../redux/actions/purchasePower'
import { SET_LOADING } from '../../../../redux/app'
import PlainSelect from '../../../../components/formSelect/plainSelect'
import { splitString } from '../../../../utils'

const DashboardCableForm = () => {
  const [id, selectedProvider] = useOutletContext()
  const { user } = useSelector((state) => state.auth)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState()
  const [err, setErr] = useState()

  const [value, setValue] = useState({
    tariff_class: '',
    amount: '',
    email: user?.email,
  })

  useEffect(() => {
    setValue({
      ...value,
      email: user?.email,
    })
  }, [user])

  const navigate = useNavigate()
  const dispatch = useDispatch()

  const handleFormSubmit = (values) => {
    setLoading(true)

    dispatch(SET_LOADING(true))

    dispatch(
      createPurchaseOrder({
        ...values,
        ...value,
        biller: selectedProvider.product.provider,
        service_type: selectedProvider.service_type,
      })
    ).then((result) => {
      if (createPurchaseOrder.fulfilled.match(result)) {
        const data = result.payload.data
        setLoading(false)
        dispatch(SET_LOADING(false))

        navigate(`/dashboard/utilities/cable/${id}/payment-details?transaction_id=${data.id}`)
      } else {
        setLoading(false)
        const data = result.payload.message
        toast(data, { type: 'error' })
        dispatch(SET_LOADING(false))
        setMessage(data)
        setErr(true)
      }
    })
  }

  const { priceList } = useSelector((state) => state.billPurchase)

  const [form] = Form.useForm()
  useEffect(() => {
    if (selectedProvider) {
      const provider = splitString(selectedProvider?.product?.provider)

      dispatch(getPriceList({ service_type: selectedProvider?.service_type, provider: provider }))
    }
  }, [selectedProvider])

  // const amount = Form.useWatch("amount", form);

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

      <div>
        <Form
          onFinish={handleFormSubmit}
          form={form}
          initialValues={{
            billersCode: '',
          }}
          layout="vertical"
        >
          <div>
            <div className="flex flex-col gap-0">
              <FormInput type="text" name={'billersCode'} placeholder={'Enter Decoder Number'} />
            </div>

            <h3 className="text-base font-semibold text-white mb-2">Select Plan/Bundle </h3>

            <div className="flex flex-col gap-0">
              <PlainSelect
                // value={value}
                onChange={(val) => {
                  const newAmount = priceList.find((item) => item.value === val)
                  setValue({ ...value, tariff_class: val, amount: newAmount.amount })
                }}
                placeholder={'Select Subscription Plan'}
                options={priceList}
                className={''}
              />

              <div className="flex-1 text-sm mt-2 from-gray-800">
                {/* Estimated price {btcValue?.calc}BTC */}
              </div>
            </div>
          </div>

          <ClassicBtn isLoading={loading} htmlType={'submit'} className={'w-full bg-gray-200'}>
            Proceed{' '}
          </ClassicBtn>
        </Form>
      </div>
    </>
  )
}

DashboardCableForm.propTypes = {
  handleSubmit: PropTypes.func,
}

export default DashboardCableForm
