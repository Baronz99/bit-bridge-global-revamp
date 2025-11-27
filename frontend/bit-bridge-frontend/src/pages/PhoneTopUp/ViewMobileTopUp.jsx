import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import Header from '../../components/header/Header'
import ProductCard from '../../components/product-card/ProductCard'

import { useDispatch, useSelector } from 'react-redux'
import { SET_LOADING } from '../../redux/app'
import { useEffect, useRef, useState } from 'react'
import { splitString } from '../../utils'

import { getProvisions } from '../../redux/actions/provision'
import { createPurchaseOrder, getPriceList } from '../../redux/actions/purchasePower'
import { toast } from 'react-toastify'
import { message } from 'antd'
import ProvisionDetails from '../../components/detailsComp/ProvisionDetails'
const ViewMobileTopUp = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const dispatch = useDispatch()
  const { id } = useParams()
  const [value, setValue] = useState({
    billersCode: '',
    tariff_class: '',
    amount: '',
  })

  const { mobileProviders, giftcards } = useSelector((state) => state.provision)

  const { priceList } = useSelector((state) => state.billPurchase)

  const selectedProvider = mobileProviders?.find((item) => item.id === id)

  const sectionRef = useRef(null)

  const toView = () => {
    sectionRef.current.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (location.hash == '#details') {
      const element = document.getElementById('details')
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }, [location])

  const handleSubmit = () => {
    if (
      (selectedProvider?.service_type === 'VTU' &&
        value.billersCode.trim() != '' &&
        String(value.amount).trim() != '') ||
      (selectedProvider?.service_type === 'DATA' &&
        value.billersCode.trim() != '' &&
        value.tariff_class.trim() !== '')
    ) {
      dispatch(SET_LOADING(true))

      dispatch(
        createPurchaseOrder({
          ...value,
          biller: selectedProvider?.product?.provider,
          service_type: selectedProvider?.service_type,
          skip: true,
        })
      ).then((result) => {
        if (createPurchaseOrder.fulfilled.match(result)) {
          const data = result.payload.data

          dispatch(SET_LOADING(false))
          navigate(`/phone-top-up/${id}/payment-details?transaction_id=${data.id}#details`)
          setTimeout(() => {
            toView()
          }, 300)
        } else {
          dispatch(SET_LOADING(false))
          const data = result.payload.message
          toast(data, { type: 'error' })
          // setMessage(data)
          // setErr(true)
        }
      })
    } else {
      message.error('form can not be blank')
    }
  }
  useEffect(() => {
    dispatch(getProvisions())
  }, [])
  useEffect(() => {
    if (selectedProvider) {
      const provider = splitString(selectedProvider?.product?.provider)

      dispatch(getPriceList({ service_type: selectedProvider?.service_type, provider: provider }))
    }
  }, [selectedProvider])

  return (
    <div>
      <Header />
      <ProvisionDetails
        service_type={selectedProvider?.service_type}
        linkTitle={selectedProvider?.product?.provider}
        label="Phone Number"
        setValue={setValue}
        value={value}
        priceList={priceList}
        handleSubmit={handleSubmit}
        selectedProvider={selectedProvider}
      />

      <section id="details" ref={sectionRef} className="bg-white ">
        <div className="m-auto max-w-7xl shadow border px-4">
          <Outlet context={[id, toView]} />
        </div>
      </section>

      <section className="px-4 bg-gray-200 py-10">
        <div className="max-w-7xl m-auto bg-red-40">
          <h2 className="text-2xl my-4">More Products on BitBridge</h2>
          <div className="grid sm:grid-cols-4 gap-3">
            {giftcards.map(({ id, product, min_value, max_value, name, currency }) => (
              <ProductCard
                link={`/gift-cards/${id}`}
                key={id}
                id={id}
                min_value={min_value}
                currency={currency}
                max_value={max_value}
                provider={product.provider}
                provision={name}
              />
            ))}
          </div>
        </div>
      </section>
      <section className="px-4 py-20">
        <h2 className="text-3xl font-semibold">How gift card work</h2>
        <div></div>
      </section>
    </div>
  )
}

export default ViewMobileTopUp
