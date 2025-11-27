import { Form } from 'antd'
import PropTypes from 'prop-types'
import FormSelect from '../../../components/formSelect/FormSelect'
import FormInput from '../../../components/formInput/FormInput'
import ClassicBtn from '../../../components/button/ClassicButton'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { createPurchaseOrder } from '../../../redux/actions/purchasePower'
import generateRequestId from '../../../utils/generateRequestID'
import { useState } from 'react'
import { toast } from 'react-toastify'
import { CheckCircleOutlined } from '@ant-design/icons'
import { SET_LOADING } from '../../../redux/app'

const PowerForm = () => {
  const [id, biller] = useOutletContext()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState()
  const [err, setErr] = useState()
  generateRequestId()

  const navigate = useNavigate()
  const dispatch = useDispatch()

  const handleFormSubmit = (values) => {
    setLoading(true)

    dispatch(SET_LOADING(true))

    dispatch(
      createPurchaseOrder({
        ...values,
        biller,
        service_type: 'Electricity',
        request_id: generateRequestId(),
      })
    ).then((result) => {
      if (createPurchaseOrder.fulfilled.match(result)) {
        const data = result.payload.data

        setLoading(false)
        dispatch(SET_LOADING(false))

        navigate(`/buy-power/${id}/payment-details?transaction_id=${data.id}`)
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
  const [form] = Form.useForm()

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
            amount: '',
            phone: '',
            meter_type: '',
            billersCode: '',
            email: '',
          }}
          layout="vertical"
        >
          <div className="flex flex-col sm:flex-row sm:gap-4">
            <FormSelect
              placeholder={'Select Meter Type'}
              className="flex-1 whiteBg"
              label={'Meter Type'}
              options={[
                { label: 'prepaid', value: 'prepaid' },
                { value: 'postpaid', label: 'Post Paid' },
              ]}
              name={'meter_type'}
            />
            <FormInput
              className={'flex-1 w-full'}
              label={'Meter Number'}
              placeholder={'Enter Meter Number'}
              name={'billersCode'}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:gap-4">
            <FormInput
              className={'flex-1'}
              label={'Phone Number'}
              placeholder={'Enter Phone Number'}
              name={'phone'}
            />
            <FormInput
              className={'flex-1'}
              label={'Email'}
              placeholder={'Enter Meter Number'}
              name={'email'}
            />
          </div>
          <div className="sm:w-1/2">
            <FormInput
              className={'w-full whiteBg'}
              label={'Amount'}
              placeholder={'Enter Amount'}
              type="Number"
              name={'amount'}
            />
          </div>

          <ClassicBtn isLoading={loading} htmlType={'submit'}>
            Submit{' '}
          </ClassicBtn>
        </Form>
      </div>
    </>
  )
}

PowerForm.propTypes = {
  handleSubmit: PropTypes.func,
}

export default PowerForm
