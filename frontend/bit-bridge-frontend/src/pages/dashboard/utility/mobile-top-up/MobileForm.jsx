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

const DashboardMobileForm = () => {
  const [id, selectedProvider, service] = useOutletContext()
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
    const data = {
      ...values,
      ...value,
      biller: selectedProvider.product.provider.toUpperCase(),
      service_type: selectedProvider.service_type,
      skip: true,
    }

    dispatch(createPurchaseOrder(data)).then((result) => {
      if (createPurchaseOrder.fulfilled.match(result)) {
        const data = result.payload.data
        setLoading(false)
        dispatch(SET_LOADING(false))

        navigate(`/dashboard/utilities/${service}/${id}/payment-details?transaction_id=${data.id}`)
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
              {selectedProvider?.service_type == 'VTU' ? (
                <div>
                  {/* <h3 className="text-sm font-semibold">Phone Number </h3> */}

                  <FormInput
                    type="text"
                    // value={value.billersCode}
                    billerType={'phone_no'}
                    label={'Phone Number'}
                    required={true}
                    name={'billersCode'}
                    // onChange={(input)=> {
                    //     setValue({
                    //         ...value,
                    //         billersCode: input.target.value.replace(/\D/g, "").slice(0, 11)
                    //     })
                    // }}
                    placeholder={'Enter Phone Number'}
                  />
                  {/* <h3 className="text-sm font-semibold">Enter Amount </h3> */}

                  <div className="flex flex-col gap-0">
                    <FormInput
                      type="nubmer"
                      // value={value}
                      onChange={(input) => {
                        setValue({ ...value, amount: input })
                      }}
                      placeholder={'Enter Amount'}
                    />

                    {/* <div className="flex-1 text-sm mt-2 from-gray-800">
                                        Estimated price {btcValue?.calc}BTC
                                    </div>  */}
                  </div>
                </div>
              ) : (
                <div>
                  {/* <h3 className="text-base font-semibold">{label} </h3> */}

                  <div className="flex flex-col gap-0">
                    <FormInput
                      type="text"
                      value={value.billersCode}
                      name={'billersCode'}
                      billerType={'phone_no'}
                      // onChange={(input)=> {
                      //     setValue({
                      //         ...value,
                      //         billersCode: input.target.value
                      //     })
                      // }}
                      placeholder={'Enter Phone Number'}
                      //   className={"whiteBg"}
                    />
                  </div>

                  <div></div>
                  {/* <h3 className="text-base my- font-semibold">Select Plan/Bundle </h3> */}

                  <div className="flex flex-col gap-0">
                    <PlainSelect
                      // value={value}
                      onChange={(val) => {
                        const newAmount = priceList.find((item) => item.value === val)
                        setValue({ ...value, tariff_class: val, amount: newAmount.amount })
                      }}
                      placeholder={'Select data bundle'}
                      options={priceList}
                    />

                    {/* <div className="flex-1 text-sm mt-2 from-gray-800">
                                                    Estimated price {btcValue?.calc}BTC
                                                </div>  */}
                  </div>
                </div>
              )}

              <div className="flex-1 text-sm mt-2 from-gray-800"></div>
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

DashboardMobileForm.propTypes = {
  handleSubmit: PropTypes.func,
}

export default DashboardMobileForm
