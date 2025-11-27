import { useEffect, useState } from 'react'
import CartButton from '../button/CartButton'
import { ExclamationOutlined } from '@ant-design/icons'
import FormInput from '../formInput/FormInput'
import { splitString } from '../../utils'
import { converter } from '../../api/currencyConverter'
import PlainSelect from '../formSelect/plainSelect'
import PropTypes from 'prop-types'
import { useSelector } from 'react-redux'

const ProvisionDetails = ({
  selectedProvider,
  service_type,
  linkTitle,
  setValue,
  value,
  priceList,
  handleSubmit,
  label,
}) => {
  const serviceImage = splitString(selectedProvider?.product?.provider)
  const { user } = useSelector((state) => state.auth)

  const [btcValue, setBtcValue] = useState()

  useEffect(() => {
    const fetchBtcValue = async () => {
      try {
        const calcValue = await converter({ fromCurr: 'ngn', amount: value?.amount, toCurr: 'btc' })
        setBtcValue(calcValue)
      } catch (error) {
        console.error('Error fetching BTC value:', error.message)
      }
    }

    fetchBtcValue()
  }, [])

  return (
    <section className="px-4">
      <div className="grid lg:grid-cols-2 gap-10 max-w-6xl m-auto py-10 ">
        <div className="p-10 bg-gray-200 flex justify-center items-center h-96">
          <img
            src={`/images/providers/${serviceImage}.webp`}
            alt="provider image"
            className="w-full h-full"
          />
        </div>
        <div>
          <div className="text-sm my-2 text-gray-600 font-medium">
            <p className="capitalize">
              {linkTitle} &gt; {selectedProvider?.product?.provider}
            </p>
          </div>

          <h3 className="text-2xl font-medium p-">{selectedProvider?.name}</h3>

          <div className="notice border rounded-xl my-2 p-3 font-medium">
            <p className="text-base text-gray-700">{selectedProvider?.product?.info}</p>
          </div>
          <p className="my-3  p-3">{selectedProvider?.product?.header_info}</p>

          {selectedProvider?.service_type == 'VTU' ? (
            <div>
              <h3 className="text-sm font-semibold">Phone Number </h3>

              <FormInput
                type="text"
                value={value.billersCode}
                name={'biller'}
                onChange={(input) => {
                  setValue({
                    ...value,
                    billersCode: input.target.value,
                  })
                }}
                placeholder={'Enter Phone Number'}
                className={'whiteBg'}
              />
              <h3 className="text-sm font-semibold">Enter Amount </h3>

              <div className="flex flex-col gap-0">
                <FormInput
                  type="nubmer"
                  // value={value}
                  onChange={(input) => {
                    setValue({ ...value, amount: input })
                  }}
                  placeholder={'Enter Amount'}
                  className={'whiteBg'}
                />

                <div className="flex-1 text-sm mt-2 from-gray-800">
                  Estimated price {btcValue?.calc}BTC
                </div>
              </div>

              {!user && (
                <div className="my-0">
                  <h3 className="text-base font-semibold">Enter Email </h3>

                  <FormInput
                    onChange={(input) => {
                      setValue({
                        ...value,
                        email: input.target.value,
                      })
                    }}
                    type="text"
                    name="email"
                    className="block w-full rounded"
                    placeholder="Enter Email Address"
                  />
                </div>
              )}
            </div>
          ) : (
            <div>
              <h3 className="text-base font-semibold">{label} </h3>

              <div className="flex flex-col gap-0">
                <FormInput
                  type="text"
                  value={value.billersCode}
                  name={'biller'}
                  onChange={(input) => {
                    setValue({
                      ...value,
                      billersCode: input.target.value,
                    })
                  }}
                  placeholder={'Enter Value'}
                  className={'whiteBg'}
                />
              </div>

              <div>
                {!user && (
                  <div className="my-0">
                    <h3 className="text-base font-semibold">Enter Email </h3>

                    <FormInput
                      onChange={(input) => {
                        setValue({
                          ...value,
                          email: input.target.value,
                        })
                      }}
                      type="text"
                      name="email"
                      className="block w-full rounded"
                      placeholder="Enter Email Address"
                    />
                  </div>
                )}
              </div>
              <h3 className="text-base my- font-semibold">Select Plan/Bundle </h3>

              <div className="flex flex-col gap-0">
                <PlainSelect
                  // value={value}
                  onChange={(val) => {
                    const newAmount = priceList.find((item) => item.value === val)
                    setValue({ ...value, tariff_class: val, amount: newAmount.amount })
                  }}
                  placeholder={'Enter Value'}
                  options={priceList}
                  className={'whiteBg'}
                />

                <div className="flex-1 text-sm mt-2 from-gray-800">
                  Estimated price {btcValue?.calc}BTC
                </div>
              </div>
            </div>
          )}

          <div>
            <div className="my-3">
              <CartButton onClick={handleSubmit}>
                {' '}
                {service_type === 'VTU' ? 'Purchase Airtime' : 'Purchase Subscription'}
              </CartButton>
            </div>
          </div>
          <div className="bg-gray-600 hidden items-center gap-3 rounded-lg text-white p-4">
            <span className="border rounded-full flex justify-center shrink-0">
              <ExclamationOutlined />
            </span>
            <p className="text-sm font-medium ">We are currently out of stock on this product</p>
          </div>
          <div>
            <h3 className="text-2xl my-6 font-medium"> Description </h3>

            <div dangerouslySetInnerHTML={{ __html: selectedProvider?.description }} />
          </div>
        </div>
      </div>
    </section>
  )
}

ProvisionDetails.propTypes = {
  selectedProvider: PropTypes.object,
  setValue: PropTypes.func,
  value: PropTypes.string,
  priceList: PropTypes.array,
  handleSubmit: PropTypes.func,
  label: PropTypes.string,
  linkTitle: PropTypes.string,
  service_type: PropTypes.string,
}

export default ProvisionDetails
