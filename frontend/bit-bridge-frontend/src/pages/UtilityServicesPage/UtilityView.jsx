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

const UtilityView = () => {
  const dispatch = useDispatch()
  const location = useLocation()

  const sectionRef = useRef(null)
  const { id } = useParams()
  const [value, setValue] = useState({
    billersCode: '',
    tariff_class: '',
    amount: '',
    email: '',
  })
  const { utilities, giftcards } = useSelector((state) => state.provision)
  const { priceList } = useSelector((state) => state.billPurchase)

  const navigate = useNavigate()

  const selectedProvider = [...utilities]?.find((item) => item.id == id)

  useEffect(() => {
    dispatch(getProvisions())
  }, [])

  const toView = () => {
    sectionRef.current.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (location.hash == '#details') {
      toView()
    }
  }, [location])

  useEffect(() => {
    if (selectedProvider) {
      const provider = splitString(selectedProvider?.product?.provider)

      dispatch(getPriceList({ service_type: selectedProvider?.service_type, provider: provider }))
    }
  }, [selectedProvider])

  const handleSubmit = () => {
    dispatch(SET_LOADING(true))

    if (value.billersCode.trim() != '' && value.tariff_class.trim() !== '') {
      const data = {
        ...value,
        biller: selectedProvider?.product?.provider,
        service_type: selectedProvider?.service_type,
      }

      dispatch(createPurchaseOrder(data)).then((result) => {
        if (createPurchaseOrder.fulfilled.match(result)) {
          const data = result.payload.data

          dispatch(SET_LOADING(false))
          navigate(`/utility-services/${id}/payment-details?transaction_id=${data.id}#details`)
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
  return (
    <div>
      <Header />
      <ProvisionDetails
        linkTitle="Utility"
        label="Meter Number"
        service_type="tv"
        setValue={setValue}
        value={value}
        priceList={priceList}
        handleSubmit={handleSubmit}
        selectedProvider={selectedProvider}
      />

      <section id="details" ref={sectionRef} className="bg-white ">
        <div className="m-auto max-w-7xl shadow border px-4">
          <Outlet context={[id]} />
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

export default UtilityView
