import { Form } from 'antd'
import PropTypes from 'prop-types'

import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { CheckCircleOutlined } from '@ant-design/icons'

import FormInput from '../../../../components/formInput/FormInput'
import FormSelect from '../../../../components/formSelect/FormSelect'
import ClassicBtn from '../../../../components/button/ClassicButton'
import { createPurchaseOrder } from '../../../../redux/actions/purchasePower'
import { SET_LOADING } from '../../../../redux/app'

const DashboardPowerForm = () => {
  const [id, biller] = useOutletContext()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState()
  const [err, setErr] = useState()
  const { user } = useSelector((state) => state.auth)

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
    const vendType = (values.vendType || values.vend_type || '').toString().trim().toUpperCase() || 'PREPAID'

    dispatch(
      createPurchaseOrder({
        ...values,
        vendType,
        meter_type: vendType,
        amount: normalizedAmount,
        biller,
        email: user.email,
        phone: user?.user_profile?.phone_number,
        service_type: 'ELECTRICITY',
      })
    ).then((result) => {
      if (createPurchaseOrder.fulfilled.match(result)) {
        const data = result.payload.data
        setLoading(false)
        dispatch(SET_LOADING(false))

        navigate(`/dashboard/utilities/buy-power/${id}/payment-details?transaction_id=${data.id}`)
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

  console.log(biller)
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

      <div className="my-6 ">
        <Form
          onFinish={handleFormSubmit}
          form={form}
          initialValues={{
            amount: '',
            phone: '',
            meter_type: '',
            billersCode: '',
            vendType: 'PREPAID',
          }}
          layout="vertical"
        >
          <div className="flex flex-col sm:flex-row sm:gap-4">
            <FormSelect
              placeholder={'Select Meter Type'}
              className="flex-1"
              label={'Meter Type'}
              options={[
                { label: 'Prepaid', value: 'PREPAID' },
                { value: 'POSTPAID', label: 'Postpaid' },
              ]}
              name={'vendType'}
              rules={[
                { required: true, message: 'Select meter type' },
              ]}
            />
            <FormInput
              className={'flex-1 w-full'}
              label={'Meter Number'}
              placeholder={'Meter Number'}
              name={'billersCode'}
            />
          </div>

          {!user?.user_profile?.phone_number && (
            <div className="flex flex-col sm:flex-row sm:gap-4">
              <FormInput
                className={'flex-1'}
                label={'Phone Number'}
                placeholder={'Enter Phone Number'}
                name={'phone'}
              />
            </div>
          )}
          <div className="sm:w-1/2">
            <FormInput
              className={'w-full'}
              label={'Amount'}
              placeholder={'Enter Amount'}
              type="number"
              step="0.01"
              name={'amount'}
            />
          </div>

          <ClassicBtn isLoading={loading} className={'w-full'} htmlType={'submit'}>
            Proceed to Payment{' '}
          </ClassicBtn>
        </Form>
      </div>
    </>
  )
}

DashboardPowerForm.propTypes = {
  handleSubmit: PropTypes.func,
}

export default DashboardPowerForm
