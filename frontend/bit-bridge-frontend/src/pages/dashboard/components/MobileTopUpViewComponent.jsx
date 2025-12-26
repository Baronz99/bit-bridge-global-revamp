import { useDispatch, useSelector } from 'react-redux'
import { useEffect, useState } from 'react'
import { getProvisions } from '../../../redux/actions/provision'
import LoadingComp from '../../../components/loader/LoadingComp'
import ProductCard from '../../../components/product-card/ProductCard'

const MobileTopUpViewComponents = () => {
  const dispatch = useDispatch()
  const { airtime, dataBundles, loading } = useSelector((state) => state.provision)
  const [activeTab, setActiveTab] = useState('airtime')
  useEffect(() => {
    dispatch(getProvisions())
  }, [])
  return (
    <div className="w-full">
      <section className="py-0 px-4 my-6 text-white">
        <div className="mb-6">
          <h2 className="text-xl md:text-2xl font-semibold">Mobile Top Up</h2>
          <p className="text-sm text-slate-400 mt-1">Choose airtime or data and complete your purchase.</p>
        </div>

        <div className="mb-5 rounded-2xl border border-slate-800 bg-slate-950/60 p-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('airtime')}
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                activeTab === 'airtime'
                  ? 'bg-alt text-black shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Airtime
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('data')}
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                activeTab === 'data'
                  ? 'bg-alt text-black shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Data
            </button>
          </div>
        </div>

        {loading ? (
          <LoadingComp className={'bg-gray-900'} />
        ) : (
          <div className="max-w-7xl text-white m-auto grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {(activeTab === 'airtime' ? airtime : dataBundles).map((item) => (
              <ProductCard
                link={`/dashboard/utilities/mobile-top-up/${item.id}/mobileform`}
                key={item.id}
                id={item.id}
                description={item.product?.description || item.description}
                provider={item.product?.provider || item.name}
                name={item.name}
                isDetails={false}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default MobileTopUpViewComponents
