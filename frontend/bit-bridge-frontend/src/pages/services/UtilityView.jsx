import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import Header from '../../compnents/header/Header'
import { useDispatch, useSelector } from 'react-redux'
import { SET_LOADING } from '../../redux/app'
import { useEffect, useRef, useState } from 'react'
import { splitString } from '../../utils'
import { getProvisions } from '../../redux/actions/provision'
import { createPurchaseOrder, getPriceList } from '../../redux/actions/purchasePower'
import { toast } from 'react-toastify'
import { message } from 'antd'
import ProvisionDetails from '../../compnents/detailsComp/ProvisionDetails'

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
  const { utilities } = useSelector((state) => state.provision)
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

      <section className="px-4 py-20">
        <h2 className="text-3xl font-semibold">How utility payments work</h2>
        <div></div>
      </section>
    </div>
  )
}

export default UtilityView
