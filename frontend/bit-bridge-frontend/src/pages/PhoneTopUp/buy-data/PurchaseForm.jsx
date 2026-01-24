import { Form } from 'antd'
import PropTypes from 'prop-types'
import FormSelect from '../../../compnents/formSelect/FormSelect'
import FormInput from '../../../compnents/formInput/FormInput'
import ClassicBtn from '../../../compnents/button/ClassicButton'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { createPurchaseOrder } from '../../../redux/actions/purchasePower'
import generateRequestId from '../../../utils/generateRequestID'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { CheckCircleOutlined } from '@ant-design/icons'
import { SET_LOADING } from '../../../redux/app'

const DataForm = () => {
  const [id, biller] = useOutletContext()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState()
  const [err, setErr] = useState()
  generateRequestId()

  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()

  const normalizeAmount = (raw) => {
    const num = Number(raw)
    return Number.isFinite(num) ? Math.round(num * 100) / 100 : raw
  }

  const handleFormSubmit = (values) => {
    setLoading(true)
    dispatch(SET_LOADING(true))

    const normalizedAmount = normalizeAmount(values.amount)

    dispatch(
      createPurchaseOrder({
        ...values,
        amount: normalizedAmount,
        biller,
        service_type: 'Electricity',
        request_id: generateRequestId(),
      })
    ).then((result) => {
      if (createPurchaseOrder.fulfilled.match(result)) {
        const data = result.payload.data
        dispatch(SET_LOADING(false))
        setLoading(false)
        navigate(`/buy-power/${id}/payment-details?transaction_id=${data.id}`)
      } else {
        setLoading(false)
        dispatch(SET_LOADING(false))

        const data = result.payload.message
        toast(data, { type: 'error' })
        setMessage(data)
        setErr(true)
      }
    })
  }
  const [form] = Form.useForm()
  const appliedPrefillRef = useRef(false)

  useEffect(() => {
    if (appliedPrefillRef.current) return
    const prefill = location.state?.prefill
    if (!prefill) return

    const nextValues = {
      amount: prefill.amount,
      phone: prefill.phone,
      meter_type: prefill.meter_type,
      billersCode: prefill.billersCode,
      email: prefill.email,
    }
    const filtered = Object.fromEntries(
      Object.entries(nextValues).filter(([, value]) => value != null && value !== '')
    )
    if (Object.keys(filtered).length > 0) {
      form.setFieldsValue(filtered)
    }
    appliedPrefillRef.current = true
  }, [form, location.state])

  useEffect(() => {
    if (location.state?.focusField !== 'phone') return
    setTimeout(() => {
      const el = document.querySelector('input[name="phone"]')
      if (el) el.focus()
    }, 0)
  }, [location.state])

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
            amount: '0.00',
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
              className="flex-1"
              label={'Meter Type'}
              options={[
                { label: 'prepaid', value: 'prepaid' },
                { value: 'postpaid', label: 'Post Paid' },
              ]}
              name={'meter_type'}
            />
            <FormInput
              className={'flex-1 w-full whiteBg'}
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
          <div className="sm:w-1/2 whiteBg">
            <FormInput
              className={'w-full whiteBg'}
              label={'Amount'}
              placeholder={'Enter Amount'}
              type="number"
              step="0.01"
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

DataForm.propTypes = {
  handleSubmit: PropTypes.func,
}

export default DataForm
